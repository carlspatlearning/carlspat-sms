import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { authenticate, assertCanAccessStudent, STAFF } from "../middleware/auth";
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
  const [student, term, school] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { classRoom: true },
    }),
    prisma.term.findUnique({ where: { id: termId }, include: { session: true } }),
    prisma.school.findFirst(),
  ]);
  if (!student) throw ApiError.notFound("Student not found");
  if (!term) throw ApiError.notFound("Term not found");
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
      prisma.student.findUnique({ where: { id: sid }, include: { classRoom: true } }),
      prisma.term.findUnique({ where: { id: tid }, include: { session: true } }),
    ]);
    if (!student || !term) return res.json({ success: true, data: { valid: false } });
    res.json({
      success: true,
      data: {
        valid: true,
        student: `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        className: student.classRoom?.name ?? "—",
        term: `${term.name}, ${term.session.name}`,
      },
    });
  })
);

export default router;
