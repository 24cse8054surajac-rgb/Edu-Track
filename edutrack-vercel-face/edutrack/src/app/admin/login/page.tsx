"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const r = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from") || "/admin";

  const [email, setEmail] = useState("[email protected]");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }), credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Login failed");
      r.replace(from);
    } catch (ex: any) {
      setError(ex.message);
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
        className="glass glow rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" /></div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-400/70">EduTrack · Restricted</div>
            <div className="text-lg font-semibold">Admin sign in</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Admin email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-white/10 focus:border-amber-400/40 outline-none"/>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-white/10 focus:border-amber-400/40 outline-none"/>
          </div>
          {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          <button disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-400 text-slate-900 font-medium disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin"/>} Sign in as admin</button>
        </form>

        <div className="mt-6 text-xs text-slate-400 leading-relaxed">
          <div className="font-medium text-slate-300 mb-1">Admin demo</div>
          <div>[email protected] · admin123</div>
          <div className="mt-2 text-slate-500">
            Admins use bcrypt + a signed JWT verified by Edge middleware.
            Student/teacher login lives at <a className="text-emerald-300 underline" href="/login">/login</a>.
          </div>
        </div>
      </motion.div>
    </main>
  );
}
