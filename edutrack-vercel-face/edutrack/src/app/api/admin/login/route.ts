import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPasswordBcrypt,
  signAdminJWT,
  setAdminCookie,
  clearAdminCookie,
  hashPasswordBcrypt,
} from "@/lib/sas/auth";

// POST /api/admin/login   { email, password }   → bcrypt + JWT
// DELETE /api/admin/login                     → logout
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN") {
    // generic message — don't leak which axis failed
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  // Admins may have been migrated from scrypt in the past; accept either.
  const ok = user.passwordAlgo === "bcrypt"
    ? await verifyPasswordBcrypt(password, user.password)
    : await verifyPasswordBcrypt(password, user.password); // both stored bcrypt now
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const jwt = await signAdminJWT({
    sub: user.id, email: user.email, name: user.name, role: "ADMIN",
  });
  await setAdminCookie(jwt);
  return NextResponse.json({
    id: user.id, email: user.email, name: user.name, role: "ADMIN",
  });
}

export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
