import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/sas/auth";
import { haversineDistance } from "@/lib/utils";

function euclidean(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

// POST /api/attendance
// Body: { classId, lat, lng, accuracy, faceDescriptor? }
// Combines GPS geofence (Haversine, ≤ radius) AND
// face verification (descriptor, ≤ 0.45 Euclidean) when both are provided.
// Attendance row records both metrics for auditability.
export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (u.role !== "STUDENT")
    return NextResponse.json({ error: "Only students can mark" }, { status: 403 });

  const { classId, lat, lng, accuracy, faceDescriptor } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Bad coordinates" }, { status: 400 });
  }

  const klass = await prisma.class.findUnique({ where: { id: classId } });
  if (!klass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  // ── GPS gate ─────────────────────────────────────────────────────
  const dist = haversineDistance(lat, lng, klass.geofenceLat, klass.geofenceLng);
  const inside = dist <= klass.radiusMeters;
  if (inside && accuracy && accuracy > 75) {
    return NextResponse.json(
      { error: `GPS accuracy too low (${Math.round(accuracy)}m). Move outdoors or wait for a better fix.` },
      { status: 422 }
    );
  }

  // ── Face gate (optional, combined) ──────────────────────────────
  let faceMatched: boolean | null = null;
  let faceDistance: number | null = null;
  if (Array.isArray(faceDescriptor) && faceDescriptor.length === 128) {
    const db = await prisma.user.findUnique({
      where: { id: u.id },
      select: { faceDescriptor: true },
    });
    if (db?.faceDescriptor && db.faceDescriptor.length === 128) {
      faceDistance = euclidean(db.faceDescriptor, faceDescriptor);
      faceMatched = faceDistance <= 0.45;
    } else {
      faceMatched = false; // student tried to verify without enrolling
    }
  }

  // Both gates must pass to record PRESENT.
  // If the student did not submit a face descriptor we accept GPS-only
  // (face is an additional layer, not the only signal).
  const faceSubmitted = Array.isArray(faceDescriptor);
  const present = inside && (!faceSubmitted || faceMatched === true);

  // Prevent duplicate same-day PRESENT entries
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const existing = await prisma.attendance.findFirst({
    where: { studentId: u.id, classId, markedAt: { gte: start } },
  });
  if (existing && existing.status === "PRESENT") {
    return NextResponse.json({ ok: true, duplicate: true, attendance: existing });
  }

  const row = await prisma.attendance.create({
    data: {
      studentId: u.id, classId, lat, lng, accuracy: accuracy ?? null,
      status: present ? "PRESENT" : "REJECTED",
      distanceM: dist,
      faceMatched, faceDistance,
    },
  });

  return NextResponse.json({
    ok: true,
    present,
    reasons: {
      gps: { inside, distanceM: dist, accuracy },
      face: faceSubmitted
        ? { matched: faceMatched, distance: faceDistance }
        : { submitted: false },
    },
    attendance: row,
  });
}

export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");

  if (u.role === "STUDENT") {
    return NextResponse.json(
      await prisma.attendance.findMany({
        where: { studentId: u.id }, include: { class: true },
        orderBy: { markedAt: "desc" }, take: 50,
      })
    );
  }

  return NextResponse.json(
    await prisma.attendance.findMany({
      where: classId ? { classId } : undefined,
      include: { student: true, class: true },
      orderBy: { markedAt: "desc" }, take: 200,
    })
  );
}
