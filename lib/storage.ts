import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ALLOWED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/octet-stream",
];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export class UploadError extends Error {}

export async function saveImage(file: File) {
  if (!ALLOWED.includes(file.type))
    throw new UploadError("รองรับเฉพาะ jpeg/png/webp/pdf");
  if (file.size > MAX_BYTES) throw new UploadError("ไฟล์ใหญ่เกิน 5MB");

  const ext = file.type.split("/")[1];
  const filename = `${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (process.env.STORAGE_DRIVER === "supabase") {
    // upload to supabase
  } else {
    return saveToLocal(filename, bytes);
  }
}

async function saveToLocal(filename: string, bytes: Buffer<ArrayBuffer>) {
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), bytes);
  return `/uploads/${filename}`;
}
