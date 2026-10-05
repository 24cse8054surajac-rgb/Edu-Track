import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/sas/auth";

// Euclidean distance between two 128-d face-api descriptors.
// Threshold 0.45 is recommended by @vladmandic/face-api for a "match".
function euclidean(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

// POST /api/face/verify { descriptor: number[] } → compares to the
// current user's stored descriptor and returns { matched, distance }.
// The student portal uses this immediately before posting GPS attendance.
export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { descriptor } = await req.json();
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json({ error: "Bad descriptor" }, { status: 400 });
  }

  const db = await prisma.user.findUnique({
    where: { id: u.id },
    select: { faceDescriptor: true },
  });
  if (!db?.faceDescriptor || db.faceDescriptor.length !== 128) {
    return NextResponse.json(
      { matched: false, reason: "NO_ENROLLMENT", distance: null },
      { status: 200 }
    );
  }

  const distance = euclidean(db.faceDescriptor, descriptor);
  const matched = distance <= 0.45;
  return NextResponse.json({ matched, distance });
}
