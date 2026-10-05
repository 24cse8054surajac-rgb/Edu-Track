import Link from "next/link";
import { getCurrentUser } from "@/lib/sas/auth";
import { redirect } from "next/navigation";
import { MapPin, ShieldCheck, Users, BarChart3, Camera } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "ADMIN") redirect("/admin");
    if (user.role === "TEACHER") redirect("/teacher");
    if (user.role === "STUDENT") redirect("/student");
  }

  const features = [
    (
      <Feature
        key="geo"
        icon={<MapPin className="w-6 h-6" />}
        title="GPS Geofencing"
        text="Attendance is only marked when the student's device is inside the class radius."
      />
    ),
    (
      <Feature
        key="roles"
        icon={<Users className="w-6 h-6" />}
        title="Three Role Portals"
        text="Separate dashboards for Admin, Teacher, and Student — with permission boundaries."
      />
    ),
    (
      <Feature
        key="dash"
        icon={<BarChart3 className="w-6 h-6" />}
        title="Live Attendance Charts"
        text="Recharts-powered overview tab shows daily and per-class metrics in real time."
      />
    ),
    (
      <Feature
        key="auth"
        icon={<ShieldCheck className="w-6 h-6" />}
        title="Secure Sessions"
        text="Passwords hashed with Node crypto scryptSync; sessions via random tokens in cookies."
      />
    ),
    (
      <Feature
        key="face"
        icon={<Camera className="w-6 h-6" />}
        title="Face Verification Hook"
        text="Optional @vladmandic/face-api integration surface ready to plug in for identity check."
      />
    ),
  ];

  return (
    <main className="min-h-screen">
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-sm uppercase tracking-[0.2em] text-emerald-400/80">
            EduTrack
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-semibold leading-tight">
          GPS-based student
          <br />
          attendance, made reliable.
        </h1>
        <p className="mt-6 text-lg text-slate-300 max-w-2xl">
          EduTrack verifies a student's physical presence using their device's
          GPS, applies a geofence against the classroom anchor, and writes a
          signed attendance row to SQLite — all behind a clean three-role portal.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-emerald-400 text-slate-900 font-medium hover:bg-emerald-300 transition"
          >
            Sign in
          </Link>
          <a
            href="#features"
            className="px-6 py-3 rounded-xl border border-white/15 hover:border-white/30 transition"
          >
            See features
          </a>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-6 hover:border-emerald-400/30 transition"
            >
              {f}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <>
      <div className="w-11 h-11 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
    </>
  );
}
