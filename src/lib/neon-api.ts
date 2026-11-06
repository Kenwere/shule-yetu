import { authClient } from "./auth-client";

const apiBase = import.meta.env.VITE_NEON_FUNCTION_HELLO_URL;

export async function neonApi(path: string, init: RequestInit = {}) {
  if (!apiBase) throw new Error("Neon Functions URL is not configured.");
  const { data, error } = await authClient.getSession();
  const token = data?.session.token;
  if (error || !token) throw new Error("Please sign in to use the school portal.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + token);
  const url = new URL(path.replace(/^\//, ""), apiBase.endsWith("/") ? apiBase : apiBase + "/");
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;
    try {
      const body = JSON.parse(raw) as { error?: unknown; message?: unknown };
      if (typeof body.error === "string") detail = body.error;
      else if (typeof body.message === "string") detail = body.message;
    } catch {
      // Keep plain-text API errors readable.
    }
    throw new Error(detail || "Neon API returned " + response.status + ".");
  }
  return response;
}
