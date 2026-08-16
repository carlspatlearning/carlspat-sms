import { Router } from "express";
import { z } from "zod";
import { AttendanceStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, assertCanAccessStudent, ADMINS } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";

const router = Router();
router.use(authenticate, requireActiveSchool);

/** Teachers may only mark classes they form-teach or teach a subject in. */
async function assertTeacherOwnsClass(userId: string, classRoomId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: { formClasses: { select: { id: true } }, classSubjects: { select: { classRoomId: true } } },
  });
  if (!teacher) throw ApiError.forbidden("Teacher profile not found");
  const allowed =
    teacher.formClasses.some((c) => c.id === classRoomId) ||
    teacher.classSubjects.some((cs) => cs.classRoomId === classRoomId);
  if (!allowed) throw ApiError.forbidden("You are not assigned to this class");
}

// POST /attendance/mark — bulk mark a class for one day
router.post(
  "/mark",
  authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN),
  validate(
    z.object({
      body: z.object({
        classRoomId: z.string(),
        date: z.coerce.date(),
        records: z
          .array(
            z.object({
              studentId: z.string(),
              status: z.nativeEnum(AttendanceStatus),
              remark: z.string().optional(),
            })
          )
          .min(1),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { classRoomId, date, records } = req.body as {
      classRoomId: string;
      date: Date;
      records: { studentId: string; status: AttendanceStatus; remark?: string }[];
    };
    const schoolId = currentSchoolId(req);
    if (req.auth!.role === Role.TEACHER) await assertTeacherOwnsClass(req.auth!.sub, classRoomId);

    const classRoom = await prisma.classRoom.findUnique({ where: { id: classRoomId }, select: { schoolId: true } });
    if (!classRoom || classRoom.schoolId !== schoolId) throw ApiError.notFound("Class not found");

    const term = await prisma.term.findFirst({ where: { isCurrent: true, schoolId } });
    if (!term) throw ApiError.badRequest("No current term configured");

    // Pupil ids arrive in the request body. Confirm every one is in this class
    // at this school before writing a register — an unchecked id would create
    // an attendance row against another school's pupil.
    const studentIds = records.map((r) => r.studentId);
    const valid = await prisma.student.findMany({
      where: { schoolId, classRoomId, id: { in: studentIds } },
      select: { id: true },
    });
    if (valid.length !== new Set(studentIds).size) {
      throw ApiError.notFound("One or more of those students are not in this class");
    }

    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);

    await prisma.$transaction(
      records.map((r) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: r.studentId, date: day } },
          update: { status: r.status, remark: r.remark, markedById: req.auth!.sub },
          create: {
            studentId: r.studentId,
            classRoomId,
            termId: term.id,
            date: day,
            status: r.status,
            remark: r.remark,
            markedById: req.auth!.sub,
          },
        })
      )
    );
    audit(req, "attendance.mark", "ClassRoom", classRoomId, { date: day.toISOString(), count: records.length });
    res.json({ success: true, message: `Attendance saved for ${records.length} student(s)` });
  })
);

// GET /attendance/class/:classRoomId?date=YYYY-MM-DD — a class register for one day
router.get(
  "/class/:classRoomId",
  authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const date = new Date(String(req.query.date ?? new Date().toISOString().slice(0, 10)));
    date.setUTCHours(0, 0, 0, 0);

    const classRoom = await prisma.classRoom.findUnique({
      where: { id: req.params.classRoomId },
      select: { schoolId: true },
    });
    if (!classRoom || classRoom.schoolId !== schoolId) throw ApiError.notFound("Class not found");

    const [students, records] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, classRoomId: req.params.classRoomId, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, admissionNo: true, passportUrl: true },
        orderBy: { lastName: "asc" },
      }),
      prisma.attendance.findMany({
        where: { classRoomId: req.params.classRoomId, date, student: { schoolId } },
      }),
    ]);
    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    res.json({
      success: true,
      data: students.map((s) => ({
        ...s,
        status: byStudent.get(s.id)?.status ?? null,
        remark: byStudent.get(s.id)?.remark ?? null,
      })),
    });
  })
);

// GET /attendance/student/:studentId?termId=&from=&to= — history + summary
router.get(
  "/student/:studentId",
  asyncHandler(async (req, res) => {
    await assertCanAccessStudent(req, req.params.studentId);
    const { termId, from, to } = req.query as Record<string, string | undefined>;
    const where = {
      studentId: req.params.studentId,
      ...(termId ? { termId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    };
    const records = await prisma.attendance.findMany({ where, orderBy: { date: "desc" }, take: 200 });
    const count = (s: AttendanceStatus) => records.filter((r) => r.status === s).length;
    res.json({
      success: true,
      data: {
        records,
        summary: {
          present: count(AttendanceStatus.PRESENT),
          late: count(AttendanceStatus.LATE),
          absent: count(AttendanceStatus.ABSENT),
          total: records.length,
        },
      },
    });
  })
);

// GET /attendance/report?classRoomId=&from=&to= — daily/weekly/monthly analytics
router.get(
  "/report",
  authorize(...ADMINS, Role.TEACHER),
  asyncHandler(async (req, res) => {
    const { classRoomId, from, to } = req.query as Record<string, string | undefined>;
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 29 * 86400000);

    // classRoomId is optional here, so without a school filter the default view
    // would aggregate every school's attendance into one school's report.
    const records = await prisma.attendance.findMany({
      where: {
        student: { schoolId: currentSchoolId(req) },
        ...(classRoomId ? { classRoomId } : {}),
        date: { gte: fromDate, lte: toDate },
      },
      select: { date: true, status: true },
      orderBy: { date: "asc" },
    });

    // Aggregate per day
    const byDay = new Map<string, { present: number; late: number; absent: number }>();
    for (const r of records) {
      const key = r.date.toISOString().slice(0, 10);
      const day = byDay.get(key) ?? { present: 0, late: 0, absent: 0 };
      if (r.status === "PRESENT") day.present++;
      else if (r.status === "LATE") day.late++;
      else day.absent++;
      byDay.set(key, day);
    }
    const days = [...byDay.entries()].map(([date, counts]) => {
      const total = counts.present + counts.late + counts.absent;
      return { date, ...counts, total, rate: total ? Math.round(((counts.present + counts.late) / total) * 1000) / 10 : 0 };
    });
    const totals = days.reduce(
      (acc, d) => ({ present: acc.present + d.present, late: acc.late + d.late, absent: acc.absent + d.absent }),
      { present: 0, late: 0, absent: 0 }
    );
    const grandTotal = totals.present + totals.late + totals.absent;
    res.json({
      success: true,
      data: {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
        days,
        totals: {
          ...totals,
          total: grandTotal,
          attendanceRate: grandTotal ? Math.round(((totals.present + totals.late) / grandTotal) * 1000) / 10 : 0,
        },
      },
    });
  })
);

export default router;
