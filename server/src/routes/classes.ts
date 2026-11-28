import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import PDFDocument from "pdfkit";

const router = Router();
router.use(authenticate, requireActiveSchool);

// GET /classes — all roles need the class list (dropdowns etc.)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const classes = await prisma.classRoom.findMany({
      where: { schoolId: currentSchoolId(req) },
      include: {
        formTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { students: true, classSubjects: true } },
      },
      orderBy: { level: "asc" },
    });
    res.json({ success: true, data: classes });
  })
);

const classBody = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1),
  section: z.string().nullable().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  formTeacherId: z.string().nullable().optional(),
});

router.post(
  "/",
  authorize(...ADMINS),
  validate(z.object({ body: classBody })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { formTeacherId } = req.body as { formTeacherId?: string | null };
    if (formTeacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: formTeacherId }, select: { schoolId: true } });
      if (!teacher || teacher.schoolId !== schoolId) throw ApiError.notFound("Teacher not found");
    }
    const created = await prisma.classRoom.create({ data: { ...req.body, schoolId } });
    audit(req, "class.create", "ClassRoom", created.id);
    res.status(201).json({ success: true, data: created });
  })
);

// GET /classes/:id — detail with students and subject assignments
router.get(
  "/:id/students.pdf",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const cls = await prisma.classRoom.findUnique({ where: { id: req.params.id }, select: { id: true, schoolId: true, name: true, section: true } });
    if (!cls || cls.schoolId !== schoolId) throw ApiError.notFound("Class not found");
    const students = await prisma.student.findMany({
      where: { schoolId, classRoomId: cls.id, status: "ACTIVE" },
      select: { firstName: true, middleName: true, lastName: true, admissionNo: true, gender: true, dateOfBirth: true, parent: { select: { user: { select: { phone: true } } } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
    const left = 32, width = doc.page.width - left * 2, columns = [30, 185, 120, 65, 90, width - 490];
    const headers = ["#", "Student name", "Admission No.", "Gender", "Date of birth", "Parent phone"];
    const title = `${cls.name}${cls.section ? ` ${cls.section}` : ""}`;
    function header() {
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(17).text((school?.name ?? "School").toUpperCase(), left, 30, { width, align: "center" });
      doc.fontSize(12).text(`${title} — STUDENT ROSTER`, left, 57, { width, align: "center" });
      doc.fillColor("#374151").font("Helvetica").fontSize(9).text(`Total active students: ${students.length}  |  Generated: ${new Date().toLocaleDateString("en-GB")}`, left, 77, { width, align: "center" });
    }
    function tableHeader(y: number) {
      doc.rect(left, y, width, 22).fill("#1e3a5f"); doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8);
      let x = left + 4; headers.forEach((h, i) => { doc.text(h, x, y + 7, { width: columns[i] - 8, lineBreak: false }); x += columns[i]; });
    }
    header(); let y = 105; tableHeader(y); y += 22;
    students.forEach((s, index) => {
      if (y + 22 > doc.page.height - 38) { doc.addPage({ size: "A4", layout: "landscape", margin: 32 }); header(); y = 105; tableHeader(y); y += 22; }
      if (index % 2) doc.rect(left, y, width, 22).fill("#f3f4f6");
      const values = [String(index + 1), [s.lastName, s.firstName, s.middleName].filter(Boolean).join(" "), s.admissionNo, s.gender, s.dateOfBirth.toLocaleDateString("en-GB"), s.parent?.user.phone ?? "—"];
      doc.fillColor("#111827").font("Helvetica").fontSize(8); let x = left + 4;
      values.forEach((v, i) => { doc.text(v, x, y + 7, { width: columns[i] - 8, lineBreak: false }); x += columns[i]; });
      doc.moveTo(left, y + 22).lineTo(left + width, y + 22).strokeColor("#e5e7eb").lineWidth(0.4).stroke(); y += 22;
    });
    const pages = doc.bufferedPageRange();
    for (let page = 0; page < pages.count; page++) { doc.switchToPage(page); doc.fillColor("#6b7280").fontSize(7).text(`${school?.name ?? "School"} — Confidential`, left, doc.page.height - 22, { width: width / 2 }).text(`Page ${page + 1} of ${pages.count}`, left, doc.page.height - 22, { width, align: "right" }); }
    doc.end(); const pdf = await finished;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-z0-9]+/gi, "-")}-students.pdf"`);
    res.send(pdf);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const cls = await prisma.classRoom.findUnique({
      where: { id: req.params.id },
      include: {
        formTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, firstName: true, lastName: true, admissionNo: true, gender: true, passportUrl: true },
          orderBy: { lastName: "asc" },
        },
        classSubjects: {
          include: {
            subject: true,
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!cls || cls.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Class not found");
    res.json({ success: true, data: cls });
  })
);

router.put(
  "/:id",
  authorize(...ADMINS),
  validate(z.object({ body: classBody.partial() })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.classRoom.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Class not found");

    const updated = await prisma.classRoom.update({ where: { id: req.params.id }, data: req.body });
    audit(req, "class.update", "ClassRoom", updated.id);
    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const existing = await prisma.classRoom.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Class not found");

    const count = await prisma.student.count({ where: { classRoomId: req.params.id } });
    if (count > 0) throw ApiError.conflict(`Cannot delete: ${count} student(s) are assigned to this class`);
    await prisma.classRoom.delete({ where: { id: req.params.id } });
    audit(req, "class.delete", "ClassRoom", req.params.id);
    res.json({ success: true, message: "Class deleted" });
  })
);

// PUT /classes/:id/subjects — assign subjects (and teachers) to a class
router.put(
  "/:id/subjects",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        assignments: z.array(z.object({ subjectId: z.string(), teacherId: z.string().nullable().optional() })),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const classRoomId = req.params.id;
    const { assignments } = req.body as { assignments: { subjectId: string; teacherId?: string | null }[] };

    const cls = await prisma.classRoom.findUnique({ where: { id: classRoomId }, select: { schoolId: true } });
    if (!cls || cls.schoolId !== schoolId) throw ApiError.notFound("Class not found");

    // Subject and teacher ids both arrive in the body. Verifying them here stops
    // another school's subject or teacher being wired into this timetable.
    const subjectIds = [...new Set(assignments.map((a) => a.subjectId))];
    const teacherIds = [...new Set(assignments.map((a) => a.teacherId).filter((t): t is string => Boolean(t)))];
    const [subjects, teachers] = await Promise.all([
      prisma.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true } }),
      prisma.teacher.findMany({ where: { schoolId, id: { in: teacherIds } }, select: { id: true } }),
    ]);
    if (subjects.length !== subjectIds.length) throw ApiError.notFound("One or more subjects were not found");
    if (teachers.length !== teacherIds.length) throw ApiError.notFound("One or more teachers were not found");

    await prisma.$transaction(async (tx) => {
      await tx.classSubject.deleteMany({
        where: { classRoomId, subjectId: { notIn: assignments.map((a) => a.subjectId) } },
      });
      for (const a of assignments) {
        await tx.classSubject.upsert({
          where: { classRoomId_subjectId: { classRoomId, subjectId: a.subjectId } },
          update: { teacherId: a.teacherId ?? null },
          create: { classRoomId, subjectId: a.subjectId, teacherId: a.teacherId ?? null },
        });
      }
    });
    audit(req, "class.subjects_update", "ClassRoom", classRoomId);
    res.json({ success: true, message: "Class subjects updated" });
  })
);

export default router;
