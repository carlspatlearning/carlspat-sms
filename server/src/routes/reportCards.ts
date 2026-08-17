import { Router } from "express";
import { Role } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { authenticate, assertCanAccessStudent, STAFF } from "../middleware/auth";
import { currentSchoolId } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { computeStudentResult, attendanceSummary } from "../services/resultService";
import { assertReportCardUnlocked, getFeeBalance, REPORT_CARD_LOCK_MESSAGE } from "../services/feeService";
import { renderReportCard, reportSignature, ReportCardData } from "../services/pdfService";
import { env } from "../config/env";

const router = Router();

/**
 * BUSINESS RULE: parents and students can only view/download/print a report
 * card when fees for the term are fully paid. Staff bypass the lock so the
 * school can always prepare and review reports.
 */
async function enforceFeeLock(role: Role, studentId: string, termId: string) {
  if ((STAFF as Role[]).includes(role)) return;
  await assertReportCardUnlocked(studentId, termId); // throws 402 when locked
}

async function buildReportData(studentId: string, termId: string): Promise<ReportCardData> {
  const [student, term] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { classRoom: true },
    }),
    prisma.term.findUnique({ where: { id: termId }, include: { session: true } }),
  ]);
  if (!student) throw ApiError.notFound("Student not found");
  if (!term) throw ApiError.notFound("Term not found");

  // The report card carries the school's crest, motto and head teacher's name.
  // It must be the pupil's own school, and the term must belong to it too —
  // otherwise a term id from elsewhere would print another school's session on
  // this child's certificate.
  if (term.schoolId !== student.schoolId) throw ApiError.notFound("Term not found");
  const school = await prisma.school.findUnique({ where: { id: student.schoolId } });
  if (!school) throw ApiError.notFound("School not configured");

  const [result, attendance, report] = await Promise.all([
    computeStudentResult(studentId, termId),
    attendanceSummary(studentId, termId),
    prisma.termReport.findUnique({ where: { studentId_termId: { studentId, termId } } }),
  ]);
  if (result.subjects.length === 0) {
    throw ApiError.notFound("No results have been recorded for this student in the selected term");
  }

  return {
    school: {
      name: school.name,
      motto: school.motto,
      address: school.address,
      phone: school.phone,
      email: school.email,
      logoUrl: school.logoUrl,
      headTeacherName: school.headTeacherName,
    },
    student: {
      fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      admissionNo: student.admissionNo,
      gender: student.gender,
      passportUrl: student.passportUrl,
      className: student.classRoom ? `${student.classRoom.name}${student.classRoom.section ? ` ${student.classRoom.section}` : ""}` : "—",
    },
    session: term.session.name,
    term: term.name,
    result,
    attendance,
    teacherComment: report?.teacherComment ?? null,
    headTeacherComment: report?.headTeacherComment ?? null,
  };
}

// GET /report-cards/:studentId/access?termId= — UI checks lock state up-front
router.get(
  "/:studentId/access",
  authenticate,
  asyncHandler(async (req, res) => {
    await assertCanAccessStudent(req, req.params.studentId);
    const termId = String(req.query.termId ?? "");
    if (!termId) throw ApiError.badRequest("termId is required");
    const balance = await getFeeBalance(req.params.studentId, termId);
    const isStaff = (STAFF as Role[]).includes(req.auth!.role);
    res.json({
      success: true,
      data: {
        allowed: isStaff || balance.fullyPaid,
        outstanding: balance.outstanding,
        message: isStaff || balance.fullyPaid ? null : REPORT_CARD_LOCK_MESSAGE,
      },
    });
  })
);

// GET /report-cards/:studentId/data?termId= — JSON used by the printable HTML view
router.get(
  "/:studentId/data",
  authenticate,
  asyncHandler(async (req, res) => {
    await assertCanAccessStudent(req, req.params.studentId);
    const termId = String(req.query.termId ?? "");
    if (!termId) throw ApiError.badRequest("termId is required");
    await enforceFeeLock(req.auth!.role, req.params.studentId, termId);
    const data = await buildReportData(req.params.studentId, termId);
    res.json({ success: true, data });
  })
);

