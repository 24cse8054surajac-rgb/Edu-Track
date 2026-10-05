import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sas/auth";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(u);
}
