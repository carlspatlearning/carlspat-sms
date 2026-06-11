import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export interface UploadResult {
  url: string;
  provider: "cloudinary" | "local";
}

/**
 * Upload an image buffer. Uses Cloudinary when configured (production),
 * otherwise saves under ./uploads and serves via /uploads (development).
 */
export async function uploadImage(buffer: Buffer, folder: string, filename: string): Promise<UploadResult> {
  if (env.cloudinary.enabled) {
    return uploadToCloudinary(buffer, folder, filename);
  }
  await fs.mkdir(path.join(LOCAL_UPLOAD_DIR, folder), { recursive: true });
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, folder, safeName), buffer);
  return { url: `/uploads/${folder}/${safeName}`, provider: "local" };
}

async function uploadToCloudinary(buffer: Buffer, folder: string, filename: string): Promise<UploadResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `carlspat/${folder}/${path.parse(filename).name}-${timestamp}`;
  // Cloudinary signed upload: SHA-1 over sorted params + api secret
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${env.cloudinary.apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  form.append("api_key", env.cloudinary.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { secure_url: string };
  return { url: data.secure_url, provider: "cloudinary" };
}

export { LOCAL_UPLOAD_DIR };
