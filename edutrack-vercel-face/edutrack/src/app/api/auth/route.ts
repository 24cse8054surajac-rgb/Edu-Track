import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPasswordAny,
  createSession,
  destroySession,
} from "@/lib/sas/auth";

// Student / Teacher login (cookie-backed DB session, scrypt-hashed).
// Admins use /api/admin/login instead → bcrypt + signed JWT.
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || u.role === "ADMIN") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPasswordAny(password, u.password);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  await createSession(u.id);
  return NextResponse.json({ id: u.id, email: u.email, name: u.name, role: u.role });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
