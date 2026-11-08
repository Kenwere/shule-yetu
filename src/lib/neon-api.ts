import { getAuthToken } from "./auth-client";
import { toast } from "sonner";

const apiBase = import.meta.env.VITE_NEON_FUNCTION_HELLO_URL;
const studentSessionKey = "shule-yetu-student-session";
const parentSessionKey = "shule-yetu-parent-session";

function notifyMutationSuccess(init: RequestInit) {
  const method = (init.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    toast.success(
      method === "DELETE"
        ? "Deleted successfully"
        : method === "POST"
          ? "Completed successfully"
          : "Changes saved successfully",
    );
  }
}

export async function getStaffInvitation(code: string) {
  if (!apiBase) throw new Error("Neon Functions URL is not configured.");
  const base = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
  const response = await fetch(new URL(`api/staff/invitation/${encodeURIComponent(code)}`, base));
  const result = (await response.json()) as {
    email?: string;
    name?: string;
    schoolName?: string;
    error?: string;
  };
  if (!response.ok) throw new Error(result.error || "This invitation is invalid or has expired.");
  return result;
}

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

function getParentToken() {
  return typeof window === "undefined" ? "" : window.sessionStorage.getItem(parentSessionKey) || "";
}
export function saveParentToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(parentSessionKey, token);
  else window.sessionStorage.removeItem(parentSessionKey);
}

export async function logoutForInactivity(): Promise<string | null> {
  const studentToken = getStudentToken();
  const parentToken = getParentToken();
  let staffSession = false;
  try {
    const session = await authClient.getSession();
    staffSession = Boolean(session.data?.session);
  } catch {
    // The local and LMS sessions are still cleared below.
  }
  const base = apiBase ? (apiBase.endsWith("/") ? apiBase : `${apiBase}/`) : "";
  if (base && studentToken) {
    try {
      await fetch(new URL("api/lms/auth/logout", base), {
        method: "POST",
        headers: { Authorization: `Bearer ${studentToken}` },
      });
    } catch {
      /* Clear the local session even if the server cannot be reached. */
    }
  }
  if (base && parentToken) {
    try {
      await fetch(new URL("api/lms/parent/auth/logout", base), {
        method: "POST",
        headers: { Authorization: `Bearer ${parentToken}` },
      });
    } catch {
      /* Clear the local session even if the server cannot be reached. */
    }
  }
  saveStudentToken(null);
  saveParentToken(null);
  if (staffSession) {
    try {
      await authClient.signOut();
    } catch {
      /* The app will still leave the protected page. */
    }
    return "/login";
  }
  if (studentToken) return "/student-login";
  if (parentToken) return "/parent-login";
  return null;
}
export async function parentLogin(email: string, password: string, schoolName = "") {
  if (!apiBase) throw new Error("Neon Functions URL is not configured.");
  const base = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
  const response = await fetch(new URL("api/lms/parent/auth/login", base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, schoolName }),
  });
  const result = (await response.json()) as {
    token?: string;
    error?: string;
    mustChangePassword?: boolean;
  };
  if (!response.ok || !result.token) {
    const message = result.error || "Parent login failed.";
    toast.error(message);
    throw new Error(message);
  }
  saveParentToken(result.token);
  toast.success("Signed in successfully");
  return result;
}
export async function parentApi(path: string, init: RequestInit = {}) {
  if (!apiBase) throw new Error("Neon Functions URL is not configured.");
  const token = getParentToken();
  if (!token) throw new Error("Please sign in with your parent account.");
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
      // Keep the server's plain-text error.
    }
    toast.error(detail || `Neon API returned ${response.status}.`);
    throw new Error(detail || `Neon API returned ${response.status}.`);
  }
  notifyMutationSuccess(init);
  return response;
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
  if (!response.ok || !result.token) {
    const message = result.error || "Student login failed.";
    toast.error(message);
    throw new Error(message);
  }
  saveStudentToken(result.token);
  toast.success("Signed in successfully");
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
    toast.error(detail || `Neon API returned ${response.status}.`);
    throw new Error(detail || `Neon API returned ${response.status}.`);
  }
  notifyMutationSuccess(init);
  return response;
}

export async function neonApi(path: string, init: RequestInit = {}) {
  if (!apiBase) {
    const error = new Error("Neon Functions URL is not configured.");
    toast.error(error.message);
    throw error;
  }
  const token = await getAuthToken();
  if (!token) {
    const sessionError = new Error("Please sign in to use the school portal.");
    toast.error(sessionError.message);
    throw sessionError;
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + token);
  const url = new URL(path.replace(/^\//, ""), apiBase.endsWith("/") ? apiBase : apiBase + "/");
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Network request failed.";
    toast.error(message);
    throw cause;
  }
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
    const message = `${detail || response.statusText || "Neon API request failed."}`;
    toast.error(message);
    throw new Error(`${path} failed (${response.status}): ${message}`);
  }
  notifyMutationSuccess(init);
  return response;
}
