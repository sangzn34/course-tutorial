import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

type SessionPayload = {
  userId: string;
  email: string;
  role: string;
};

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
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || "default_secret"));
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
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET || "default_secret"),
    );

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
