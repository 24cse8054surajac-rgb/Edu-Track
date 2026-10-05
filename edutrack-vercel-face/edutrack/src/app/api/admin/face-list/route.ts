import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/admin/face-list — admin-only roster view of enrolled faces.
// (middleware.ts already gates this path)
export async function GET() {
  const rows = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true, name: true, email: true, studentId: true,
      faceEnrolledAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows);
}
