import { PrismaClient } from "@prisma/client";
import { hashPasswordBcrypt, hashPasswordScrypt } from "../src/lib/sas/auth";

const prisma = new PrismaClient();

async function main() {
  // Admin → bcrypt (Edge-friendly verification + middleware gating)
  await prisma.user.upsert({
    where: { email: "[email protected]" },
    update: { role: "ADMIN", passwordAlgo: "bcrypt", password: await hashPasswordBcrypt("admin123") },
    create: {
      email: "[email protected]", name: "System Admin",
      password: await hashPasswordBcrypt("admin123"),
      passwordAlgo: "bcrypt",
      role: "ADMIN",
    },
  });

  // Teacher → scrypt (legacy-compatible)
  await prisma.user.upsert({
    where: { email: "[email protected]" },
    update: { role: "TEACHER", passwordAlgo: "scrypt", password: await hashPasswordScrypt("teacher123") },
    create: {
      email: "[email protected]", name: "Dr. Anita Sharma",
      password: await hashPasswordScrypt("teacher123"),
      passwordAlgo: "scrypt",
      role: "TEACHER",
    },
  });

  // Students → scrypt
  const students = await Promise.all(
    [
      ["[email protected]", "Rohit Verma", "STU001"],
      ["[email protected]", "Priya Kapoor", "STU002"],
      ["[email protected]", "Arjun Mehta", "STU003"],
    ].map(async ([email, name, studentId]) =>
      prisma.user.upsert({
        where: { email: email as string },
        update: { role: "STUDENT", passwordAlgo: "scrypt", password: await hashPasswordScrypt("student123") },
        create: {
          email: email as string, name: name as string,
          password: await hashPasswordScrypt("student123"),
          passwordAlgo: "scrypt",
          role: "STUDENT",
          studentId: studentId as string,
        },
      })
    )
  );

  const teacher = await prisma.user.findUnique({ where: { email: "[email protected]" } });
  if (!teacher) throw new Error("seed: teacher missing");

  const klass = await prisma.class.upsert({
    where: { id: "demo-class" },
    update: {},
    create: {
      id: "demo-class",
      name: "Computer Science - 301",
      teacherId: teacher.id,
      geofenceLat: 12.9716, geofenceLng: 77.5946, radiusMeters: 150,
    },
  });

  for (const s of students) {
    await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId: s.id, classId: klass.id } },
      update: {},
      create: { studentId: s.id, classId: klass.id },
    });
  }

  console.log("✅ Seed complete (postgres)");
  console.log("Admin   : [email protected] / admin123      (bcrypt + JWT)");
  console.log("Teacher : [email protected] / teacher123   (scrypt + cookie)");
  console.log("Students: [email protected] / student123   (scrypt + cookie)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
