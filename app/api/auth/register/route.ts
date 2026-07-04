import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/schemas/auth";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const result = registerSchema.safeParse(payload);

  if (!result.success) {
    return Response.json(
      { message: result.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 },
    );
  }

  // HOMEWORK: Implement registration logic here
  // - Validate if email is already registered
  // - Hash the password
  // - Store the user in the database

  const { email, name, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ message: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    // role defaults to USER (schema). Admins are created via seed/manual.
    data: { email, name, passwordHash },
    select: { id: true, email: true, name: true, role: true },
  });

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return Response.json(user, { status: 201 });
}
