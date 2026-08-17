/**
 * DEMO seed — Crestview Public School.
 *
 * Builds the fictional school used for the explainer video shoot, as specified
 * in docs/VIDEO_SHOOTING_DOCUMENT.md §3.
 *
 * This is NOT the production seed. `prisma/seed.ts` remains Carlspat Private
 * School's real starting data and is untouched by this file.
 *
 *     npm run seed:demo -- --reset
 *
 * --reset is required and DELETES ALL DATA in the target database first. Point
 * DATABASE_URL at a dedicated demo database. Never run this against production.
 *
 * Two design decisions worth knowing before you change anything:
 *
 * 1. "Crestview Public School" is not an arbitrary name. The application
 *    hardcodes a "CPS" prefix when generating admission numbers
 *    (CPS/<year>/<seq>) and receipts (CPS-RCP-<year>-<seq>) in
 *    src/utils/ids.ts. A demo school whose initials are CPS keeps numbers
 *    generated live on camera (Scenes 5 and 16) consistent with the seeded
 *    records — no code change, and "Carlspat" never appears on screen.
 *
 * 2. The academic calendar is anchored to the day you run this, not to fixed
 *    dates. The dashboard's attendance rate only counts the last 30 days, so a
 *    calendar hardcoded to mid-2026 would read 0% at any later shoot date. The
 *    current term always ends two weeks from today.
 */
import "dotenv/config";
import {
  PrismaClient,
  Role,
  Gender,
  AttendanceStatus,
  PaymentMethod,
  PaymentStatus,
  Audience,
  ResourceType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// bcrypt is deliberately slow; every demo account shares a password, so hash once.
const DEMO_PASSWORD = "Demo#2026";
const DEMO_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

/** Targets from docs/VIDEO_SHOOTING_DOCUMENT.md §3. */
const TARGET = {
  teachers: 26,
  parents: 288,
  collected: 19_650_000,
  heroPaid: 66_000,
  heroPosition: 4,
};

const TERM_DAYS = 65;

/** Deterministic PRNG — the same dataset every run, so reshoots match. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260813);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const FIRST_M = [
  "Tunde", "Chidi", "Emeka", "Segun", "Ifeanyi", "Kayode", "Musa", "Obinna", "Femi", "Uche",
  "Bola", "Yusuf", "Chinedu", "Dapo", "Ikechukwu", "Sola", "Nnamdi", "Gbenga", "Tobi", "Ade",
] as const;
const FIRST_F = [
  "Adaeze", "Ngozi", "Chioma", "Funmi", "Amaka", "Yemisi", "Zainab", "Ifeoma", "Bisi", "Nkechi",
  "Temitope", "Halima", "Chinyere", "Folake", "Oluchi", "Sade", "Blessing", "Kemi", "Adaora", "Titi",
] as const;
const SURNAMES = [
  "Nwosu", "Bakare", "Okafor", "Adeyemi", "Ogunleye", "Eze", "Balogun", "Obi", "Adebayo", "Uzoma",
  "Lawal", "Chukwu", "Afolabi", "Nwachukwu", "Oyelaran", "Ibrahim", "Onyeka", "Adesina", "Okonkwo", "Aminu",
  "Olatunji", "Ezeh", "Salami", "Nnaji", "Akande", "Umeh", "Fashola", "Oduya", "Anyanwu", "Bello",
] as const;

type Section = "EARLY" | "PRIMARY" | "JSS" | "SSS";

interface ClassDef {
  name: string;
  section: Section;
  students: number;
  /** Total payable per term, split across fee categories below. */
  feeTotal: number;
  /** Mean subject percentage — this is what the dashboard bar shows. */
  meanPct: number;
}

/**
 * Sixteen classes, crèche to SSS 3. Class means sit in the high 50s to high
 * 60s deliberately: the hero averages 71.3% and must rank 4th of 32, which is
 * impossible if her class averages 71% too. Realistic spreads also read as
 * more credible to a proprietor than a school where everyone scores 75%.
 */
