import { createAuthClient } from "@neon/auth";

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);

export async function getAuthToken(): Promise<string | null> {
  // The Neon Auth JWT plugin exposes this endpoint, though the installed
  // generated Better Auth client type omits the method.
  const client = authClient as unknown as {
    token: () => Promise<{ data?: { token?: string } | null; error?: unknown }>;
  };
  const { data, error } = await client.token();
  if (error) return null;
  return data?.token || null;
}
