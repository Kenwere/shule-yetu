import { createRealtimeClient } from "@neon/realtime/client";

export const neonRealtime = createRealtimeClient({
  url: import.meta.env.VITE_NEON_REALTIME_URL,
});