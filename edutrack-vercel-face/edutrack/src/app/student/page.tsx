import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sas/auth";
import { prisma } from "@/lib/db";
import StudentShell from "./shell";

export default async function StudentPage() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "STUDENT") redirect("/login");

  const [enrolls, mine] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: u.id },
      include: { class: { include: { teacher: true } } },
    }),
    prisma.attendance.findMany({
      where: { studentId: u.id },
      include: { class: true },
      orderBy: { markedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <StudentShell
      me={{ id: u.id, name: u.name, email: u.email, role: u.role }}
      classes={enrolls.map((e) => ({
        id: e.class.id, name: e.class.name, teacher: e.class.teacher.name,
        lat: e.class.geofenceLat, lng: e.class.geofenceLng, radius: e.class.radiusMeters,
      }))}
      attendance={mine.map((a) => ({
        id: a.id, className: a.class.name, markedAt: a.markedAt.toISOString(),
        status: a.status, distanceM: a.distanceM,
        faceMatched: a.faceMatched, faceDistance: a.faceDistance,
      }))}
    />
  );
}
