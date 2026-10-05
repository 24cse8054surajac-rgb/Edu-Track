"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, LogOut, CheckCircle2, XCircle, Loader2,
  AlertTriangle, History, Camera, ScanFace,
} from "lucide-react";

type Klass = { id: string; name: string; teacher: string; lat: number; lng: number; radius: number };
type A = { id: string; className: string; markedAt: string; status: string; distanceM: number; lat: number; lng: number; faceMatched: boolean | null; faceDistance: number | null };

// Default model URL — face-api loads weights from a CDN so the repo
// stays small. Override to "/models" if you self-host them in /public.
const FACE_MODEL_URL =
  process.env.NEXT_PUBLIC_FACE_MODEL_URL ||
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

export default function StudentShell({
  me,
  classes,
  attendance,
}: {
  me: { id: string; name: string; email: string; role: string };
  classes: Klass[];
  attendance: A[];
}) {
  const r = useRouter();
  const [selected, setSelected] = useState<Klass | null>(classes[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    status: "PRESENT" | "REJECTED";
    message: string;
    distance: number;
    face?: { matched: boolean | null; distance: number | null };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Face detection state
  type FaceAPI = typeof import("@vladmandic/face-api");
  const faceRef = useRef<FaceAPI | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [faceReady, setFaceReady] = useState(false);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    fetch("/api/face/enroll", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { enrolled: false })
      .then((j) => setFaceEnrolled(!!j.enrolled))
      .catch(() => {});
  }, []);

  async function ensureFaceModel(): Promise<FaceAPI | null> {
    if (faceRef.current) return faceRef.current;
    try {
      const faceapi = await import("@vladmandic/face-api");
      await faceapi.nets.tinyFaceDetector.loadFromUrl(FACE_MODEL_URL);
      await faceapi.nets.faceLandmark68TinyNet.loadFromUrl(FACE_MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUrl(FACE_MODEL_URL);
      faceRef.current = faceapi;
      setFaceReady(true);
      return faceapi;
    } catch (e: any) {
      setError("Face model failed to load: " + (e?.message ?? e));
      return null;
    }
  }

  async function startCamera() {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (e: any) {
      setError("Could not access camera: " + (e?.message ?? e));
    }
  }
  function stopCamera() {
    const v = videoRef.current;
    const s = v?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  }
  useEffect(() => () => stopCamera(), []);

  async function captureDescriptor(): Promise<number[] | null> {
    const faceapi = await ensureFaceModel();
    if (!faceapi || !videoRef.current) return null;
    const detections = await faceapi
      .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptors();
    if (!detections.length) return null;
    return Array.from(detections[0].descriptor);
  }

  async function enrollFace() {
    if (enrolling) return;
    setEnrolling(true);
    setError(null);
    await startCamera();
    // give the camera a moment to warm up
    await new Promise((r) => setTimeout(r, 600));
    const d = await captureDescriptor();
    stopCamera();
    if (!d) {
      setError("No face detected. Try again with your face clearly in the frame.");
      setEnrolling(false);
      return;
    }
    const r1 = await fetch("/api/face/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor: d }),
      credentials: "include",
    });
    if (!r1.ok) {
      const t = await r1.text();
      setError("Could not save descriptor: " + t);
    } else {
      setFaceEnrolled(true);
    }
    setEnrolling(false);
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE", credentials: "include" });
    r.replace("/login");
  }

  async function checkIn(k: Klass) {
    if (!("geolocation" in navigator)) {
      setError("Browser does not support geolocation.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);

    // Step 1 — capture face (requires camera permission)
    // If the student has not enrolled yet we still allow GPS-only marking,
    // but we strongly recommend enrolling a face first.
    let descriptor: number[] | null = null;
    await startCamera();
    const faceapi = faceRef.current ?? (await ensureFaceModel());
    if (faceapi && faceEnrolled) {
      // give the camera ~700ms warm-up so detection isn't on a black frame
      await new Promise((res) => setTimeout(res, 700));
      descriptor = await captureDescriptor();
    }

    // Step 2 — capture GPS
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const body: any = {
            classId: k.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          if (descriptor) body.faceDescriptor = descriptor;

          const j = await fetch("/api/attendance", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body), credentials: "include",
          }).then(async (r) => {
            const t = await r.text();
            if (!r.ok) throw new Error(t || "Failed");
            return JSON.parse(t);
          });

          stopCamera();
          if (j.duplicate) {
            setResult({
              status: "PRESENT", message: "Already marked today",
              distance: j.attendance.distanceM,
            });
          } else {
            const reasons = j.reasons ?? { face: { submitted: false } };
            const faceSubmitted = reasons.face && reasons.face.submitted !== false;
            let message = j.present
              ? "You're inside the classroom radius."
              : "You're outside the classroom radius.";
            if (faceSubmitted && !reasons.face.matched) {
              message = "Face verification failed — please re-enroll your face.";
            }
            setResult({
              status: j.attendance.status,
              message,
              distance: j.attendance.distanceM,
              face: faceSubmitted
                ? { matched: reasons.face.matched, distance: reasons.face.distance }
                : undefined,
            });
          }
          r.refresh();
        } catch (ex: any) {
          setError(ex.message || "Failed");
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        stopCamera();
        setBusy(false);
        if (err.code === err.PERMISSION_DENIED)
          setError("Location permission denied — please allow and reload.");
        else if (err.code === err.POSITION_UNAVAILABLE)
          setError("Location unavailable — go outdoors with GPS on.");
        else if (err.code === err.TIMEOUT)
          setError("Location request timed out — try again.");
        else setError("Could not get location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-emerald-400" /></div>
            <div>
              <div className="text-xs text-emerald-400/70 uppercase tracking-widest">EduTrack</div>
              <div className="font-semibold">Student Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right"><div className="text-sm font-medium">{me.name}</div>
              <div className="text-xs text-slate-400">{me.email}</div></div>
            <button onClick={logout} className="p-2 rounded-lg border border-white/10" aria-label="Logout">
              <LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Face enrolment card */}
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="glass rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400">
              <ScanFace className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Face verification</h2>
              <p className="text-sm text-slate-400 mt-1">
                {faceEnrolled
                  ? "Your face is enrolled. We compare it at every check-in."
                  : "Enrol your face once. We use it to prove it's really you — GPS alone can be spoofed."}
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={enrollFace} disabled={enrolling}
                  className="px-4 py-2 rounded-lg bg-emerald-400 text-slate-900 font-medium flex items-center gap-2 disabled:opacity-50">
                  {enrolling ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4" />}
                  {faceEnrolled ? "Re-enrol face" : "Enrol face"}
                </button>
                {faceReady && <span className="self-center text-xs text-slate-500">Model loaded.</span>}
              </div>
              {/* Hidden video element reused by enrol + check-in */}
              <video ref={videoRef} className="hidden" muted playsInline />
              <p className="text-[11px] text-slate-500 mt-2">
                Note: this uses on-device matching only. There is no liveness
                detection — a printed photo of an enrolled user could pass.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Check-in card */}
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Mark attendance</h2>
          <p className="text-sm text-slate-400 mb-5">
            Pick your class and tap <b>Check me in</b>. We'll capture a face
            frame (if enrolled) and GPS, then write a signed row to the
            database only if both signals pass.
          </p>

          {classes.length === 0 ? (
            <div className="text-sm text-slate-400">
              You are not enrolled in any class yet. Contact your administrator.
            </div>
          ) : (<>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {classes.map((k) => {
                const A = selected?.id === k.id;
                return (
                  <button key={k.id} onClick={() => setSelected(k)}
                    className={`text-left p-4 rounded-xl border transition ${A?"border-emerald-400/50 bg-emerald-400/10":"border-white/10 hover:border-white/30"}`}>
                    <div className="font-medium">{k.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{k.teacher} · radius {k.radius} m</div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => selected && checkIn(selected)} disabled={!selected || busy}
                className="px-5 py-3 rounded-xl bg-emerald-400 text-slate-900 font-medium flex items-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <MapPin className="w-4 h-4"/>}
                Check me in
              </button>
              <div className="text-xs text-slate-500">Uses GPS + camera. HTTPS required.</div>
            </div>

            <AnimatePresence>
              {result && (
                <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  className={`mt-5 p-4 rounded-xl border flex items-start gap-3 ${result.status==="PRESENT"?"bg-emerald-400/10 border-emerald-400/30 text-emerald-200":"bg-red-500/10 border-red-500/30 text-red-200"}`}>
                  {result.status==="PRESENT" ? <CheckCircle2 className="w-5 h-5 mt-0.5"/> : <XCircle className="w-5 h-5 mt-0.5"/>}
                  <div>
                    <div className="font-medium">
                      {result.status==="PRESENT" ? "Attendance marked" : "Marked as rejected"}
                    </div>
                    <div className="text-sm opacity-80">
                      {result.message} · {result.distance} m from class{" "}
                      {result.face && (
                        <span className="ml-2 text-xs">
                          face: {result.face.matched ? "✓" : "✗"}{" "}
                          {result.face.distance !== null && `(d=${result.face.distance.toFixed(3)})`}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              {error && (
                <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  className="mt-5 p-4 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 mt-0.5"/>
                  <div className="text-sm">{error}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </>)}
        </motion.div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-medium flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-emerald-400" /> My recent attendance
          </h3>
          <div className="divide-y divide-white/5">
            {attendance.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.className}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(a.markedAt).toLocaleString()} · {a.distanceM} m
                    {a.faceMatched !== null && (
                      <span className="ml-2">
                        · face {a.faceMatched ? "✓" : "✗"}
                        {a.faceDistance !== null && ` (d=${a.faceDistance.toFixed(3)})`}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-md ${a.status==="PRESENT"?"bg-emerald-400/15 text-emerald-300":"bg-red-500/15 text-red-300"}`}>{a.status}</span>
              </div>
            ))}
            {attendance.length === 0 && (
              <div className="py-6 text-sm text-slate-500">
                No records yet. Enrol your face, then check in.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
