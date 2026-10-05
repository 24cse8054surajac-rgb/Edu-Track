"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, BookOpen, LogOut, Plus, MapPin, CheckCircle2, XCircle, BarChart3, ScanFace } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";

type Student = { id: string; name: string; email: string; studentId: string | null; faceEnrolledAt: string | Date | null };
type Klass = { id: string; name: string; teacher: { name: string }; geofenceLat: number; geofenceLng: number; radiusMeters: number };
type Attendance = { id: string; markedAt: string | Date; status: string; distanceM: number; lat: number; lng: number; faceMatched: boolean | null; faceDistance: number | null; student: { name: string; studentId: string | null }; class: { name: string } };

export default function AdminShell({ me, students, classes, attendance, stats }: {
  me: { id: string; name: string; email: string; role: "ADMIN" };
  students: Student[]; classes: Klass[]; attendance: Attendance[];
  stats: { total: number; todayPresent: number; todayRejected: number; studentCount: number; classCount: number; faceEnrolledCount: number };
}) {
  const r = useRouter();
  const [tab, setTab] = useState<"overview"|"students"|"classes"|"logs">("overview");

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
    r.replace("/admin/login");
  }

  const byDay: Record<string, number> = {};
  for (const a of attendance) if (a.status === "PRESENT") {
    const k = new Date(a.markedAt).toISOString().slice(0, 10);
    byDay[k] = (byDay[k] ?? 0) + 1;
  }
  const series = Object.entries(byDay).sort().slice(-7).map(([day, count]) => ({ day: day.slice(5), count }));
  const presentCount = attendance.filter((a) => a.status === "PRESENT").length;
  const rejectedCount = attendance.filter((a) => a.status === "REJECTED").length;
  const pieData = [
    { name: "Present", value: presentCount || 1, color: "#10b981" },
    { name: "Rejected", value: rejectedCount, color: "#ef4444" },
  ];

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center"><ShieldCheckIcon /></div>
            <div><div className="text-xs text-amber-400/70 uppercase tracking-widest">EduTrack · Restricted</div><div className="font-semibold">Admin Console</div></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right"><div className="text-sm font-medium">{me.name}</div><div className="text-xs text-slate-400">{me.email}</div></div>
            <button onClick={logout} className="p-2 rounded-lg border border-white/10" aria-label="Logout"><LogOut className="w-4 h-4"/></button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-1 border-b border-white/5 mb-6 flex-wrap">
          {[
            {id:"overview",l:"Overview",i:BarChart3},
            {id:"students",l:"Students",i:Users},
            {id:"classes",l:"Classes",i:BookOpen},
            {id:"logs",l:"Logs",i:MapPin},
          ].map((t) => {
            const A = tab === t.id;
            return <button key={t.id} onClick={()=>setTab(t.id as any)} className={`px-4 py-2.5 text-sm flex items-center gap-2 border-b-2 transition ${A?"border-amber-400 text-amber-300":"border-transparent text-slate-400 hover:text-slate-200"}`}><t.i className="w-4 h-4"/>{t.l}</button>;
          })}
        </div>

        {tab === "overview" && (
          <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Students" value={stats.studentCount}/>
              <Stat label="Classes" value={stats.classCount}/>
              <Stat label="Today Present" value={stats.todayPresent} accent/>
              <Stat label="Today Rejected" value={stats.todayRejected}/>
              <Stat label="Faces enrolled" value={stats.faceEnrolledCount}/>
              <Stat label="Total logs" value={stats.total}/>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-amber-400"/><h3 className="font-medium">Last 7 days attendance</h3></div>
                <div className="h-64"><ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3"/>
                    <XAxis dataKey="day" stroke="#64748b"/><YAxis stroke="#64748b" allowDecimals={false}/>
                    <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #1e293b",color:"#e2e8f0"}}/>
                    <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{fill:"#f59e0b",r:4}}/>
                  </LineChart>
                </ResponsiveContainer></div>
              </div>
              <div className="glass rounded-2xl p-6">
                <h3 className="font-medium mb-4">Status mix</h3>
                <div className="h-64"><ResponsiveContainer>
                  <PieChart><Pie data={pieData} outerRadius={80} innerRadius={40} dataKey="value" label>
                    {pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Legend/></PieChart>
                </ResponsiveContainer></div>
              </div>
            </div>
          </motion.section>
        )}

        {tab === "students" && <StudentsTab initial={students}/>}
        {tab === "classes" && <ClassesTab initial={classes}/>}
        {tab === "logs" && <LogsTab rows={attendance}/>}
      </div>
    </main>
  );
}

function ShieldCheckIcon() {
  return <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
}

function Stat({label,value,accent}:{label:string;value:number;accent?:boolean}){
  return <div className={`glass rounded-2xl p-5 ${accent?"border-amber-400/30":""}`}>
    <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
    <div className={`text-3xl font-semibold mt-1 ${accent?"text-amber-300":""}`}>{value}</div>
  </div>;
}