const CLASS_DEFS: ClassDef[] = [
  { name: "Creche",       section: "EARLY",   students: 12, feeTotal: 30_000, meanPct: 66.0 },
  { name: "Nursery 1",    section: "EARLY",   students: 18, feeTotal: 32_000, meanPct: 67.2 },
  { name: "Nursery 2",    section: "EARLY",   students: 20, feeTotal: 32_000, meanPct: 68.4 },
  { name: "Kindergarten", section: "EARLY",   students: 22, feeTotal: 36_000, meanPct: 69.1 },
  { name: "Primary 1",    section: "PRIMARY", students: 28, feeTotal: 42_000, meanPct: 65.8 },
  { name: "Primary 2",    section: "PRIMARY", students: 30, feeTotal: 42_000, meanPct: 64.3 },
  { name: "Primary 3",    section: "PRIMARY", students: 30, feeTotal: 45_000, meanPct: 63.7 },
  { name: "Primary 4",    section: "PRIMARY", students: 28, feeTotal: 45_000, meanPct: 62.1 },
  { name: "Primary 5",    section: "PRIMARY", students: 30, feeTotal: 48_000, meanPct: 63.4 },
  { name: "Primary 6",    section: "PRIMARY", students: 26, feeTotal: 50_000, meanPct: 64.9 },
  { name: "JSS 1",        section: "JSS",     students: 34, feeTotal: 78_000, meanPct: 60.2 },
  { name: "JSS 2",        section: "JSS",     students: 32, feeTotal: 86_000, meanPct: 61.4 },
  { name: "JSS 3",        section: "JSS",     students: 30, feeTotal: 82_000, meanPct: 62.8 },
  { name: "SSS 1",        section: "SSS",     students: 26, feeTotal: 88_000, meanPct: 59.6 },
  { name: "SSS 2",        section: "SSS",     students: 24, feeTotal: 88_000, meanPct: 60.9 },
  { name: "SSS 3",        section: "SSS",     students: 22, feeTotal: 92_000, meanPct: 63.5 },
];

const SUBJECT_DEFS = [
  ["English Language", "ENG"], ["Mathematics", "MTH"], ["Basic Science", "BSC"],
  ["Basic Technology", "BTC"], ["Social Studies", "SOS"], ["Civic Education", "CIV"],
  ["Business Studies", "BUS"], ["Computer Studies", "CMP"], ["Yoruba Language", "YOR"],
  ["Christian Religious Studies", "CRS"], ["Creative Arts", "CCA"],
  ["Physical & Health Education", "PHE"], ["Biology", "BIO"], ["Chemistry", "CHM"],
  ["Physics", "PHY"], ["Economics", "ECO"], ["Government", "GOV"],
] as const;

const SUBJECTS_BY_SECTION: Record<Section, string[]> = {
  EARLY:   ["ENG", "MTH", "BSC", "CCA", "PHE"],
  PRIMARY: ["ENG", "MTH", "BSC", "SOS", "CIV", "CMP", "YOR"],
  // These nine, in this order, are the hero's report card. Do not reorder.
  JSS:     ["ENG", "MTH", "BSC", "BTC", "SOS", "CIV", "BUS", "CMP", "YOR"],
  SSS:     ["ENG", "MTH", "BIO", "CHM", "PHY", "ECO", "GOV", "CMP"],
};

/** Hero's exact scores as CA1/CA2/Exam. Totals to 642/900 = 71.3%. */
const HERO_SCORES: Record<string, [number, number, number]> = {
  ENG: [16, 15, 47], // 78 A
  MTH: [18, 17, 50], // 85 A
  BSC: [14, 15, 43], // 72 A
  BTC: [13, 14, 40], // 67 B
  SOS: [13, 14, 38], // 65 B
  CIV: [15, 16, 44], // 75 A
  BUS: [14, 13, 41], // 68 B
  CMP: [12, 13, 36], // 61 B
  YOR: [15, 14, 42], // 71 A
};
const HERO_TOTAL = 642;
const HERO_SUBJECTS = 9;

/** Sums to 13,780,000 — the term expenditure figure in the shooting document. */
const EXPENSES: [string, string, number][] = [
  ["Staff Salaries", "Staff salaries — month 1", 2_850_000],
  ["Staff Salaries", "Staff salaries — month 2", 2_850_000],
  ["Staff Salaries", "Staff salaries — month 3", 2_850_000],
  ["Maintenance", "Perimeter fence repair", 1_094_000],
  ["Teaching Materials", "Textbooks and workbooks", 1_240_000],
  ["Maintenance", "Classroom block painting", 620_000],
  ["Utilities", "Electricity bill — term", 486_000],
  ["Transport", "School bus servicing", 468_000],
  ["Teaching Materials", "Laboratory consumables", 385_000],
  ["Examination", "Third Term examination printing", 312_000],
  ["Maintenance", "Furniture repairs", 235_000],
  ["Utilities", "Borehole pump repair", 145_000],
  ["Administration", "Internet and data subscription", 96_000],
  ["Administration", "Office supplies", 84_500],
  ["Utilities", "Diesel for generator", 38_500],
  ["Administration", "Bank charges", 26_000],
];

