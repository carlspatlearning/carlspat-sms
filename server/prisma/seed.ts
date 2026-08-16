/**
 * Seed data for Carlspat Private School Management System.
 * Idempotent — safe to run multiple times (uses upserts / find-or-create).
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hashSync(pw, 10);

async function main() {
  // ── School ────────────────────────────────────────────────────────────────
  // Keyed on slug so re-running the seed updates the same school rather than
  // adopting whichever school happens to be first — which, on a platform with
  // several schools, would seed one school's data into another.
  const school = await prisma.school.upsert({
    where: { slug: "carlspat-private-school" },
    update: {},
    create: {
      slug: "carlspat-private-school",
      name: "Carlspat Private School",
      numberPrefix: "CPS",
      motto: "Emphasis on All-Round Development",
      address:
        "Surulere, Old Keye Water Factory, Opposite Luku Panel Beater, Ora Road, Ido Ekiti, Ekiti State, Nigeria",
      phone: "08067281676",
      email: "carlspatprivateschool@outlook.com",
      headTeacherName: "The Head Teacher",
      subscriptionStatus: "ACTIVE",
    },
  });
  const schoolId = school.id;

  // ── Academic session & terms ─────────────────────────────────────────────
  const session = await prisma.academicSession.upsert({
    where: { schoolId_name: { schoolId, name: "2025/2026" } },
    update: { isCurrent: true },
    create: {
      schoolId,
      name: "2025/2026",
      startDate: new Date("2025-09-08"),
      endDate: new Date("2026-07-24"),
      isCurrent: true,
    },
  });

  const termDefs = [
    { name: "First Term", startDate: new Date("2025-09-08"), endDate: new Date("2025-12-12"), isCurrent: false },
    { name: "Second Term", startDate: new Date("2026-01-05"), endDate: new Date("2026-04-02"), isCurrent: false },
    { name: "Third Term", startDate: new Date("2026-04-27"), endDate: new Date("2026-07-24"), isCurrent: true },
  ];
  const terms: Record<string, { id: string }> = {};
  for (const t of termDefs) {
    terms[t.name] = await prisma.term.upsert({
      where: { sessionId_name: { sessionId: session.id, name: t.name } },
      update: { isCurrent: t.isCurrent },
      create: { sessionId: session.id, schoolId, ...t },
    });
  }
  // ── Assessment structure (admin-editable) ────────────────────────────────
  const assessmentDefs = [
    { name: "CA 1", maxScore: 20, order: 1, isExam: false },
    { name: "CA 2", maxScore: 20, order: 2, isExam: false },
    { name: "Exam", maxScore: 60, order: 3, isExam: true },
  ];
  const assessments: Record<string, { id: string; maxScore: number }> = {};
  for (const a of assessmentDefs) {
    assessments[a.name] = await prisma.assessmentType.upsert({
      where: { schoolId_name: { schoolId, name: a.name } },
      update: {},
      create: { schoolId, ...a },
    });
  }

  // ── Grading system (admin-editable) ──────────────────────────────────────
  const gradeDefs = [
    { minScore: 70, maxScore: 100, grade: "A", remark: "Excellent" },
    { minScore: 60, maxScore: 69, grade: "B", remark: "Very Good" },
    { minScore: 50, maxScore: 59, grade: "C", remark: "Good" },
    { minScore: 45, maxScore: 49, grade: "D", remark: "Fair" },
    { minScore: 40, maxScore: 44, grade: "E", remark: "Pass" },
    { minScore: 0, maxScore: 39, grade: "F", remark: "Fail" },
  ];
  for (const g of gradeDefs) {
    await prisma.gradeScale.upsert({
      where: { schoolId_grade: { schoolId, grade: g.grade } },
      update: { minScore: g.minScore, maxScore: g.maxScore, remark: g.remark },
      create: { schoolId, ...g },
    });
  }

  // ── Classes ──────────────────────────────────────────────────────────────
  const classDefs = [
    "Creche", "Nursery 1", "Nursery 2", "Kindergarten",
    "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
  ];
  const classes: Record<string, { id: string }> = {};
  for (let i = 0; i < classDefs.length; i++) {
    const name = classDefs[i];
    const existing = await prisma.classRoom.findFirst({ where: { schoolId, name } });
    classes[name] =
      existing ??
      (await prisma.classRoom.create({
        data: { schoolId, name, level: i + 1, capacity: 30 },
      }));
  }

  // ── Subjects ─────────────────────────────────────────────────────────────
  const subjectDefs = [
    ["English Language", "ENG"], ["Mathematics", "MTH"], ["Basic Science", "BSC"],
    ["Social Studies", "SOS"], ["Civic Education", "CIV"], ["Computer Studies", "CMP"],
    ["Christian Religious Studies", "CRS"], ["Yoruba Language", "YOR"],
    ["Creative Arts", "CCA"], ["Physical & Health Education", "PHE"],
    ["Agricultural Science", "AGR"], ["Home Economics", "HEC"],
  ] as const;
  const subjects: Record<string, { id: string }> = {};
  for (const [name, code] of subjectDefs) {
    subjects[code] = await prisma.subject.upsert({
      where: { schoolId_code: { schoolId, code } },
      update: {},
      create: { schoolId, name, code },
    });
  }

  // ── Users ────────────────────────────────────────────────────────────────
  const upsertUser = (email: string, role: Role, firstName: string, lastName: string, pw: string, phone?: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { schoolId, email, role, firstName, lastName, phone, passwordHash: hash(pw) },
    });

  await upsertUser("superadmin@carlspat.sch.ng", Role.SUPER_ADMIN, "System", "Owner", "SuperAdmin#1");
  await upsertUser("admin@carlspat.sch.ng", Role.ADMIN, "Adebola", "Ogunleye", "Admin#12345", "08067281676");
  await upsertUser("bursar@carlspat.sch.ng", Role.ACCOUNTANT, "Funmi", "Adeyemi", "Bursar#1234");

  // Teacher + profile, assigned as form teacher of Primary 5
  const teacherUser = await upsertUser("teacher@carlspat.sch.ng", Role.TEACHER, "Tunde", "Bakare", "Teacher#123");
  const teacher = await prisma.teacher.upsert({
    where: { schoolId_staffNo: { schoolId, staffNo: "CPS/STF/001" } },
    update: { userId: teacherUser.id },
    create: { schoolId, userId: teacherUser.id, staffNo: "CPS/STF/001", qualification: "B.Ed", specialization: "Mathematics" },
  });
  await prisma.classRoom.update({ where: { id: classes["Primary 5"].id }, data: { formTeacherId: teacher.id } });

  const teacher2User = await upsertUser("teacher2@carlspat.sch.ng", Role.TEACHER, "Chioma", "Okafor", "Teacher#123");
  const teacher2 = await prisma.teacher.upsert({
    where: { schoolId_staffNo: { schoolId, staffNo: "CPS/STF/002" } },
    update: { userId: teacher2User.id },
    create: { schoolId, userId: teacher2User.id, staffNo: "CPS/STF/002", qualification: "NCE", specialization: "English" },
  });

  // Subject assignments for Primary 5
  for (const code of ["MTH", "BSC", "CMP"]) {
    await prisma.classSubject.upsert({
      where: { classRoomId_subjectId: { classRoomId: classes["Primary 5"].id, subjectId: subjects[code].id } },
      update: { teacherId: teacher.id },
      create: { classRoomId: classes["Primary 5"].id, subjectId: subjects[code].id, teacherId: teacher.id },
    });
  }
  for (const code of ["ENG", "SOS", "CRS"]) {
    await prisma.classSubject.upsert({
      where: { classRoomId_subjectId: { classRoomId: classes["Primary 5"].id, subjectId: subjects[code].id } },
      update: { teacherId: teacher2.id },
      create: { classRoomId: classes["Primary 5"].id, subjectId: subjects[code].id, teacherId: teacher2.id },
    });
  }

  // ── Fee categories & structure (Primary 5, Third Term) ───────────────────
  const feeDefs = [
    ["Tuition Fee", 45000], ["PTA Fee", 2000], ["Examination Fee", 3000],
    ["Development Levy", 5000], ["Transport Fee", 10000],
  ] as const;
  for (const [name, amount] of feeDefs) {
    const category = await prisma.feeCategory.upsert({
      where: { schoolId_name: { schoolId, name } },
      update: {},
      create: { schoolId, name },
    });
    // Transport is optional — only billed for Tuition/PTA/Exam/Levy by default
    if (name === "Transport Fee") continue;
    for (const termName of Object.keys(terms)) {
      await prisma.feeStructure.upsert({
        where: {
          termId_classRoomId_categoryId: {
            termId: terms[termName].id,
            classRoomId: classes["Primary 5"].id,
            categoryId: category.id,
          },
        },
        update: {},
        create: {
          schoolId,
          termId: terms[termName].id,
          classRoomId: classes["Primary 5"].id,
          categoryId: category.id,
          amount,
        },
      });
    }
  }

  console.log("✔ Seed completed for", school.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
