import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export class UploadError extends Error {}

// ตรวจชนิดจาก magic bytes (ลายเซ็นไฟล์จริง) ไม่เชื่อ file.type จาก client —
// PDF ที่ browser ส่งมาเป็น application/octet-stream ก็ผ่านถ้าเนื้อเป็น PDF จริง,
// ขณะที่ไฟล์มั่ว ๆ ที่อ้างเป็น octet-stream จะไม่ตรงลายเซ็น = ถูกปฏิเสธ
export function sniff(b: Buffer): { type: string; ext: string } | null {
  const s = (i: number, j: number) => b.subarray(i, j).toString("latin1");
  if (b.length >= 4 && s(0, 4) === "%PDF") return { type: "application/pdf", ext: "pdf" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && s(0, 8) === "\x89PNG\r\n\x1a\n")
    return { type: "image/png", ext: "png" };
  if (b.length >= 12 && s(0, 4) === "RIFF" && s(8, 12) === "WEBP")
    return { type: "image/webp", ext: "webp" };
  return null;
}

export async function saveImage(file: File) {
  if (file.size > MAX_BYTES) throw new UploadError("ไฟล์ใหญ่เกิน 5MB");

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) throw new UploadError("รองรับเฉพาะ jpeg/png/webp/pdf");

  const filename = `${crypto.randomUUID()}.${kind.ext}`;

  if (process.env.STORAGE_DRIVER === "supabase") {
    return saveToSupabase(filename, bytes, kind.type);
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
