import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sas/auth";
import { prisma } from "@/lib/db";
import TeacherShell from "./shell";

export default async function TeacherPage() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "TEACHER") redirect("/login");

  const [classes, attendance] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: u.id },
      select: { id: true, name: true, geofenceLat: true, geofenceLng: true, radiusMeters: true },
    }),
    prisma.attendance.findMany({
      where: { class: { teacherId: u.id } },
      include: { student: true, class: true },
      orderBy: { markedAt: "desc" },
      take: 100,
    }),
  ]);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todays = attendance.filter((a) => new Date(a.markedAt) >= dayStart);

  return (
    <TeacherShell
      me={{ id: u.id, name: u.name, email: u.email, role: u.role }}
      classes={classes}
      todaysCount={todays.filter((a) => a.status === "PRESENT").length}
      rejectedCount={todays.filter((a) => a.status === "REJECTED").length}
      logs={attendance.map((a) => ({
        id: a.id,
        markedAt: a.markedAt.toISOString(),
        className: a.class.name,
        studentName: a.student.name,
        studentId: a.student.studentId,
        distanceM: a.distanceM,
        status: a.status,
      }))}
    />
  );
}
