import type { Prisma, Term } from "@prisma/client";

/**
 * Which expenses belong to a term.
 *
 * `Expense.termId` is optional and the expense form does not ask for it, so in
 * practice most rows are saved untagged. Filtering on `termId` alone therefore
 * reports zero spending for schools that have been recording expenses all along.
 * Fall back to the expense date landing inside the term.
 */
export function expensesInTerm(term: Pick<Term, "id" | "startDate" | "endDate">): Prisma.ExpenseWhereInput {
  return {
    OR: [
      { termId: term.id },
      { termId: null, date: { gte: term.startDate, lte: term.endDate } },
    ],
  };
}
