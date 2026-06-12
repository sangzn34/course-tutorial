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
    .sign(
      new TextEncoder().encode(
        "5911f3e9791f72c4f9e2004555606e0c838ed27e171f080055eb7e30754b22b4",
      ),
    );
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
