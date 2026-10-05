import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPasswordScrypt } from "@/lib/sas/auth";

// POST and GET /api/students — admin-only (gated by middleware.ts).
// The middleware already enforced an ADMIN JWT, so we trust the caller
// here and don't re-check the DB.
export async function POST(req: NextRequest) {
  const { name, email, password, studentId } = await req.json();
  if (!name || !email || !password || !studentId)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (await prisma.user.findUnique({ where: { email } }))
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  const created = await prisma.user.create({
    data: {
      name, email,
      password: await hashPasswordScrypt(password),
      passwordAlgo: "scrypt",
      role: "STUDENT",
      studentId,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}

export async function GET() {
  return NextResponse.json(
    await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, studentId: true, faceEnrolledAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
  );
}
