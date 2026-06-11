export interface GradeBand {
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string;
}

/**
 * Resolve a percentage score (0–100) to a grade using the school's
 * configurable grade scale. Returns null when no band matches.
 */
export function resolveGrade(score: number, scale: GradeBand[]): GradeBand | null {
  const rounded = Math.round(score);
  return scale.find((band) => rounded >= band.minScore && rounded <= band.maxScore) ?? null;
}

/** Ordinal suffix for class positions: 1st, 2nd, 3rd, 4th, 11th, 21st… */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
