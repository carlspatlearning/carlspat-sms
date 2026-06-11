import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function fullName(p: { firstName: string; lastName: string; middleName?: string | null }): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "School Admin",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
  ACCOUNTANT: "Bursar",
};
