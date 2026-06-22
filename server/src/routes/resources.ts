import { Request, Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Role, ResourceType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { uploadDocument, UploadResult } from "../services/storage";

const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOC_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, "Only PDF or Word (.docx) documents are allowed"));
    }
    cb(null, true);
  },
});

function withAbsoluteUrl(req: Request, result: UploadResult): UploadResult {
  if (result.provider === "local" && result.url.startsWith("/")) {
    return { ...result, url: `${req.protocol}://${req.get("host")}${result.url}` };
  }
  return result;
}

function makeAbsolute(req: Request, url: string): string {
  if (url.startsWith("/")) return `${req.protocol}://${req.get("host")}${url}`;
  return url;
}

const router = Router();
router.use(authenticate);

// POST /resources — upload a resource document (teachers + admins)
router.post(
  "/",
  authorize(Role.TEACHER, ...ADMINS),
  docUpload.single("file"),
  validate(
    z.object({
      body: z.object({
        title: z.string().min(2).max(200),
        description: z.string().max(500).optional(),
        type: z.nativeEnum(ResourceType),
        classRoomId: z.string().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded (use multipart field 'file')");
    const { title, description, type, classRoomId } = req.body as {
      title: string; description?: string; type: ResourceType; classRoomId?: string;
    };
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.badRequest("School not configured");

    const uploaded = withAbsoluteUrl(req, await uploadDocument(req.file.buffer, "resources", req.file.originalname));

    const resource = await prisma.resource.create({
      data: {
        schoolId: school.id,
        title,
        description: description ?? null,
        type,
        fileUrl: uploaded.url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        classRoomId: classRoomId || null,
        uploadedById: req.auth!.sub,
      },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true } },
        classRoom: { select: { id: true, name: true } },
      },
    });

    audit(req, "resource.upload", "Resource", resource.id, { title, type });
    res.status(201).json({ success: true, data: resource });
  })
);

// GET /resources — list resources (role-filtered)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const role = req.auth!.role;
    let classRoomFilter: { OR: object[] } | undefined;

    if (role === Role.PARENT) {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.auth!.sub },
        include: { students: { select: { classRoomId: true } } },
      });
      const ids = (parent?.students ?? []).map((s) => s.classRoomId).filter(Boolean) as string[];
      classRoomFilter = { OR: [{ classRoomId: null }, { classRoomId: { in: ids } }] };
    } else if (role === Role.STUDENT) {
      const student = await prisma.student.findUnique({ where: { userId: req.auth!.sub } });
      const ids = student?.classRoomId ? [student.classRoomId] : [];
      classRoomFilter = { OR: [{ classRoomId: null }, { classRoomId: { in: ids } }] };
    }

    const { classId, type } = req.query as Record<string, string | undefined>;

    // Staff can filter by classId/type; parents/students get server-enforced class filter only
    const where: Record<string, unknown> = classRoomFilter ?? {};
    if (!classRoomFilter) {
      if (classId) where.classRoomId = classId;
    }
    if (type && Object.values(ResourceType).includes(type as ResourceType)) {
      where.type = type as ResourceType;
    }

    const resources = await prisma.resource.findMany({
      where,
      include: {
        uploadedBy: { select: { firstName: true, lastName: true } },
        classRoom: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = resources.map((r) => ({ ...r, fileUrl: makeAbsolute(req, r.fileUrl) }));
    res.json({ success: true, data: items });
  })
);

// DELETE /resources/:id — admins can delete any; teachers can only delete their own
router.delete(
  "/:id",
  authorize(Role.TEACHER, ...ADMINS),
  asyncHandler(async (req, res) => {
    const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
    if (!resource) throw ApiError.notFound("Resource not found");
    if (req.auth!.role === Role.TEACHER && resource.uploadedById !== req.auth!.sub) {
      throw ApiError.forbidden("You can only delete your own uploads");
    }
    await prisma.resource.delete({ where: { id: req.params.id } });
    audit(req, "resource.delete", "Resource", req.params.id);
    res.json({ success: true, message: "Resource deleted" });
  })
);

export default router;
