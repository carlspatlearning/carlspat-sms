import { Router } from "express";
import { PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/error";
import { authenticate, authorize, STAFF } from "../middleware/auth";
import { getFeeBalance } from "../services/feeService";
import { expensesInTerm } from "../utils/expenseScope";

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
      const students = await prisma.student.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, classRoomId: true },
      });
      const studentIds = students.map((s) => s.id);

      const [structures, itemsByStudent, waiversByStudent, paidByStudent, allPaid, expenditureAgg] =
        await Promise.all([
          prisma.feeStructure.groupBy({
            by: ["classRoomId"],
            where: { termId: term.id },
            _sum: { amount: true },
          }),
          // Per-student billing overrides the class structure, exactly as
          // getFeeBalance does — otherwise students on bespoke fees are costed wrong.
          prisma.studentFeeItem.groupBy({
            by: ["studentId"],
            where: { termId: term.id, studentId: { in: studentIds } },
            _sum: { amount: true },
          }),
          prisma.feeWaiver.groupBy({
            by: ["studentId"],
            where: { termId: term.id, studentId: { in: studentIds } },
            _sum: { amount: true },
          }),
          prisma.payment.groupBy({
            by: ["studentId"],
            where: { termId: term.id, status: PaymentStatus.SUCCESS, studentId: { in: studentIds } },
            _sum: { amount: true },
          }),
          // Cash actually received this term, including from students who have
          // since graduated. This is income, not fee collection.
          prisma.payment.aggregate({
            where: { termId: term.id, status: PaymentStatus.SUCCESS },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: expensesInTerm(term),
            _sum: { amount: true },
          }),
        ]);

      const perClass = new Map(structures.map((s) => [s.classRoomId, Number(s._sum.amount ?? 0)]));
      const sumBy = (rows: { studentId: string; _sum: { amount: unknown } }[]) =>
        new Map(rows.map((r) => [r.studentId, Number(r._sum.amount ?? 0)]));
      const ownItems = sumBy(itemsByStudent);
      const waivedFor = sumBy(waiversByStudent);
      const paidFor = sumBy(paidByStudent);

      let expected = 0;
      let waived = 0;
      let collected = 0;
      let outstanding = 0;
      for (const s of students) {
        const billed = ownItems.get(s.id) ?? (s.classRoomId ? perClass.get(s.classRoomId) ?? 0 : 0);
        const discount = waivedFor.get(s.id) ?? 0;
        const paid = paidFor.get(s.id) ?? 0;
        expected += billed;
        waived += discount;
        collected += paid;
        // Floor each student at zero before summing: a family in credit must not
        // cancel out a family in debt, or the school looks fully paid up when
        // dozens still owe.
        outstanding += Math.max(0, billed - discount - paid);
      }

      const collectable = expected - waived;
      const expenditure = Number(expenditureAgg._sum.amount ?? 0);
      const income = Number(allPaid._sum.amount ?? 0);
      feeStats = {
        expected,
        collected,
        waived,
        outstanding,
        collectionRate: collectable > 0 ? Math.round((collected / collectable) * 1000) / 10 : 0,
      };
      finance = { income, expenditure, balance: income - expenditure };
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
