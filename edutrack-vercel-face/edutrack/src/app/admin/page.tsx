import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import AdminShell from "./shell";

const ADMIN_COOKIE = "edutrack_admin";

async function requireAdmin() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  const secret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || "";
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(
      token, new TextEncoder().encode(secret), { issuer: "edutrack" }
    );
    if (payload.role !== "ADMIN") return null;
    return { id: String(payload.sub), email: String(payload.email), name: String(payload.name), role: "ADMIN" as const };
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const u = await requireAdmin();
  if (!u) redirect("/admin/login");

  const [students, classes, all] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, studentId: true, faceEnrolledAt: true },
    }),
    prisma.class.findMany({ include: { teacher: true } }),
    prisma.attendance.findMany({
      include: { student: true, class: true }, orderBy: { markedAt: "desc" }, take: 200,
    }),
  ]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = all.filter((a) => new Date(a.markedAt) >= today);

  return (
    <AdminShell
      me={u}
      students={students}
      classes={classes}
      attendance={all}
      stats={{
        total: all.length,
        todayPresent: todays.filter((a) => a.status === "PRESENT").length,
        todayRejected: todays.filter((a) => a.status === "REJECTED").length,
        studentCount: students.length,
        classCount: classes.length,
        faceEnrolledCount: students.filter((s) => s.faceEnrolledAt).length,
      }}
    />
  );
}
