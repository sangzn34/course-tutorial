import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth/session";

const AUTH_PROTECTED_PREFIXES = ["/orders"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // pathname = menu // pass
  // pathname = /orders // protected
  // pathname = /orders/1 // protected
  if (!AUTH_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const isVerified = token ? await verifySessionToken(token) : null;

  if (!isVerified) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
