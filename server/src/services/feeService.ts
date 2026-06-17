import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export interface FeeBalance {
  studentId: string;
  termId: string;
  expected: number;
  waived: number;
  paid: number;
  outstanding: number;
  fullyPaid: boolean;
  items: { category: string; amount: number; dueDate: string | null }[];
}

/**
 * Compute a student's fee position for a term:
 *   expected = Σ fee structure for the student's class + term
 *   outstanding = expected − waivers − successful payments
 */
export async function getFeeBalance(studentId: string, termId: string): Promise<FeeBalance> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classRoomId: true },
  });
  if (!student) throw ApiError.notFound("Student not found");

  // Per-student assignments take priority over class-wide fee structures.
  // If the student has no explicit assignments yet, fall back to the class structure
  // so existing data continues to work before the admin migrates to per-student billing.
  const [studentItems, waivers, payments] = await Promise.all([
    prisma.studentFeeItem.findMany({
      where: { studentId, termId },
      include: { category: true },
    }),
    prisma.feeWaiver.aggregate({ where: { studentId, termId }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { studentId, termId, status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
    }),
  ]);

  type LineItem = { amount: { toNumber(): number } | number; category: { name: string }; dueDate?: Date | null };
  let items: LineItem[];
  if (studentItems.length > 0) {
    items = studentItems;
  } else {
    items = student.classRoomId
      ? await prisma.feeStructure.findMany({
          where: { termId, classRoomId: student.classRoomId },
          include: { category: true },
        })
      : [];
  }

  const expected = items.reduce((sum, s) => sum + (typeof s.amount === "number" ? s.amount : s.amount.toNumber()), 0);
  const waived = Number(waivers._sum.amount ?? 0);
  const paid = Number(payments._sum.amount ?? 0);
  const outstanding = Math.max(0, expected - waived - paid);

  return {
    studentId,
    termId,
    expected,
    waived,
    paid,
    outstanding,
    fullyPaid: outstanding <= 0,
    items: items.map((s) => ({
      category: s.category.name,
      amount: typeof s.amount === "number" ? s.amount : s.amount.toNumber(),
      dueDate: s.dueDate ? s.dueDate.toISOString() : null,
    })),
  };
}

export const REPORT_CARD_LOCK_MESSAGE =
  "Access to report card is restricted until school fees have been fully paid.";

/**
 * Business rule: report cards are inaccessible while any balance is outstanding.
 * Staff (admin/teacher/accountant) bypass the lock; parents/students do not.
 */
export async function assertReportCardUnlocked(studentId: string, termId: string): Promise<FeeBalance> {
  const balance = await getFeeBalance(studentId, termId);
  if (!balance.fullyPaid) {
    throw ApiError.paymentRequired(REPORT_CARD_LOCK_MESSAGE);
  }
  return balance;
}
