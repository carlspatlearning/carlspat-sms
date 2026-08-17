import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS, STAFF } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { hashPassword } from "../utils/password";
import { getPagination, paginated } from "../utils/pagination";

const router = Router();
router.use(authenticate, requireActiveSchool);

// GET /parents
router.get(
  "/",
  authorize(...STAFF),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req);
    const q = req.query.q as string | undefined;
    const where = {
      schoolId: currentSchoolId(req),
      ...(q
        ? {
            OR: [
              { user: { firstName: { contains: q, mode: "insensitive" as const } } },
              { user: { lastName: { contains: q, mode: "insensitive" as const } } },
              { user: { email: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.parent.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
          students: { select: { id: true, firstName: true, lastName: true, admissionNo: true, classRoom: { select: { name: true } } } },
        },
        orderBy: { user: { lastName: "asc" } },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.parent.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

// POST /parents — create parent account
router.post(
  "/",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        password: z.string().min(8),
        occupation: z.string().optional(),
        address: z.string().optional(),
        studentIds: z.array(z.string()).optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { firstName, lastName, email, phone, password, studentIds, ...profile } = req.body;

    const parent = await prisma.parent.create({
      data: {
        ...profile,
        schoolId,
        user: {
          create: {
            schoolId,
            email: email.toLowerCase(),
            passwordHash: await hashPassword(password),
            role: Role.PARENT,
            firstName,
            lastName,
            phone,
          },
        },
      },
      include: { user: { select: { id: true, email: true } } },
    });
    if (studentIds?.length) {
      // Scoped, so an id from another school links nothing rather than handing
      // this parent access to a child who is not theirs.
      await prisma.student.updateMany({
        where: { schoolId, id: { in: studentIds } },
        data: { parentId: parent.id },
      });
    }
    audit(req, "parent.create", "Parent", parent.id);
    res.status(201).json({ success: true, data: parent });
  })
);

// GET /parents/me/children — the logged-in parent's children with class info
router.get(
  "/me/children",
  authorize(Role.PARENT),
  asyncHandler(async (req, res) => {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.auth!.sub },
      include: {
        students: {
          include: { classRoom: { select: { id: true, name: true, section: true } } },
          orderBy: { firstName: "asc" },
        },
      },
    });
    if (!parent) throw ApiError.notFound("Parent profile not found");
    res.json({ success: true, data: parent.students });
  })
);

// PUT /parents/:id — update profile and account details
router.put(
  "/:id",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(2).optional(),
        lastName: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        occupation: z.string().optional(),
        address: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parent.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Parent not found");

    const { firstName, lastName, email, phone, isActive, ...profile } = req.body;
    const userFields = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const parent = await prisma.parent.update({
      where: { id: req.params.id },
      data: {
        ...profile,
        ...(Object.keys(userFields).length > 0 ? { user: { update: userFields } } : {}),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
      },
    });
    audit(req, "parent.update", "Parent", parent.id);
    res.json({ success: true, data: parent });
  })
);

// DELETE /parents/:id — unlinks children, then removes the account
router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const parent = await prisma.parent.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true } }, students: { select: { id: true } } },
    });
    if (!parent || parent.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Parent not found");
    await prisma.$transaction([
      prisma.student.updateMany({ where: { parentId: parent.id }, data: { parentId: null } }),
      prisma.user.delete({ where: { id: parent.user.id } }),
    ]);
    audit(req, "parent.delete", "Parent", req.params.id, { unlinkedChildren: parent.students.length });
    res.json({
      success: true,
      message:
        parent.students.length > 0
          ? `Parent deleted. ${parent.students.length} student(s) are no longer linked to a parent.`
          : "Parent deleted",
    });
  })
);

// POST /parents/:id/link — attach students to a parent
router.post(
  "/:id/link",
  authorize(...ADMINS),
  validate(z.object({ body: z.object({ studentIds: z.array(z.string()).min(1) }) })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const parent = await prisma.parent.findUnique({ where: { id: req.params.id } });
    if (!parent || parent.schoolId !== schoolId) throw ApiError.notFound("Parent not found");

    const { studentIds } = req.body as { studentIds: string[] };
    // Without the school filter this would attach any pupil on the platform to
    // this parent, handing them that child's results and fee records.
    const result = await prisma.student.updateMany({
      where: { schoolId, id: { in: studentIds } },
      data: { parentId: parent.id },
    });
    if (result.count !== new Set(studentIds).size) {
      throw ApiError.notFound("One or more of those students were not found");
    }
    audit(req, "parent.link_students", "Parent", parent.id);
    res.json({ success: true, message: "Students linked to parent" });
  })
);

export default router;
