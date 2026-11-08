import { useEffect } from "react";
import { logoutForInactivity } from "@/lib/neon-api";

const IDLE_LIMIT = 5 * 60 * 1000;

export function InactivityLogout() {
  useEffect(() => {
    let timeout = 0;
    let expiring = false;
    const scheduleLogout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(async () => {
        if (expiring) return;
        expiring = true;
        const destination = await logoutForInactivity();
        if (destination) {
          window.location.assign(destination);
        } else {
          expiring = false;
          scheduleLogout();
        }
      }, IDLE_LIMIT);
    };
    const activityEvents: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
      "wheel",
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, scheduleLogout, { passive: true }),
    );
    scheduleLogout();
    return () => {
      window.clearTimeout(timeout);
      activityEvents.forEach((event) => window.removeEventListener(event, scheduleLogout));
    };
  }, []);
  return null;
}
