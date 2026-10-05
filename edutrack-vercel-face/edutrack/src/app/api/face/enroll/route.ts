import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/sas/auth";

// POST /api/face/enroll  { descriptor: number[] }  → stores the 128-d
// face-api descriptor on the current user. Students can self-enroll;
// admin can also enroll anyone via /api/admin/face-enroll (matched one).
export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { descriptor } = await req.json();
  if (!Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return NextResponse.json(
      { error: "Descriptor must be 128 finite numbers" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: u.id },
    data: { faceDescriptor: descriptor, faceEnrolledAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Self-status: lets the UI decide whether to show "Enroll your face" or "Re-enroll".
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ enrolled: false });
  const db = await prisma.user.findUnique({
    where: { id: u.id },
    select: { faceEnrolledAt: true },
  });
  return NextResponse.json({
    enrolled: !!db?.faceEnrolledAt,
    enrolledAt: db?.faceEnrolledAt ?? null,
  });
}
