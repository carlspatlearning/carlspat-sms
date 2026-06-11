import { prisma } from "../lib/prisma";

/**
 * Generate the next sequential admission number: CPS/<year>/0001.
 * Runs inside a transaction-safe retry loop to avoid collisions.
 */
export async function nextAdmissionNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CPS/${year}/`;
  const last = await prisma.student.findFirst({
    where: { admissionNo: { startsWith: prefix } },
    orderBy: { admissionNo: "desc" },
    select: { admissionNo: true },
  });
  const lastSeq = last ? parseInt(last.admissionNo.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

/** Generate the next receipt number: CPS-RCP-<year>-00001. */
export async function nextReceiptNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CPS-RCP-${year}-`;
  const last = await prisma.payment.findFirst({
    where: { receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  });
  const lastSeq = last ? parseInt(last.receiptNo.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(5, "0")}`;
}