// GET /report-cards/:studentId/pdf?termId= — downloadable/printable PDF
router.get(
  "/:studentId/pdf",
  authenticate,
  asyncHandler(async (req, res) => {
    await assertCanAccessStudent(req, req.params.studentId);
    const termId = String(req.query.termId ?? "");
    if (!termId) throw ApiError.badRequest("termId is required");
    await enforceFeeLock(req.auth!.role, req.params.studentId, termId);

    const data = await buildReportData(req.params.studentId, termId);
    const sig = reportSignature(req.params.studentId, termId);
    const verifyUrl = `${env.corsOrigins[0]}/verify-report?sid=${req.params.studentId}&tid=${termId}&sig=${sig}`;
    const pdf = await renderReportCard(data, verifyUrl);

    audit(req, "report_card.download", "Student", req.params.studentId, { termId });
    res
      .status(200)
      .setHeader("Content-Type", "application/pdf")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="report-card-${data.student.admissionNo.replace(/\//g, "-")}-${data.term.replace(/\s/g, "-")}.pdf"`
      )
      .send(pdf);
  })
);

// GET /report-cards/class/:classRoomId/pdf?termId= — bulk PDF (all students in class, staff only)
router.get(
  "/class/:classRoomId/pdf",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!(STAFF as Role[]).includes(req.auth!.role)) throw ApiError.forbidden("Staff only");
    const termId = String(req.query.termId ?? "");
    if (!termId) throw ApiError.badRequest("termId is required");

    const schoolId = currentSchoolId(req);
    const cls = await prisma.classRoom.findUnique({
      where: { id: req.params.classRoomId },
      select: { schoolId: true, name: true },
    });
    if (!cls || cls.schoolId !== schoolId) throw ApiError.notFound("Class not found");

    const students = await prisma.student.findMany({
      where: { schoolId, classRoomId: req.params.classRoomId, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
    });
    if (students.length === 0) throw ApiError.notFound("No active students in this class");

    const PDFMerger = (await import("pdf-merger-js")).default;
    const merger = new PDFMerger();

    for (const student of students) {
      try {
        const data = await buildReportData(student.id, termId);
        const sig = reportSignature(student.id, termId);
        const verifyUrl = `${env.corsOrigins[0]}/verify-report?sid=${student.id}&tid=${termId}&sig=${sig}`;
        const pdf = await renderReportCard(data, verifyUrl);
        await merger.add(pdf);
      } catch {
        // Skip students with no results recorded
      }
    }

    const merged = await merger.saveAsBuffer();
    const term = await prisma.term.findUnique({ where: { id: termId }, select: { name: true } });
    audit(req, "report_card.class_download", "ClassRoom", req.params.classRoomId, { termId });
    res
      .setHeader("Content-Type", "application/pdf")
      .setHeader("Content-Disposition", `attachment; filename="report-cards-${(cls?.name ?? "class").replace(/\s/g, "-")}-${(term?.name ?? "term").replace(/\s/g, "-")}.pdf"`)
      .send(merged);
  })
);

// GET /report-cards/verify?sid=&tid=&sig= — public QR verification endpoint
router.get(
  "/verify",
  asyncHandler(async (req, res) => {
    const { sid, tid, sig } = req.query as Record<string, string>;
    if (!sid || !tid || !sig) throw ApiError.badRequest("Invalid verification link");
    if (reportSignature(sid, tid) !== sig) {
      return res.json({ success: true, data: { valid: false } });
    }
    const [student, term] = await Promise.all([
      prisma.student.findUnique({ where: { id: sid }, include: { classRoom: true, school: { select: { name: true } } } }),
      prisma.term.findUnique({ where: { id: tid }, include: { session: true } }),
    ]);
    if (!student || !term) return res.json({ success: true, data: { valid: false } });
    // A pupil and a term from different schools is never a real report card.
    if (term.schoolId !== student.schoolId) return res.json({ success: true, data: { valid: false } });

    res.json({
      success: true,
      data: {
        valid: true,
        // Naming the school matters once several use the system: whoever is
        // checking the certificate needs to see which school issued it.
        school: student.school.name,
        student: `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        className: student.classRoom?.name ?? "—",
        term: `${term.name}, ${term.session.name}`,
      },
    });
  })
);

export default router;
