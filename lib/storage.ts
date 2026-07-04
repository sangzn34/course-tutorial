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
    return saveToSupabase(filename, bytes, file.type);
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

async function saveToSupabase(
  filename: string,
  bytes: Buffer<ArrayBuffer>,
  contentType: string,
): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET ?? "product-images";
  if (!url || !key) {
    throw new UploadError(
      "Supabase env ไม่ครบ (SUPABASE_URL / SERVICE_ROLE_KEY)",
    );
  }

  // Supabase Storage REST — ไม่ต้องลง @supabase/supabase-js (fetch พอ)
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${filename}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": contentType },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(
      `Supabase upload failed: ${res.status} ${await res.text()}`,
    );
  }
  // bucket ต้องตั้งเป็น public ถึงจะเปิด URL นี้ได้
  return `${url}/storage/v1/object/public/${bucket}/${filename}`;
}
