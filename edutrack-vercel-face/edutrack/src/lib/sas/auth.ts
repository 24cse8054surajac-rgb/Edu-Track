import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// ─── password hashing ──────────────────────────────────────────────
// SPEC: passwords are hashed using Node crypto scryptSync.
// Admin accounts additionally use bcrypt to make brute-force over
// the audit field slower (bcrypt cost 12).

const SCRYPT_KEYLEN = 64;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function hashPasswordScrypt(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(plain, salt, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export async function verifyPasswordScrypt(
  plain: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  if (!salt || !hash) return false;
  const test = crypto
    .scryptSync(plain, salt, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
}

export async function hashPasswordBcrypt(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPasswordBcrypt(
  plain: string,
  stored: string
): Promise<boolean> {
  return bcrypt.compare(plain, stored);
}

// generic dispatcher — picks the right algo based on the prefix
export async function hashPassword(plain: string, algo: "scrypt" | "bcrypt" = "scrypt") {
  return algo === "bcrypt" ? hashPasswordBcrypt(plain) : hashPasswordScrypt(plain);
}
export async function verifyPasswordAny(plain: string, stored: string) {
  if (stored.startsWith("scrypt$")) return verifyPasswordScrypt(plain, stored);
  if (stored.startsWith("$2") || stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
    return verifyPasswordBcrypt(plain, stored);
  }
  return false;
}

// Legacy shim (kept so the student/teacher login route can keep using
// the simple split(":") format from the audit spec).
export async function hashPasswordLegacy(plain: string): Promise<string> {
  return hashPasswordScrypt(plain);
}
export async function verifyPasswordLegacy(plain: string, stored: string) {
  // backward-compat for any old hashes that used `salt:hash` without the `scrypt$` prefix
  if (stored.startsWith("scrypt$")) return verifyPasswordScrypt(plain, stored);
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto
    .scryptSync(plain, salt, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
  } catch {
    return false;
  }
}

// ─── DB-backed sessions (student / teacher) ───────────────────────
export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  cookies().set("edutrack_session", token, {
    httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const token = cookies().get("edutrack_session")?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  cookies().delete("edutrack_session");
}

export async function getCurrentUser() {
  const token = cookies().get("edutrack_session")?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token }, include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { password: _pw, passwordAlgo: _pa, faceDescriptor: _fd, ...safe } = session.user;
  return safe;
}

export async function requireRole(roles: Role[] = ["ADMIN", "TEACHER", "STUDENT"]) {
  const u = (await getCurrentUser()) as Awaited<ReturnType<typeof getCurrentUser>>;
  if (!u) throw new Error("UNAUTHORIZED");
  if (!roles.includes(u.role as Role)) throw new Error("FORBIDDEN");
  return u as { id: string; email: string; name: string; role: Role };
}

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

// ─── Signed JWT for admin (Edge-runtime-friendly) ──────────────────
// Admin login mints this. middleware.ts verifies it on the Edge without
// touching the DB — so /admin can be guarded without a database roundtrip.

const ADMIN_COOKIE = "edutrack_admin";
const ADMIN_TTL_S = 60 * 60 * 8; // 8h

function adminSecret() {
  const s = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || "dev-only-admin-secret-change-me";
  return new TextEncoder().encode(s);
}

export async function signAdminJWT(payload: { sub: string; email: string; name: string; role: "ADMIN" }) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL_S}s`)
    .setIssuer("edutrack")
    .sign(adminSecret());
}

export async function verifyAdminJWT<T = { sub: string; email: string; name: string; role: "ADMIN" }>(
  token: string
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, adminSecret(), { issuer: "edutrack" });
    return payload as T;
  } catch {
    return null;
  }
}

export async function setAdminCookie(token: string) {
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL_S,
  });
}
export async function clearAdminCookie() {
  cookies().delete(ADMIN_COOKIE);
}
export function readAdminCookie() {
  return cookies().get(ADMIN_COOKIE)?.value ?? null;
}
