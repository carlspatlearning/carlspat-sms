import { Router } from "express";
import multer from "multer";
import { Role } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { uploadImage } from "../services/storage";

const router = Router();
router.use(authenticate);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, "Only JPEG, PNG or WebP images are allowed"));
    }
    cb(null, true);
  },
});

// POST /uploads/passport — student passport photographs (admin)
router.post(
  "/passport",
  authorize(...ADMINS),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded (use multipart field 'file')");
    const result = await uploadImage(req.file.buffer, "passports", req.file.originalname);
    audit(req, "upload.passport", "File", result.url);
    res.status(201).json({ success: true, data: result });
  })
);

// POST /uploads/logo — school logo / stamp (admin)
router.post(
  "/logo",
  authorize(...ADMINS),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded (use multipart field 'file')");
    const result = await uploadImage(req.file.buffer, "branding", req.file.originalname);
    audit(req, "upload.logo", "File", result.url);
    res.status(201).json({ success: true, data: result });
  })
);

// POST /uploads/avatar — any logged-in user's profile photo
router.post(
  "/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded (use multipart field 'file')");
    const result = await uploadImage(req.file.buffer, "avatars", req.file.originalname);
    res.status(201).json({ success: true, data: result });
  })
);

// POST /uploads/materials — learning materials (teachers/admins); students download
router.post(
  "/materials",
  authorize(Role.TEACHER, ...ADMINS),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded (use multipart field 'file')");
    const result = await uploadImage(req.file.buffer, "materials", req.file.originalname);
    audit(req, "upload.material", "File", result.url);
    res.status(201).json({ success: true, data: result });
  })
);

export default router;
