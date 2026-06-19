import { Router } from "express";
import { PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/error";
import { authenticate, authorize, STAFF } from "../middleware/auth";
import { getFeeBalance } from "../services/feeService";

const router = Router();
router.use(authenticate);

// GET /dashboard/stats — headline analytics for staff dashboards
router.get(
  "/stats",
  authorize(...STAFF),
  asyncHandler(async (req, res) => {
    const term = await prisma.term.findFirst({ where: { isCurrent: true }, include: { session: true } });

    const [totalStudents, totalTeachers, totalParents, totalClasses] = await Promise.all([
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.teacher.count(),
      prisma.parent.count(),
      prisma.classRoom.count(),
    ]);

    // Attendance rate over the last 30 days
    const since = new Date(Date.now() - 30 * 86400000);
    const attendance = await prisma.attendance.groupBy({
      by: ["status"],
      where: { date: { gte: since } },
      _count: { _all: true },
    });
    const att = (s: string) => attendance.find((a) => a.status === s)?._count._all ?? 0;
    const attTotal = att("PRESENT") + att("LATE") + att("ABSENT");
    const attendanceRate = attTotal ? Math.round(((att("PRESENT") + att("LATE")) / attTotal) * 1000) / 10 : 0;

    // Fee collection for the current term — only computed for finance roles
    const canSeeFinance = ([Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT] as Role[]).includes(req.auth!.role);
    let feeStats: { expected: number; collected: number; waived: number; outstanding: number; collectionRate: number } | null = null;
    let finance: { income: number; expenditure: number; balance: number } | null = null;
    if (term && canSeeFinance) {
      const [collected, waivedAgg, expenditureAgg] = await Promise.all([
        prisma.payment.aggregate({
          where: { termId: term.id, status: PaymentStatus.SUCCESS },
          _sum: { amount: true },
        }),
        prisma.feeWaiver.aggregate({
          where: { termId: term.id },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { termId: term.id },
          _sum: { amount: true },
        }),
      ]);
      // Expected = Σ per-student class fee structures
      const students = await prisma.student.findMany({
        where: { status: "ACTIVE", classRoomId: { not: null } },
        select: { classRoomId: true },
      });
      const structures = await prisma.feeStructure.groupBy({
        by: ["classRoomId"],
        where: { termId: term.id },
        _sum: { amount: true },
      });
      const perClass = new Map(structures.map((s) => [s.classRoomId, Number(s._sum.amount ?? 0)]));
      const expected = students.reduce((sum, s) => sum + (perClass.get(s.classRoomId!) ?? 0), 0);
      const collectedNum = Number(collected._sum.amount ?? 0);
      const waived = Number(waivedAgg._sum.amount ?? 0);
      const expenditure = Number(expenditureAgg._sum.amount ?? 0);
      feeStats = {
        expected,
        collected: collectedNum,
        waived,
        outstanding: Math.max(0, expected - waived - collectedNum),
        collectionRate: expected ? Math.round((collectedNum / expected) * 1000) / 10 : 0,
      };
      finance = { income: collectedNum, expenditure, balance: collectedNum - expenditure };
    }

    // Academic performance: average score % per class for the current term
    let classPerformance: { classRoomId: string; className: string; average: number; students: number }[] = [];
    if (term) {
      const classes = await prisma.classRoom.findMany({
        select: { id: true, name: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
        orderBy: { level: "asc" },
      });
      const maxTotalAgg = await prisma.assessmentType.aggregate({ where: { isActive: true }, _sum: { maxScore: true } });
      const maxTotal = maxTotalAgg._sum.maxScore ?? 100;
      for (const c of classes) {
        const agg = await prisma.score.aggregate({
          where: { termId: term.id, student: { classRoomId: c.id } },
          _avg: { score: true },
          _count: { _all: true },
        });
        // _avg is per-assessment; scale to percentage of subject total
        const perAssessmentAvg = agg._avg.score ?? 0;
        const assessmentCount = await prisma.assessmentType.count({ where: { isActive: true } });
        const average = agg._count._all
          ? Math.round(((perAssessmentAvg * assessmentCount) / maxTotal) * 1000) / 10
          : 0;
        classPerformance.push({ classRoomId: c.id, className: c.name, average, students: c._count.students });
      }
    }

    res.json({
      success: true,
      data: {
        currentTerm: term ? { id: term.id, name: term.name, session: term.session.name } : null,
        totals: { students: totalStudents, teachers: totalTeachers, parents: totalParents, classes: totalClasses },
        attendanceRate,
        ...(feeStats !== null ? { fees: feeStats, finance } : {}),
        classPerformance,
      },
    });
  })
);

// GET /dashboard/me — lightweight stats for parent/student dashboards
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const term = await prisma.term.findFirst({ where: { isCurrent: true }, include: { session: true } });
    const role = req.auth!.role;

    if (role === Role.PARENT) {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.auth!.sub },
        include: { students: { include: { classRoom: { select: { name: true } } } } },
      });
      const children = [];
      for (const s of parent?.students ?? []) {
        const balance = term ? await getFeeBalance(s.id, term.id) : null;
        children.push({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          admissionNo: s.admissionNo,
          className: s.classRoom?.name ?? "—",
          passportUrl: s.passportUrl,
          outstanding: balance?.outstanding ?? 0,
          fullyPaid: balance?.fullyPaid ?? false,
        });
      }
      return res.json({ success: true, data: { currentTerm: term, children } });
    }

    if (role === Role.STUDENT) {
      const student = await prisma.student.findUnique({
        where: { userId: req.auth!.sub },
        include: { classRoom: { select: { id: true, name: true } } },
      });
      const balance = student && term ? await getFeeBalance(student.id, term.id) : null;
      return res.json({
        success: true,
        data: {
          currentTerm: term,
          student: student
            ? {
                id: student.id,
                admissionNo: student.admissionNo,
                className: student.classRoom?.name ?? "—",
                outstanding: balance?.outstanding ?? 0,
                fullyPaid: balance?.fullyPaid ?? false,
              }
            : null,
        },
      });
    }

    res.json({ success: true, data: { currentTerm: term } });
  })
);

export default router;
