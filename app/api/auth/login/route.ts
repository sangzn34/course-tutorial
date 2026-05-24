import { prisma } from "@/lib/prisma";
import z from "zod";

const loginScheme = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  // username, password
  const payload = await request.json();
  const result = loginScheme.safeParse(payload);

  if (!result.success) {
    return new Response(JSON.stringify(z.treeifyError(result.error)), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password } = result.data;

  console.log("Received login data:", { username, password });

  const user = await prisma.user.findUnique({
    where: { email: username, passwordHash: password },
  });

  if (!user) {
    return Response.json(
      { message: "Invalid username or password" },
      { status: 401 },
    );
  }

  return Response.json({ message: "Login successful" });
}
