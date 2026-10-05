"use client";

// Centralized client-side fetch wrapper that attaches the Bearer token
// and clears the local session marker on any 401 from the API.

let sessionMarker: string | null = null;

export function setSessionMarker(token: string | null) {
  sessionMarker = token;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionMarker ? { Authorization: `Bearer ${sessionMarker}` } : {}),
      ...(init.headers || {}),
    },
    credentials: "include",
  });

  if (res.status === 401) {
    setSessionMarker(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}
