import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { LOCAL_UPLOAD_DIR } from "./services/storage";

import authRoutes from "./routes/auth";
import settingsRoutes from "./routes/settings";
import studentRoutes from "./routes/students";
import teacherRoutes from "./routes/teachers";
import parentRoutes from "./routes/parents";
import classRoutes from "./routes/classes";
import subjectRoutes from "./routes/subjects";
import attendanceRoutes from "./routes/attendance";
import resultRoutes from "./routes/results";
import reportCardRoutes from "./routes/reportCards";
import feeRoutes from "./routes/fees";
import paymentRoutes from "./routes/payments";
import announcementRoutes from "./routes/announcements";
import messageRoutes from "./routes/messages";
import dashboardRoutes from "./routes/dashboard";
import uploadRoutes from "./routes/uploads";
import userRoutes from "./routes/users";

export function createApp() {
  const app = express();

  // Behind a proxy (Railway/Render/AWS LB) so req.ip and secure cookies work
  app.set("trust proxy", 1);

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    })
  );

  // Global rate limit + a stricter limit for auth endpoints (brute-force guard)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: () => env.isTest,
    })
  );
  app.use(
    "/api/v1/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
      skip: () => env.isTest,
    })
  );

  // Webhooks need the raw body for signature verification — mount before json()
  app.use("/api/v1/payments/webhooks", express.raw({ type: "application/json" }));
  app.use(express.json({ limit: "1mb" }));

  // Local file storage (development fallback for Cloudinary)
  app.use("/uploads", express.static(LOCAL_UPLOAD_DIR, { maxAge: "1d" }));

  // ── Routes ────────────────────────────────────────────────────────────────
  app.get("/api/v1/health", (_req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/settings", settingsRoutes);
  app.use("/api/v1/students", studentRoutes);
  app.use("/api/v1/teachers", teacherRoutes);
  app.use("/api/v1/parents", parentRoutes);
  app.use("/api/v1/classes", classRoutes);
  app.use("/api/v1/subjects", subjectRoutes);
  app.use("/api/v1/attendance", attendanceRoutes);
  app.use("/api/v1/results", resultRoutes);
  app.use("/api/v1/report-cards", reportCardRoutes);
  app.use("/api/v1/fees", feeRoutes);
  app.use("/api/v1/payments", paymentRoutes);
  app.use("/api/v1/announcements", announcementRoutes);
  app.use("/api/v1/messages", messageRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/uploads", uploadRoutes);
  app.use("/api/v1/users", userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
