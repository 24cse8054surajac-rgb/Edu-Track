"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState("[email protected]");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // if already logged in, bounce
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!u) return;
        if (u.role === "ADMIN") r.replace("/admin");
        else if (u.role === "TEACHER") r.replace("/teacher");
        else r.replace("/student");
      })
      .catch(() => {});
  }, [r]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const u = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || "Login failed");
        }
        return r.json();
      });
      if (u.role === "ADMIN") r.replace("/admin");
      else if (u.role === "TEACHER") r.replace("/teacher");
      else r.replace("/student");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass glow rounded-2xl p-8 w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-400/70">
              EduTrack
            </div>
            <div className="text-lg font-semibold">Sign in</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-white/10 focus:border-emerald-400/40 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-white/10 focus:border-emerald-400/40 outline-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-400 text-slate-900 font-medium hover:bg-emerald-300 disabled:opacity-50 transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-400 leading-relaxed">
          <div className="font-medium text-slate-300 mb-1">Demo accounts</div>
          <div>[email protected] · admin123</div>
          <div>[email protected] · teacher123</div>
          <div>[email protected] · student123</div>
        </div>
      </motion.div>
    </main>
  );
}
