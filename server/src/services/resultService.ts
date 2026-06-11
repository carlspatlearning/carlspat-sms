import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { resolveGrade, ordinal } from "../utils/grading";

export interface SubjectResult {
  subjectId: string;
  subject: string;
  code: string;
  scores: { assessment: string; maxScore: number; score: number | null }[];
  total: number;
  maxTotal: number;
  percentage: number;
  grade: string;
  remark: string;
}

export interface StudentTermResult {
  studentId: string;
  termId: string;
  subjects: SubjectResult[];
  overallTotal: number;
  overallMax: number;
  average: number;
  grade: string;
  remark: string;
  position: number | null;
  positionLabel: string | null;
  classSize: number;
}

/** Full computed result sheet for one student in one term. */
export async function computeStudentResult(studentId: string, termId: string): Promise<StudentTermResult> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, schoolId: true, classRoomId: true },
  });
  if (!student) throw ApiError.notFound("Student not found");

  const [assessmentTypes, gradeScale, scores] = await Promise.all([
    prisma.assessmentType.findMany({
      where: { schoolId: student.schoolId, isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.gradeScale.findMany({ where: { schoolId: student.schoolId }, orderBy: { minScore: "desc" } }),
    prisma.score.findMany({
      where: { studentId, termId },
      include: { subject: true },
    }),
  ]);

  // Group scores by subject
  const bySubject = new Map<string, { subject: string; code: string; scores: Map<string, number> }>();
  for (const s of scores) {
    if (!bySubject.has(s.subjectId)) {
      bySubject.set(s.subjectId, { subject: s.subject.name, code: s.subject.code, scores: new Map() });
    }
    bySubject.get(s.subjectId)!.scores.set(s.assessmentTypeId, s.score);
  }

  const maxTotal = assessmentTypes.reduce((sum, a) => sum + a.maxScore, 0);
  const subjects: SubjectResult[] = [];
  for (const [subjectId, data] of bySubject) {
    const rows = assessmentTypes.map((a) => ({
      assessment: a.name,
      maxScore: a.maxScore,
      score: data.scores.get(a.id) ?? null,
    }));
    const total = rows.reduce((sum, r) => sum + (r.score ?? 0), 0);
    const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    const band = resolveGrade(percentage, gradeScale);
    subjects.push({
      subjectId,
      subject: data.subject,
      code: data.code,
      scores: rows,
      total,
      maxTotal,
      percentage: Math.round(percentage * 10) / 10,
      grade: band?.grade ?? "-",
      remark: band?.remark ?? "-",
    });
  }
  subjects.sort((a, b) => a.subject.localeCompare(b.subject));

  const overallTotal = subjects.reduce((sum, s) => sum + s.total, 0);
  const overallMax = subjects.length * maxTotal;
  const average = overallMax > 0 ? (overallTotal / overallMax) * 100 : 0;
  const overallBand = resolveGrade(average, gradeScale);

  // Position in class: rank by average among classmates with scores this term
  let position: number | null = null;
  let classSize = 0;
  if (student.classRoomId) {
    const ranking = await rankClass(student.classRoomId, termId);
    classSize = ranking.length;
    const mine = ranking.find((r) => r.studentId === studentId);
    position = mine?.position ?? null;
  }

  return {
    studentId,
    termId,
    subjects,
    overallTotal,
    overallMax,
    average: Math.round(average * 10) / 10,
    grade: overallBand?.grade ?? "-",
    remark: overallBand?.remark ?? "-",
    position,
    positionLabel: position ? ordinal(position) : null,
    classSize,
  };
}

/** Rank all students in a class for a term by total score (dense ranking, ties share a position). */
export async function rankClass(
  classRoomId: string,
  termId: string
): Promise<{ studentId: string; total: number; position: number }[]> {
  const totals = await prisma.score.groupBy({
    by: ["studentId"],
    where: { termId, student: { classRoomId } },
    _sum: { score: true },
  });
  const sorted = totals
    .map((t) => ({ studentId: t.studentId, total: Number(t._sum.score ?? 0) }))
    .sort((a, b) => b.total - a.total);

  let position = 0;
  let lastTotal = Number.POSITIVE_INFINITY;
  return sorted.map((row, idx) => {
    if (row.total < lastTotal) {
      position = idx + 1;
      lastTotal = row.total;
    }
    return { ...row, position };
  });
}

/** Attendance summary (present/absent/late counts) for the term. */
export async function attendanceSummary(studentId: string, termId: string) {
  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    where: { studentId, termId },
    _count: { _all: true },
  });
  const get = (status: string) => grouped.find((g) => g.status === status)?._count._all ?? 0;
  const present = get("PRESENT");
  const late = get("LATE");
  const absent = get("ABSENT");
  return { present, late, absent, totalDays: present + late + absent };
}
