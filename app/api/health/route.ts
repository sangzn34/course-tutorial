import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // อย่า cache — ต้องเช็คสด

// จำแนก DB จาก host ของ DATABASE_URL (ไม่โชว์ user/รหัส)
function classifyDb(): string {
  try {
    const host = new URL(process.env.DATABASE_URL ?? "").hostname;
    if (host.includes("supabase")) return "supabase";
    if (host === "db") return "vps-self-host";
    if (host === "host.docker.internal" || host === "localhost" || host === "127.0.0.1")
      return "local-docker";
    return host; // อย่างอื่นคืน host เปล่า ๆ (ไม่มี creds)
  } catch {
    return "unknown";
  }
}

export async function GET() {
  let db = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    db = "down";
  }

  return Response.json(
    {
      ok: db === "up",
      db, // up / down (เช็ค app + DB พร้อมกัน)
      database: classifyDb(), // supabase / vps-self-host / local-docker
      storage: process.env.STORAGE_DRIVER ?? "local",
      env: process.env.NODE_ENV,
    },
    { status: db === "up" ? 200 : 503 },
  );
}
