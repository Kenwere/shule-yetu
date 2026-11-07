import { authClient } from "./auth-client";

const apiBase = import.meta.env.VITE_NEON_FUNCTION_HELLO_URL;
const studentSessionKey = "shule-yetu-student-session";

function getStudentToken() {
  return typeof window === "undefined"
    ? ""
    : window.sessionStorage.getItem(studentSessionKey) || "";
}

export function saveStudentToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(studentSessionKey, token);
  else window.sessionStorage.removeItem(studentSessionKey);
}

export async function studentLogin(admissionNo: string, password: string, schoolName = "") {
  if (!apiBase) throw new Error("Neon Functions URL is not configured.");
  const base = apiBase.endsWith("/") ? apiBase : apiBase + "/";
  const response = await fetch(new URL("api/lms/auth/login", base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admissionNo, password, schoolName }),
  });
  const result = (await response.json()) as {
    token?: string;
    error?: string;
    mustChangePassword?: boolean;
    student?: { firstName: string; lastName: string };
  };
  if (!response.ok || !result.token) throw new Error(result.error || "Student login failed.");
  saveStudentToken(result.token);
  return result;
}

export async function studentApi(path: string, init: RequestInit = {}) {
  if (!apiBase) throw new Error("Neon Functions URL is not configured.");
  const token = getStudentToken();
  if (!token) throw new Error("Please sign in with your admission number.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const url = new URL(path.replace(/^\//, ""), apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;
    try {
      const body = JSON.parse(raw) as { error?: unknown; message?: unknown };
      if (typeof body.error === "string") detail = body.error;
      else if (typeof body.message === "string") detail = body.message;
    } catch {
      // Preserve a plain-text server error.
    }
    throw new Error(detail || `Neon API returned ${response.status}.`);
  }
  return response;
}

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
