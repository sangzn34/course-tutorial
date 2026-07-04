import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schemas/auth";
import z from "zod";

export async function POST(request: Request) {
  // email, password
  const payload = await request.json();
  const result = loginSchema.safeParse(payload);

  if (!result.success) {
    return new Response(JSON.stringify(z.treeifyError(result.error)), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return Response.json(
      { message: "Invalid email or password" },
      { status: 401 },
    );
  }

  // สร้าง session และตั้ง cookie
  await setSessionCookie({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return Response.json({ message: "Login successful" });
}
