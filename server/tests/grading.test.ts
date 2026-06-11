import { resolveGrade, ordinal, GradeBand } from "../src/utils/grading";

const scale: GradeBand[] = [
  { minScore: 70, maxScore: 100, grade: "A", remark: "Excellent" },
  { minScore: 60, maxScore: 69, grade: "B", remark: "Very Good" },
  { minScore: 50, maxScore: 59, grade: "C", remark: "Good" },
  { minScore: 45, maxScore: 49, grade: "D", remark: "Fair" },
  { minScore: 40, maxScore: 44, grade: "E", remark: "Pass" },
  { minScore: 0, maxScore: 39, grade: "F", remark: "Fail" },
];

describe("resolveGrade", () => {
  it("maps boundary scores to the correct band", () => {
    expect(resolveGrade(100, scale)?.grade).toBe("A");
    expect(resolveGrade(70, scale)?.grade).toBe("A");
    expect(resolveGrade(69, scale)?.grade).toBe("B");
    expect(resolveGrade(50, scale)?.grade).toBe("C");
    expect(resolveGrade(40, scale)?.grade).toBe("E");
    expect(resolveGrade(39, scale)?.grade).toBe("F");
    expect(resolveGrade(0, scale)?.grade).toBe("F");
  });

  it("rounds fractional percentages before grading", () => {
    expect(resolveGrade(69.5, scale)?.grade).toBe("A"); // rounds to 70
    expect(resolveGrade(69.4, scale)?.grade).toBe("B");
  });

  it("returns null when no band matches", () => {
    expect(resolveGrade(150, scale)).toBeNull();
    expect(resolveGrade(50, [])).toBeNull();
  });
});

describe("ordinal", () => {
  it("formats class positions", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(102)).toBe("102nd");
  });
});