/** Sums to 420,000 — the discounts figure on the dashboard. */
const WAIVERS: [string, number][] = [
  ["Staff child — full tuition discount", 100_000],
  ["Proprietor's scholarship — academic merit", 100_000],
  ["Sibling discount (third child)", 80_000],
  ["Bereavement support", 60_000],
  ["Staff child — partial discount", 50_000],
  ["Hardship consideration", 30_000],
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** The last `count` weekdays up to and including `end`, oldest first. */
function weekdaysEndingAt(end: Date, count: number): Date[] {
  const days: Date[] = [];
  const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (days.length < count) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.unshift(new Date(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days;
}

/**
 * Subject totals for one student whose subject average must be exactly
 * `meanPct`. Noise is added per subject, then the rounded integers are nudged
 * until they sum to the exact target.
 *
 * The exactness matters: without it, per-subject noise on nine subjects moves a
 * student's average by over a point, and the nearest rival overtakes the hero
 * roughly a third of the time — which silently breaks the "4th of 32" printed
 * on her report card in Scene 10.
 */
function subjectTotals(meanPct: number, n: number): number[] {
  const targetSum = Math.round(meanPct * n);
  const ints = Array.from({ length: n }, () =>
    Math.max(25, Math.min(98, Math.round(meanPct + (rand() * 14 - 7))))
  );
  let diff = targetSum - ints.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard++ < 5000) {
    for (let i = 0; i < n && diff !== 0; i++) {
      if (diff > 0 && ints[i] < 98) { ints[i]++; diff--; }
      else if (diff < 0 && ints[i] > 25) { ints[i]--; diff++; }
    }
  }
  return ints;
}

/** Split a subject total into CA 1 / CA 2 / Exam within their 20/20/60 caps. */
function splitScore(total: number): [number, number, number] {
  const t = Math.max(0, Math.min(100, Math.round(total)));
  const a = Math.min(20, Math.round(t * 0.2));
  const b = Math.min(20, Math.round(t * 0.2));
  return [a, b, Math.min(60, t - a - b)];
}

async function wipe() {
  // Children before parents. ClassRoom before Teacher: ClassRoom.formTeacherId
  // has no cascade, so the teacher cannot be removed while a class points at it.
  await prisma.auditLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.studentFeeItem.deleteMany();
  await prisma.feeWaiver.deleteMany();
  await prisma.feeStructure.deleteMany();
  await prisma.feeCategory.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.termReport.deleteMany();
  await prisma.score.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.student.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.classRoom.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.assessmentType.deleteMany();
  await prisma.gradeScale.deleteMany();
  await prisma.term.deleteMany();
  await prisma.academicSession.deleteMany();
  await prisma.school.deleteMany();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.argv.includes("--reset")) {
    console.error(
      [
        "",
        "  This script DELETES ALL DATA in the target database, then seeds the",
        "  demo school used for the explainer video.",
        "",
        "  Point DATABASE_URL at a dedicated demo database, then run:",
        "",
        "      npm run seed:demo -- --reset",
        "",
        "  Never run this against production.",
        "",
      ].join("\n")
    );
    process.exit(1);
  }

  console.log(`\n  Target database: ${(process.env.DATABASE_URL ?? "").replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log("  Wiping…");
  await wipe();

  // ── Calendar, anchored to today ───────────────────────────────────────────
  const today = new Date();
  const attendanceDays = weekdaysEndingAt(today, TERM_DAYS);
  const thirdStart = attendanceDays[0];
  const thirdEnd = addDays(today, 14);
  const secondEnd = addDays(thirdStart, -21);
  const secondStart = addDays(secondEnd, -90);
  const firstEnd = addDays(secondStart, -21);
  const firstStart = addDays(firstEnd, -95);
  const sessionName =
    firstStart.getUTCFullYear() === thirdEnd.getUTCFullYear()
      ? `${firstStart.getUTCFullYear() - 1}/${thirdEnd.getUTCFullYear()}`
      : `${firstStart.getUTCFullYear()}/${thirdEnd.getUTCFullYear()}`;

  // ── School ────────────────────────────────────────────────────────────────
  const school = await prisma.school.create({
    data: {
      slug: `crestview-demo-${Date.now()}`,
      name: "Crestview Public School",
      numberPrefix: "CVS",
      motto: "Knowledge, Character, Service",
      address: "14 Ajilosun Road, Ado Ekiti, Ekiti State, Nigeria",
      phone: "08030000000",
      email: "info@crestview.demo",
      headTeacherName: "Mrs Adaobi Okeke",
      currency: "NGN",
      subscriptionStatus: "ACTIVE",
    },
  });
  const schoolId = school.id;

  const session = await prisma.academicSession.create({
    data: { schoolId, name: sessionName, startDate: firstStart, endDate: thirdEnd, isCurrent: true },
  });
  const terms: Record<string, { id: string }> = {};
  for (const t of [
    { name: "First Term", startDate: firstStart, endDate: firstEnd, isCurrent: false },
    { name: "Second Term", startDate: secondStart, endDate: secondEnd, isCurrent: false },
    { name: "Third Term", startDate: thirdStart, endDate: thirdEnd, isCurrent: true },
  ]) {
    terms[t.name] = await prisma.term.create({ data: { sessionId: session.id, schoolId, ...t } });
  }
  const currentTerm = terms["Third Term"];

  // ── Assessment structure and grading ──────────────────────────────────────
  const [ca1, ca2, exam] = await Promise.all(
    [
      { name: "CA 1", maxScore: 20, order: 1, isExam: false },
      { name: "CA 2", maxScore: 20, order: 2, isExam: false },
      { name: "Exam", maxScore: 60, order: 3, isExam: true },
    ].map((a) => prisma.assessmentType.create({ data: { schoolId, ...a } }))
  );

  await prisma.gradeScale.createMany({
    data: [
      { schoolId, minScore: 70, maxScore: 100, grade: "A", remark: "Excellent" },
      { schoolId, minScore: 60, maxScore: 69, grade: "B", remark: "Very Good" },
      { schoolId, minScore: 50, maxScore: 59, grade: "C", remark: "Good" },
      { schoolId, minScore: 45, maxScore: 49, grade: "D", remark: "Fair" },
      { schoolId, minScore: 40, maxScore: 44, grade: "E", remark: "Pass" },
      { schoolId, minScore: 0, maxScore: 39, grade: "F", remark: "Fail" },
    ],
  });

  // ── Subjects and classes ──────────────────────────────────────────────────
  const subjects: Record<string, { id: string }> = {};
  for (const [name, code] of SUBJECT_DEFS) {
    subjects[code] = await prisma.subject.create({ data: { schoolId, name, code } });
  }

  const classes: Record<string, { id: string }> = {};
  for (let i = 0; i < CLASS_DEFS.length; i++) {
    const def = CLASS_DEFS[i];
    classes[def.name] = await prisma.classRoom.create({
      data: { schoolId, name: def.name, level: i + 1, capacity: Math.max(30, def.students + 4) },
    });
  }
  const jss2 = classes["JSS 2"];

  // ── Staff ─────────────────────────────────────────────────────────────────
  const mkUser = (email: string, role: Role, firstName: string, lastName: string, phone?: string) =>
    prisma.user.create({
      data: { schoolId, email, role, firstName, lastName, phone, passwordHash: DEMO_HASH },
    });

  await mkUser("superadmin@crestview.demo", Role.SUPER_ADMIN, "System", "Owner");
  const adminUser = await mkUser("admin@crestview.demo", Role.ADMIN, "Adebola", "Ogunleye", "08030000001");
  const bursarUser = await mkUser("bursar@crestview.demo", Role.ACCOUNTANT, "Funmi", "Adeyemi", "08030000002");

  // Teachers 1 and 2 are named in the shot list and appear on camera.
  const teachers: { id: string; userId: string }[] = [];
  for (let i = 0; i < TARGET.teachers; i++) {
    const u = await mkUser(
      i === 0 ? "teacher@crestview.demo" : `teacher${i + 1}@crestview.demo`,
      Role.TEACHER,
      i === 0 ? "Tunde" : i === 1 ? "Chioma" : pick(i % 2 === 0 ? FIRST_M : FIRST_F),
      i === 0 ? "Bakare" : i === 1 ? "Okafor" : pick(SURNAMES)
    );
    const t = await prisma.teacher.create({
      data: {
        schoolId,
        userId: u.id,
        staffNo: `CVS/STF/${String(i + 1).padStart(3, "0")}`,
        qualification: i === 0 ? "B.Ed" : pick(["B.Ed", "B.Sc", "NCE", "M.Ed", "B.A"]),
        specialization:
          i === 0 ? "Mathematics" : i === 1 ? "English" : pick(["Mathematics", "English", "Sciences", "Social Sciences", "ICT"]),
        dateJoined: new Date(Date.UTC(today.getUTCFullYear() - 1 - (i % 6), (i * 3) % 12, 1 + (i % 27))),
      },
    });
    teachers.push({ id: t.id, userId: u.id });
  }
  const recorder = teachers[0].userId;

  // Form teachers: teacher 1 takes JSS 2, the rest fill the other classes.
  await prisma.classRoom.update({ where: { id: jss2.id }, data: { formTeacherId: teachers[0].id } });
  let ft = 1;
  for (const def of CLASS_DEFS) {
    if (def.name === "JSS 2") continue;
    await prisma.classRoom.update({
      where: { id: classes[def.name].id },
      data: { formTeacherId: teachers[ft++ % teachers.length].id },
    });
  }

  for (const def of CLASS_DEFS) {
    const codes = SUBJECTS_BY_SECTION[def.section];
    for (let s = 0; s < codes.length; s++) {
      const teacherId =
        def.name === "JSS 2"
          ? ["MTH", "BSC", "BTC", "CMP"].includes(codes[s]) ? teachers[0].id : teachers[1].id
          : teachers[(ft + s) % teachers.length].id;
      await prisma.classSubject.create({
        data: { classRoomId: classes[def.name].id, subjectId: subjects[codes[s]].id, teacherId },
      });
    }
  }

  // ── Fee categories and structures ─────────────────────────────────────────
  const feeCats: Record<string, { id: string }> = {};
  for (const name of ["Tuition Fee", "PTA Fee", "Examination Fee", "Development Levy", "Laboratory Levy", "Transport Fee"]) {
    feeCats[name] = await prisma.feeCategory.create({ data: { schoolId, name } });
  }

  /** Category split for a class; tuition absorbs the remainder. */
  function feeSplit(def: ClassDef): Record<string, number> {
    const secondary = def.section === "JSS" || def.section === "SSS";
    const parts: Record<string, number> = {
      "PTA Fee": secondary ? 2_500 : 2_000,
      "Examination Fee": secondary ? 4_000 : 2_500,
      "Development Levy": secondary ? 6_000 : 4_000,
    };
    if (secondary) parts["Laboratory Levy"] = 5_500;
    parts["Tuition Fee"] = def.feeTotal - Object.values(parts).reduce((a, b) => a + b, 0);
    return parts;
  }

  let expected = 0;
  for (const def of CLASS_DEFS) {
    const split = feeSplit(def);
    for (const termName of Object.keys(terms)) {
      for (const [catName, amount] of Object.entries(split)) {
        await prisma.feeStructure.create({
          data: {
            schoolId,
            termId: terms[termName].id,
            classRoomId: classes[def.name].id,
            categoryId: feeCats[catName].id,
            amount,
            dueDate: addDays(thirdStart, 21),
          },
        });
      }
    }
    expected += def.feeTotal * def.students;
  }
  // Transport Fee deliberately has no structure — it is the optional category
  // left unticked in Scene 16.

  // ── Students ──────────────────────────────────────────────────────────────
  interface Seeded { id: string; className: string; section: Section; feeTotal: number; meanPct: number; isHero: boolean }
  const students: Seeded[] = [];
  const thisYear = today.getUTCFullYear();

  const heroParentUser = await mkUser("parent@crestview.demo", Role.PARENT, "Ngozi", "Nwosu", "08030000003");
  const heroParent = await prisma.parent.create({
    data: { schoolId, userId: heroParentUser.id, occupation: "Trader", address: "22 Ajilosun Road, Ado Ekiti" },
  });
  const heroUser = await mkUser("student@crestview.demo", Role.STUDENT, "Adaeze", "Nwosu");
  const hero = await prisma.student.create({
    data: {
      schoolId,
      userId: heroUser.id,
      admissionNo: `CPS/${thisYear - 2}/0118`,
      firstName: "Adaeze",
      lastName: "Nwosu",
      gender: Gender.FEMALE,
      dateOfBirth: new Date(Date.UTC(thisYear - 13, 2, 14)),
      address: "22 Ajilosun Road, Ado Ekiti",
      parentId: heroParent.id,
      classRoomId: jss2.id,
      admissionDate: new Date(Date.UTC(thisYear - 2, 8, 9)),
    },
  });
  students.push({ id: hero.id, className: "JSS 2", section: "JSS", feeTotal: 86_000, meanPct: 61.4, isHero: true });

  // Sibling in the primary section: one parent profile then shows a child in
  // JSS and a child in Primary side by side (Scene 6).
  const sibling = await prisma.student.create({
    data: {
      schoolId,
      admissionNo: `CPS/${thisYear - 1}/0207`,
      firstName: "Chidi",
      lastName: "Nwosu",
      gender: Gender.MALE,
      dateOfBirth: new Date(Date.UTC(thisYear - 8, 10, 2)),
      address: "22 Ajilosun Road, Ado Ekiti",
      parentId: heroParent.id,
      classRoomId: classes["Primary 2"].id,
      admissionDate: new Date(Date.UTC(thisYear - 1, 8, 8)),
    },
  });
  students.push({ id: sibling.id, className: "Primary 2", section: "PRIMARY", feeTotal: 42_000, meanPct: 64.3, isHero: false });

  // The hero's parent is held out of the pool below. Scene 6 shows her profile
  // with exactly two children — one in JSS, one in Primary — and a round-robin
  // that wraps back onto her would quietly hand her a third.
  const parents: { id: string; lastName: string }[] = [];
  for (let i = 1; i < TARGET.parents; i++) {
    const lastName = pick(SURNAMES);
    const u = await mkUser(
      `parent${i + 1}@crestview.demo`,
      Role.PARENT,
      pick(i % 2 === 0 ? FIRST_M : FIRST_F),
      lastName,
      `0803${String(1_000_000 + i).slice(0, 7)}`
    );
    const p = await prisma.parent.create({
      data: { schoolId, userId: u.id, occupation: pick(["Trader", "Civil Servant", "Teacher", "Farmer", "Engineer", "Nurse", "Businessman", "Tailor"]) },
    });
    parents.push({ id: p.id, lastName });
  }

  let seq = 300;
  let parentCursor = 1;
  for (let ci = 0; ci < CLASS_DEFS.length; ci++) {
    const def = CLASS_DEFS[ci];
    const already = students.filter((s) => s.className === def.name).length;
    for (let n = already; n < def.students; n++) {
      const female = rand() < 0.5;
      // Older classes were admitted longer ago; the newest intake carries this
      // year's prefix, so a registration filmed in Scene 5 continues the run.
      const yearsAgo = Math.min(6, Math.floor(ci / 2));
      seq++;
      // Children take their guardian's surname — a parent profile listing
      // children with three different surnames reads as fake on camera.
      const guardian = parents[parentCursor++ % parents.length];
      const st = await prisma.student.create({
        data: {
          schoolId,
          admissionNo: `CPS/${thisYear - yearsAgo}/${String(seq).padStart(4, "0")}`,
          firstName: pick(female ? FIRST_F : FIRST_M),
          lastName: guardian.lastName,
          gender: female ? Gender.FEMALE : Gender.MALE,
          dateOfBirth: new Date(Date.UTC(thisYear - 5 - ci, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27))),
          parentId: guardian.id,
          classRoomId: classes[def.name].id,
          admissionDate: new Date(Date.UTC(thisYear - yearsAgo, 8, 9)),
        },
      });
      students.push({ id: st.id, className: def.name, section: def.section, feeTotal: def.feeTotal, meanPct: def.meanPct, isHero: false });
    }
  }

  // ── Scores ────────────────────────────────────────────────────────────────
  // JSS 2 is built so the hero lands exactly 4th: three students above her
  // 71.3% average, the rest spread below it, class mean held at 61.4%.
  const jss2Students = students.filter((s) => s.className === "JSS 2");
  const heroPct = HERO_TOTAL / HERO_SUBJECTS;
  const jss2Targets = new Map<string, number>();
  {
    const above = [78.2, 75.6, 73.1];
    const rest = jss2Students.filter((s) => !s.isHero);
    const others = rest.length - above.length;
    const othersMean =
      (61.4 * jss2Students.length - heroPct - above.reduce((a, b) => a + b, 0)) / others;
    rest.forEach((s, i) => {
      if (i < above.length) {
        jss2Targets.set(s.id, above[i]);
      } else {
        const k = i - above.length;
        // Symmetric spread about othersMean, held safely below the hero.
        const spread = 11.5 - (23 * k) / (others - 1);
        jss2Targets.set(s.id, Math.min(heroPct - 0.5, othersMean + spread));
      }
    });
  }

  type ScoreRow = { studentId: string; subjectId: string; termId: string; assessmentTypeId: string; score: number; recordedById: string };
  const scoreRows: ScoreRow[] = [];
  for (const s of students) {
    const codes = SUBJECTS_BY_SECTION[s.section];
    const totals = s.isHero ? [] : subjectTotals(jss2Targets.get(s.id) ?? s.meanPct, codes.length);
    codes.forEach((code, i) => {
      const [a, b, c] = s.isHero ? HERO_SCORES[code] : splitScore(totals[i]);
      const base = { studentId: s.id, subjectId: subjects[code].id, termId: currentTerm.id, recordedById: recorder };
      scoreRows.push(
        { ...base, assessmentTypeId: ca1.id, score: a },
        { ...base, assessmentTypeId: ca2.id, score: b },
        { ...base, assessmentTypeId: exam.id, score: c }
      );
    });
  }
  for (const c of chunk(scoreRows, 5000)) await prisma.score.createMany({ data: c });

  // ── Term reports — the comments that print on the report card ─────────────
  const genericComments = [
    "A steady term's work. Keep it up.",
    "Has improved this term, particularly in the sciences.",
    "Capable, but needs to participate more in class.",
    "Good effort throughout the term.",
    "Should give more attention to written assignments.",
  ];
  for (const s of jss2Students) {
    await prisma.termReport.create({
      data: {
        studentId: s.id,
        termId: currentTerm.id,
        classRoomId: jss2.id,
        teacherComment: s.isHero
          ? "Adaeze has worked steadily throughout the term and her mathematics has improved noticeably. She should give more attention to Computer Studies."
          : pick(genericComments),
        headTeacherComment: s.isHero ? "A pleasing result. Keep it up." : "A satisfactory result.",
      },
    });
  }

  // ── Attendance ────────────────────────────────────────────────────────────
  // The hero gets exactly 58 present / 3 late / 4 absent across 65 school days,
  // matching the attendance block printed on her report card.
  const heroLate = new Set([9, 27, 51]);
  const heroAbsent = new Set([14, 15, 33, 47]);
  type AttRow = { studentId: string; classRoomId: string; termId: string; date: Date; status: AttendanceStatus; markedById: string };
  const attRows: AttRow[] = [];
  for (const s of students) {
    const classRoomId = classes[s.className].id;
    for (let d = 0; d < attendanceDays.length; d++) {
      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      if (s.isHero) {
        if (heroAbsent.has(d)) status = AttendanceStatus.ABSENT;
        else if (heroLate.has(d)) status = AttendanceStatus.LATE;
      } else {
        const r = rand();
        if (r < 0.058) status = AttendanceStatus.ABSENT;
        else if (r < 0.088) status = AttendanceStatus.LATE;
      }
      attRows.push({ studentId: s.id, classRoomId, termId: currentTerm.id, date: attendanceDays[d], status, markedById: recorder });
    }
  }
  for (const c of chunk(attRows, 5000)) await prisma.attendance.createMany({ data: c });

  // ── Waivers ───────────────────────────────────────────────────────────────
  const waiverStudents = students.filter((s) => !s.isHero).slice(10, 10 + WAIVERS.length);
  for (let i = 0; i < WAIVERS.length; i++) {
    await prisma.feeWaiver.create({
      data: { studentId: waiverStudents[i].id, termId: currentTerm.id, amount: WAIVERS[i][1], reason: WAIVERS[i][0] },
    });
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  // Total lands exactly on TARGET.collected. The hero pays 66,000 of 86,000,
  // leaving the 20,000 that Scene 15 settles on camera.
  const plans: { studentId: string; amount: number; feeTotal: number }[] = [
    { studentId: hero.id, amount: TARGET.heroPaid, feeTotal: 86_000 },
  ];
  const rest = students.filter((s) => !s.isHero);
  const provisional = rest
    .map((s) => {
      const r = rand();
      const frac = r < 0.62 ? 1 : r < 0.82 ? 0.75 : r < 0.93 ? 0.5 : 0;
      return { studentId: s.id, amount: Math.round((s.feeTotal * frac) / 500) * 500, feeTotal: s.feeTotal };
    })
    .filter((p) => p.amount > 0);

  const remaining = TARGET.collected - TARGET.heroPaid;
  const scale = remaining / provisional.reduce((a, p) => a + p.amount, 0);
  for (const p of provisional) {
    plans.push({ ...p, amount: Math.min(p.feeTotal, Math.round((p.amount * scale) / 500) * 500) });
  }

  // Close the rounding residual in 500-naira steps across students with headroom.
  let residual = TARGET.collected - plans.reduce((a, p) => a + p.amount, 0);
  for (let i = 1; i < plans.length && residual !== 0; i++) {
    const p = plans[i];
    if (residual > 0 && p.amount + 500 <= p.feeTotal) { p.amount += 500; residual -= 500; }
    else if (residual < 0 && p.amount - 500 > 0) { p.amount -= 500; residual += 500; }
  }
  if (residual !== 0) plans[1].amount += residual; // last resort; keeps the total exact

  const methods = [PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH, PaymentMethod.POS, PaymentMethod.ONLINE];
  const paymentRows = plans
    .filter((p) => p.amount > 0)
    .map((p, i) => ({
      schoolId,
      receiptNo: `CVS-RCP-${thisYear}-${String(i + 1).padStart(5, "0")}`,
      studentId: p.studentId,
      termId: currentTerm.id,
      amount: p.amount,
      method: p.studentId === hero.id ? PaymentMethod.BANK_TRANSFER : methods[i % methods.length],
      status: PaymentStatus.SUCCESS,
      paidAt: addDays(thirdStart, 3 + (i % 55)),
      recordedById: bursarUser.id,
    }));
  for (const c of chunk(paymentRows, 2000)) await prisma.payment.createMany({ data: c });

  // ── Expenditure ───────────────────────────────────────────────────────────
  const expCats: Record<string, { id: string }> = {};
  for (const name of [...new Set(EXPENSES.map(([c]) => c))]) {
    expCats[name] = await prisma.expenseCategory.create({ data: { schoolId, name } });
  }
  for (let i = 0; i < EXPENSES.length; i++) {
    const [cat, description, amount] = EXPENSES[i];
    await prisma.expense.create({
      data: {
        schoolId,
        categoryId: expCats[cat].id,
        termId: currentTerm.id,
        amount,
        description,
        date: addDays(thirdStart, 5 + i * 3),
        recordedById: bursarUser.id,
      },
    });
  }

  // ── Communication and resources ───────────────────────────────────────────
  await prisma.announcement.create({
    data: {
      schoolId,
      title: "Third Term examinations",
      body: "Third Term examinations begin Monday. Please ensure all fees are settled.",
      audience: Audience.PARENTS,
      createdById: adminUser.id,
    },
  });
  await prisma.announcement.create({
    data: {
      schoolId,
      title: "End of term reports",
      body: "Report cards will be available in the parent portal from Friday.",
      audience: Audience.ALL,
      createdById: adminUser.id,
    },
  });
  await prisma.resource.create({
    data: {
      schoolId,
      title: "JSS 2 Mathematics — Simple Equations",
      description: "Lesson note covering simple equations and word problems.",
      type: ResourceType.LESSON_NOTE,
      fileUrl: "https://example.invalid/demo/jss2-maths-simple-equations.pdf",
      fileName: "jss2-maths-simple-equations.pdf",
      fileSize: 491_520,
      mimeType: "application/pdf",
      classRoomId: jss2.id,
      uploadedById: recorder,
    },
  });

  // ── Reconciliation ────────────────────────────────────────────────────────
  const collected = paymentRows.reduce((a, p) => a + p.amount, 0);
  const waived = WAIVERS.reduce((a, [, amt]) => a + amt, 0);
  const expenditure = EXPENSES.reduce((a, [, , amt]) => a + amt, 0);
  const attOk = attRows.filter((a) => a.status !== AttendanceStatus.ABSENT).length;

  const ngn = (n: number) => "NGN " + n.toLocaleString("en-NG");
  const row = (label: string, value: string) => console.log(`    ${label.padEnd(24)} ${value}`);

  console.log(`\n  Seeded ${school.name} — session ${sessionName}, Third Term current.\n`);
  console.log("  Reconcile these against the shooting document §3:\n");
  row("Active students", String(students.length));
  row("Teachers", String(teachers.length));
  row("Parents", String(parents.length + 1)); // + the hero's guardian, held out of the pool
  row("Classes", String(CLASS_DEFS.length));
  row("Attendance rate", `${Math.round((attOk / attRows.length) * 1000) / 10}%`);
  row("Fees expected", ngn(expected));
  row("Fees collected", ngn(collected));
  row("Discounts / waivers", ngn(waived));
  row("Outstanding", ngn(expected - waived - collected));
  row("Collection rate", `${Math.round((collected / expected) * 1000) / 10}%`);
  row("Term expenditure", ngn(expenditure));
  row("Net balance", ngn(collected - expenditure));

  // Verify the hero's rank rather than assuming it — Scene 10 shows the number.
  const totals = new Map<string, number>();
  const jss2Ids = new Set(jss2Students.map((s) => s.id));
  for (const r of scoreRows) {
    if (jss2Ids.has(r.studentId)) totals.set(r.studentId, (totals.get(r.studentId) ?? 0) + r.score);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const rank = ranked.findIndex(([id]) => id === hero.id) + 1;

  console.log("\n  Hero — Adaeze Nwosu, JSS 2:");
  row("Admission no.", `CPS/${thisYear - 2}/0118`);
  row("Total", `${HERO_TOTAL} / 900`);
  row("Average", `${Math.round((HERO_TOTAL / 900) * 1000) / 10}%`);
  row("Position", `${rank} of ${ranked.length}`);
  row("Outstanding fees", ngn(86_000 - TARGET.heroPaid));

  if (rank !== TARGET.heroPosition) {
    console.log(
      `\n  ! Hero ranked ${rank}, not ${TARGET.heroPosition}. Either update Scene 10 and the\n` +
        "    shooting document §3 to the position above, or adjust the JSS 2 targets\n" +
        "    in this file."
    );
  }

  console.log(`\n  All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log("  admin@ · teacher@ · bursar@ · parent@ · student@crestview.demo\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
