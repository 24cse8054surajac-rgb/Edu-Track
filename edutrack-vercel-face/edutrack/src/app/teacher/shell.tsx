"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, LogOut, Users, CheckCircle2, XCircle } from "lucide-react";

type Klass = {
  id: string;
  name: string;
  geofenceLat: number;
  geofenceLng: number;
  radiusMeters: number;
};
type Log = {
  id: string;
  markedAt: string;
  className: string;
  studentName: string;
  studentId: string | null;
  distanceM: number;
  status: string;
};

export default function TeacherShell({
  me,
  classes,
  todaysCount,
  rejectedCount,
  logs,
}: {
  me: { id: string; name: string; email: string; role: string };
  classes: Klass[];
  todaysCount: number;
  rejectedCount: number;
  logs: Log[];
}) {
  const r = useRouter();
  async function logout() {
    await fetch("/api/auth", { method: "DELETE", credentials: "include" });
    r.replace("/login");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-emerald-400/70 uppercase tracking-widest">
                EduTrack
              </div>
              <div className="font-semibold">Teacher Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{me.name}</div>
              <div className="text-xs text-slate-400">{me.email}</div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg border border-white/10 hover:border-white/30"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="My classes" value={classes.length} icon={<Users />} />
          <Stat
            label="Today present"
            value={todaysCount}
            icon={<CheckCircle2 />}
            accent
          />
          <Stat
            label="Today rejected"
            value={rejectedCount}
            icon={<XCircle />}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" /> My classes
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {classes.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 p-4">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Geofence: {c.geofenceLat.toFixed(4)},{" "}
                  {c.geofenceLng.toFixed(4)} · radius {c.radiusMeters} m
                </div>
              </div>
            ))}
            {classes.length === 0 && (
              <div className="text-sm text-slate-400">
                You don't teach any class yet.
              </div>
            )}
          </div>
        </motion.div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-medium mb-4">Recent attendance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-2">When</th>
                  <th className="py-2">Class</th>
                  <th className="py-2">Student</th>
                  <th className="py-2">Distance</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-white/5">
                    <td className="py-3">
                      {new Date(l.markedAt).toLocaleString()}
                    </td>
                    <td>{l.className}</td>
                    <td>
                      {l.studentName}{" "}
                      <span className="text-xs text-slate-500">
                        ({l.studentId})
                      </span>
                    </td>
                    <td>{l.distanceM} m</td>
                    <td>
                      {l.status === "PRESENT" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="w-4 h-4" />
                          PRESENT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-300">
                          <XCircle className="w-4 h-4" />
                          REJECTED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No attendance recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`glass rounded-2xl p-5 ${
        accent ? "border-emerald-400/30" : ""
      }`}
    >
      <div className="flex items-center justify-between text-slate-400">
        <div className="text-xs uppercase tracking-wider">{label}</div>
        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div
        className={`text-3xl font-semibold mt-1 ${
          accent ? "text-emerald-300" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