function StudentsTab({initial}:{initial:Student[]}){
  const [list,setList]=useState(initial);
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [studentId,setStudentId]=useState("");
  const [busy,setBusy]=useState(false); const [err,setErr]=useState<string|null>(null);

  async function add(e:React.FormEvent){
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/students", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({name,email,password,studentId}),
        credentials:"include",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setList([{id:j.id,name,email,studentId,faceEnrolledAt:null},...list]);
      setName("");setEmail("");setPassword("");setStudentId("");
    } catch (ex:any){ setErr(ex.message); } finally { setBusy(false); }
  }
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={add} className="glass rounded-2xl p-6 space-y-3">
        <h3 className="font-medium flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400"/> Add student</h3>
        <Input label="Full name" value={name} onChange={setName} placeholder="Jane Doe"/>
        <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="[email protected]"/>
        <Input label="Initial password" value={password} onChange={setPassword} placeholder="student123"/>
        <Input label="Student ID" value={studentId} onChange={setStudentId} placeholder="STU004"/>
        {err && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
        <button disabled={busy} className="w-full px-4 py-2.5 rounded-lg bg-amber-400 text-slate-900 font-medium disabled:opacity-50">{busy?"Saving…":"Create student"}</button>
      </form>
      <div className="glass rounded-2xl p-6 lg:col-span-2">
        <h3 className="font-medium mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-amber-400"/> Roster ({list.length})</h3>
        <div className="divide-y divide-white/5">
          {list.map(s=>(
            <div key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-slate-400">{s.studentId} · {s.email}</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {s.faceEnrolledAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-md px-2 py-1">
                    <ScanFace className="w-3.5 h-3.5"/> face enrolled
                  </span>
                ) : (
                  <span className="text-slate-500 bg-white/5 border border-white/10 rounded-md px-2 py-1">no face</span>
                )}
              </div>
            </div>
          ))}
          {list.length===0 && <div className="py-6 text-sm text-slate-500">No students yet.</div>}
        </div>
      </div>
    </div>
  );
}

function ClassesTab({initial}:{initial:Klass[]}){
  return <div className="glass rounded-2xl p-6">
    <h3 className="font-medium mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber-400"/> Classes ({initial.length})</h3>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="text-left text-slate-400 border-b border-white/10"><tr>
        <th className="py-2">Class</th><th className="py-2">Teacher</th><th className="py-2">Geofence</th><th className="py-2">Radius</th>
      </tr></thead>
      <tbody>{initial.map(c=>(<tr key={c.id} className="border-b border-white/5">
        <td className="py-3 font-medium">{c.name}</td>
        <td>{c.teacher.name}</td>
        <td className="text-slate-400 text-xs">{c.geofenceLat.toFixed(4)}, {c.geofenceLng.toFixed(4)}</td>
        <td>{c.radiusMeters} m</td>
      </tr>))}</tbody>
    </table></div>
  </div>;
}

function LogsTab({rows}:{rows:Attendance[]}){
  return <div className="glass rounded-2xl p-6">
    <h3 className="font-medium mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-400"/> Recent attendance ({rows.length})</h3>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="text-left text-slate-400 border-b border-white/10"><tr>
        <th className="py-2">When</th><th className="py-2">Student</th><th className="py-2">Class</th><th className="py-2">Distance</th><th className="py-2">Face</th><th className="py-2">Status</th>
      </tr></thead>
      <tbody>{rows.map(a=>(<tr key={a.id} className="border-b border-white/5">
        <td className="py-3 text-slate-300">{new Date(a.markedAt).toLocaleString()}</td>
        <td>{a.student.name} <span className="text-xs text-slate-500">({a.student.studentId})</span></td>
        <td>{a.class.name}</td>
        <td>{a.distanceM} m</td>
        <td>
          {a.faceMatched === null ? <span className="text-slate-500">—</span> :
           a.faceMatched ? <span className="text-emerald-300">✓ {a.faceDistance?.toFixed(3)}</span>
                         : <span className="text-red-300">✗ {a.faceDistance?.toFixed(3)}</span>}
        </td>
        <td>{a.status==="PRESENT"?(<span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-4 h-4"/>PRESENT</span>):(<span className="inline-flex items-center gap-1 text-red-300"><XCircle className="w-4 h-4"/>REJECTED</span>)}</td>
      </tr>))}{rows.length===0&&<tr><td colSpan={6} className="py-6 text-center text-slate-500">No attendance recorded yet.</td></tr>}</tbody>
    </table></div>
  </div>;
}

function Input({label,value,onChange,type="text",placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string}){
  return <div>
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 focus:border-amber-400/40 outline-none"/>
  </div>;
}
