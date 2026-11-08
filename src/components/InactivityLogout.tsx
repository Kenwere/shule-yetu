import { useEffect } from "react";
import { toast } from "sonner";
import { logoutForInactivity } from "@/lib/neon-api";

const IDLE_LIMIT = 5 * 60 * 1000;
const NOTICE_KEY = "shule-yetu-idle-logout-notice";

export function InactivityLogout() {
  useEffect(() => {
    const notice = window.sessionStorage.getItem(NOTICE_KEY);
    if (notice) {
      window.sessionStorage.removeItem(NOTICE_KEY);
      toast.info("You were signed out after 5 minutes of inactivity.");
    }

    let timeout = 0;
    let expiring = false;
    const scheduleLogout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(async () => {
        if (expiring) return;
        expiring = true;
        const destination = await logoutForInactivity();
        if (destination) {
          window.sessionStorage.setItem(NOTICE_KEY, "true");
          window.location.assign(destination);
        } else {
          expiring = false;
          scheduleLogout();
        }
      }, IDLE_LIMIT);
    };
    const activityEvents: (keyof WindowEventMap)[] = [
      "pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel",
    ];
    activityEvents.forEach((event) => window.addEventListener(event, scheduleLogout, { passive: true }));
    scheduleLogout();
    return () => {
      window.clearTimeout(timeout);
      activityEvents.forEach((event) => window.removeEventListener(event, scheduleLogout));
    };
  }, []);
  return null;
}
