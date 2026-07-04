import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

type SessionPayload = {
  userId: string;
  email: string;
  role: string;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(getSecret());
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSessionToken(payload);
  const store = await cookies();

  store.set({
    name: "session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 hours
  });
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    return {
      userId: payload.sub as string,
      email: payload.email as string,
      role: payload.role as string,
    };
  } catch (err) {
    console.error("Invalid session token:", err);
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get("session")?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete("session");
}

export async function requireRole(role: SessionPayload["role"]) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== role) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }
  return session;
}
