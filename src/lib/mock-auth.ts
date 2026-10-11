// Mock auth backed by localStorage. Replace with Lovable Cloud later.
export type MockUser = { name: string; email: string; role: string };

const KEY = "sja-mock-user";

export function getMockUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

export function signInMock(user: MockUser) {
  window.localStorage.setItem(KEY, JSON.stringify(user));
}

export function signOutMock() {
  window.localStorage.removeItem(KEY);
}
