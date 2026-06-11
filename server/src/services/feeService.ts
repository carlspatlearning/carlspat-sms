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

  const [structures, waivers, payments] = await Promise.all([
    student.classRoomId
      ? prisma.feeStructure.findMany({
          where: { termId, classRoomId: student.classRoomId },
          include: { category: true },
        })
      : Promise.resolve([]),
    prisma.feeWaiver.aggregate({ where: { studentId, termId }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { studentId, termId, status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
    }),
  ]);

  const expected = structures.reduce((sum, s) => sum + Number(s.amount), 0);
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
    items: structures.map((s) => ({
      category: s.category.name,
      amount: Number(s.amount),
      dueDate: s.dueDate?.toISOString() ?? null,
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
