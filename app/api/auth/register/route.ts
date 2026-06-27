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

  return Response.json({ message: "Register API - To be implemented" });
}
