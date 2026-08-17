import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

/**
 * Each school numbers its own pupils and receipts, starting at 1. The prefix is
 * part of the school's identity, so it is read from the school rather than
 * hardcoded — otherwise every school's paperwork would say "CPS".
 */
async function prefixFor(schoolId: string): Promise<string> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { numberPrefix: true },
  });
  if (!school) throw ApiError.notFound("School not found");
  return school.numberPrefix;
}

/**
 * Generate the next sequential admission number: CPS/<year>/0001.
 *
 * Scoped to one school: two schools admitting a pupil on the same day must each
 * get their own 0001, and neither may see the other's numbering.
 */
export async function nextAdmissionNo(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${await prefixFor(schoolId)}/${year}/`;
  const last = await prisma.student.findFirst({
    where: { schoolId, admissionNo: { startsWith: prefix } },
    orderBy: { admissionNo: "desc" },
    select: { admissionNo: true },
  });
  const lastSeq = last ? parseInt(last.admissionNo.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

/**
 * Generate the next staff number: CPS/STF/001.
 *
 * Derived from the highest existing number rather than a row count, so numbers
 * are not reused after a teacher is removed — reusing one would attach a new
 * member of staff to a departed colleague's paperwork.
 */
export async function nextStaffNo(schoolId: string): Promise<string> {
  const prefix = `${await prefixFor(schoolId)}/STF/`;
  const last = await prisma.teacher.findFirst({
    where: { schoolId, staffNo: { startsWith: prefix } },
    orderBy: { staffNo: "desc" },
    select: { staffNo: true },
  });
  const lastSeq = last ? parseInt(last.staffNo.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(3, "0")}`;
}

/**
 * Generate the next receipt number: CPS-RCP-<year>-00001.
 *
 * Only confirmed payments hold a receipt number, so pending checkouts (which
 * have a null receiptNo) are skipped by the prefix filter and never create a
 * gap. Two callers can still read the same maximum, so the caller must handle
 * the unique-constraint violation and retry — see confirmGatewayPayment.
 */
export async function nextReceiptNo(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${await prefixFor(schoolId)}-RCP-${year}-`;
  const last = await prisma.payment.findFirst({
    where: { schoolId, receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  });
  const lastSeq = last?.receiptNo ? parseInt(last.receiptNo.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(5, "0")}`;
}
