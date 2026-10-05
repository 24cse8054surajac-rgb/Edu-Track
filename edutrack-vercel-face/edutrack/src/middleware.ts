// Edge middleware — protects /admin and admin-only API routes.
// Verifies the admin JWT (signed with ADMIN_JWT_SECRET) directly in
// edge runtime via the jose library, no DB roundtrip needed.

import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "edutrack_admin";

async function verify(token: string) {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || "";
  if (!secret) return null;
  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { issuer: "edutrack" }
    );
    return payload as { sub?: string; role?: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Admin pages
  if (url.pathname.startsWith("/admin") && url.pathname !== "/admin/login") {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const valid = token ? await verify(token) : null;
    if (!valid) {
      const redirect = new URL("/admin/login", req.url);
      redirect.searchParams.set("from", url.pathname);
      return NextResponse.redirect(redirect);
    }
    if (valid.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  // Admin-only API routes (write side)
  if (
    url.pathname.startsWith("/api/admin/") ||
    url.pathname === "/api/students"
  ) {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const valid = token ? await verify(token) : null;
    if (!valid || valid.role !== "ADMIN") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/students"],
};
