import { promotionDecisionForTerm } from "../src/utils/promotion";

describe("promotionDecisionForTerm", () => {
  it.each(["First Term", "Second Term"])("does not stamp a %s report", (termName) => {
    expect(promotionDecisionForTerm(termName, 80, true)).toBeNull();
    expect(promotionDecisionForTerm(termName, 40, true)).toBeNull();
  });

  it("stamps promoted or repeat on Third Term reports", () => {
    expect(promotionDecisionForTerm("Third Term", 50, true)).toBe("PROMOTED");
    expect(promotionDecisionForTerm("Third Term", 49.9, true)).toBe("REPEAT");
  });

  it("does not stamp an empty Third Term report", () => {
    expect(promotionDecisionForTerm("Third Term", 0, false)).toBeNull();
  });

  it("handles harmless term-name whitespace and casing differences", () => {
    expect(promotionDecisionForTerm("  THIRD TERM  ", 75, true)).toBe("PROMOTED");
  });
});
