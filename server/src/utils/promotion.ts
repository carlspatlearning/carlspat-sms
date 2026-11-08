export type PromotionDecision = "PROMOTED" | "REPEAT";

const PROMOTION_THRESHOLD = 50;

/** Promotion decisions belong exclusively to Third Term report cards. */
export function promotionDecisionForTerm(
  termName: string | undefined,
  average: number,
  hasScores: boolean
): PromotionDecision | null {
  if (termName?.trim().toLowerCase() !== "third term" || !hasScores) return null;
  return average >= PROMOTION_THRESHOLD ? "PROMOTED" : "REPEAT";
}
