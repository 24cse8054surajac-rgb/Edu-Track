# EduTrack — GPS + Face-verified Student Attendance

Next.js 14 App Router · React · Tailwind · Framer Motion · Recharts ·
lucide-react · Prisma · **PostgreSQL** · `@vladmandic/face-api` · `jose` (JWT) ·
`bcryptjs`. Designed to deploy to **Vercel** out of the box.

## What changed vs v1

| Area | v1 (SQLite) | **v2 (Postgres + Face + Admin JWT)** |
|---|---|---|
| Database | SQLite (`file:./dev.db`) | **PostgreSQL** (Vercel/Neon/Supabase/local) — needed because Vercel's filesystem is ephemeral & read-only |
| Admin login | Same shared sign-in | **Separate `/admin/login` flow** with **bcrypt** hashing and **HS256 JWT** stored in an `httpOnly` cookie |
| Route protection | None at the framework level | **`src/middleware.ts`** verifies the admin JWT on the Edge runtime for every `/admin*` and `/api/admin/*` and `/api/students` request — no DB round-trip |
| Face verification | Not implemented | **@vladmandic/face-api** 128-d descriptor — student enrols once via WebRTC, stored on `User.faceDescriptor`, re-checked at every attendance mark and combined with GPS intent |
| Audit trail | GPS only | New columns `faceMatched`, `faceDistance` on the `Attendance` row |

## Quick start

```bash
# 1. provision a postgres database (any of these work)
#    a) Vercel      → Storage → Create Database → Postgres
#    b) Neon        → https://neon.tech (free tier)
#    c) Local Docker → docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres

# 2. fill in secrets
cp .env.example .env
# edit DATABASE_URL and the two secrets

# 3. install & run
npm install        # postinstall runs prisma generate
npm run db:push     # apply schema to your database
npm run db:seed     # admin/teacher/student demo accounts
npm run dev         # http://localhost:3000
```

### Demo accounts

| Portal | URL | Email | Password |
|---|---|---|---|
| Admin (bcrypt+JWT) | `/admin/login` | `[email protected]` | `admin123` |
| Teacher (scrypt+cookie) | `/login` | `[email protected]` | `teacher123` |
| Student (scrypt+cookie) | `/login` | `[email protected]` | `student123` |

## Face verification flow

1. Student logs into `/student`.
2. Clicks **Enrol face** → webcam opens → frames are run through
   `@vladmandic/face-api` (TinyFaceDetector + face-landmarks-68-tiny +
   face-recognition-net) → a 128-d descriptor is POSTed to
   `/api/face/enroll` and stored on `User.faceDescriptor`.
3. At check-in the student taps **Check me in** → webcam opens again,
   the live descriptor is compared to the stored one
   (Euclidean distance, threshold **≤ 0.45**) via `/api/face/verify`.
4. The attendance POST now includes both `lat/lng/accuracy` AND
   `faceDescriptor`. Server records GPS distance, face distance, and a
   combined `PRESENT`/`REJECTED` verdict.

> **No liveness detection.** A printed photo of an enrolled face could
> pass. The system is intended for low-risk classrooms; for high-risk
> use-cases add a blink/turn-head gesture or hardware liveness.

### Where do the model weights live?

The descriptor models are ~10 MB total. They are loaded from a CDN so
the git repo stays small:

```
NEXT_PUBLIC_FACE_MODEL_URL=https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model
```

If you cannot reach jsDelivr, drop the `tiny_face_detector_model.json`,
`face_landmark_68_tiny_model.json`, and `face_recognition_model.json`
files (plus their `*-shard1` weights) into `/public/models` and set:

```
NEXT_PUBLIC_FACE_MODEL_URL=/models
```

## Deploy to Vercel

```bash
# one-time
npm i -g vercel
vercel login

# from the project root
vercel --prod
```

If you don't have the CLI, push the project to GitHub and import it on
https://vercel.com/new — Vercel will auto-detect Next.js.

### Required environment variables

Set them in **Vercel → Project → Settings → Environment Variables**:

| Name | Example | Where to get it |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:[email protected]:5432/edutrack` | Vercel: **Storage → Create Database → Postgres** auto-fills this. Or use Neon. |
| `SESSION_SECRET` | 48-char base64 | `openssl rand -base64 48` |
| `ADMIN_JWT_SECRET` | 48-char base64 | `openssl rand -base64 48` (separate from `SESSION_SECRET`) |
| `NEXT_PUBLIC_FACE_MODEL_URL` | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model` | Default already baked in |

### After deploy

1. Push the schema: in Vercel → Project → Settings → Build & Development
   Settings add a **Build Command** override of
   `prisma generate && prisma db push --accept-data-loss && next build`.
   Or run `npx prisma db push` locally against the same `DATABASE_URL`
   before pushing.
2. Seed demo accounts over Vercel Postgres by running locally against
   the same `DATABASE_URL`: `npm run db:seed`.

## File map (changes highlighted)

```
src/middleware.ts                          ← NEW: Edge JWT gate
prisma/schema.prisma                       ← postgresql; added faceDescriptor, faceMatched, faceDistance
src/lib/sas/auth.ts                        ← +bcrypt + jose JWT + ADMIN_COOKIE helpers
src/app/api/admin/login/route.ts           ← NEW: bcrypt + JWT admin login
src/app/api/face/enroll/route.ts           ← NEW: POST/GET face descriptor
src/app/api/face/verify/route.ts           ← NEW: Euclidean face match
src/app/api/attendance/route.ts            ← combined GPS + face verdict
src/app/student/shell.tsx                  ← WebRTC camera + face enrolment UI
src/app/admin/login/page.tsx               ← NEW: separate admin login page
src/app/admin/page.tsx                     ← guards via JWT instead of cookie session
src/app/admin/shell.tsx                    ← added "Faces enrolled" stat + face column on logs
src/app/api/students/route.ts              ← manner: middleware gates it
src/app/api/auth/route.ts                  ← rejects ADMIN role (must use admin route)
package.json                               ← +bcryptjs, +jose, +@types/bcryptjs
.env.example                               ← DATABASE_URL + ADMIN_JWT_SECRET templates
```
