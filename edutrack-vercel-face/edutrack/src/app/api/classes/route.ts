import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/sas/auth";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  if (u.role === "ADMIN") {
    const all = await prisma.class.findMany({
      include: { teacher: true, _count: { select: { enrollments: true } } },
    });
    return NextResponse.json(all);
  }

  if (u.role === "TEACHER") {
    const mine = await prisma.class.findMany({
      where: { teacherId: u.id },
      include: { _count: { select: { enrollments: true } } },
    });
    return NextResponse.json(mine);
  }

  // student: classes they are enrolled in
  const enrolls = await prisma.enrollment.findMany({
    where: { studentId: u.id },
    include: { class: true },
  });
  return NextResponse.json(enrolls.map((e) => e.class));
}
