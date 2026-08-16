import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";

const router = Router();
router.use(authenticate, requireActiveSchool);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const subjects = await prisma.subject.findMany({
      where: { schoolId: currentSchoolId(req) },
      include: { _count: { select: { classSubjects: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: subjects });
  })
);

const subjectBody = z.object({ name: z.string().min(2), code: z.string().min(2).max(8).toUpperCase() });

router.post(
  "/",
  authorize(...ADMINS),
  validate(z.object({ body: subjectBody })),
  asyncHandler(async (req, res) => {
    const subject = await prisma.subject.create({ data: { ...req.body, schoolId: currentSchoolId(req) } });
    audit(req, "subject.create", "Subject", subject.id);
    res.status(201).json({ success: true, data: subject });
  })
);

router.put(
  "/:id",
  authorize(...ADMINS),
  validate(z.object({ body: subjectBody.partial() })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.subject.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Subject not found");

    const subject = await prisma.subject.update({ where: { id: req.params.id }, data: req.body });
    audit(req, "subject.update", "Subject", subject.id);
    res.json({ success: true, data: subject });
  })
);

router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const existing = await prisma.subject.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Subject not found");

    const scoreCount = await prisma.score.count({ where: { subjectId: req.params.id } });
    if (scoreCount > 0) throw ApiError.conflict("Cannot delete a subject that already has recorded scores");
    await prisma.subject.delete({ where: { id: req.params.id } });
    audit(req, "subject.delete", "Subject", req.params.id);
    res.json({ success: true, message: "Subject deleted" });
  })
);

export default router;
