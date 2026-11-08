import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/SiteHeader";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { neonApi } from "@/lib/neon-api";
import { authClient } from "@/lib/auth-client";
import { Bell, UserRound } from "lucide-react";

export function SignInRequired() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-4xl uppercase tracking-tight">Sign in required</h1>
        <p className="mt-3 text-sm text-ink-soft">You need to log in to view the staff portal.</p>
        <Link
          to="/login"
          className="mt-6 inline-block bg-ink px-6 py-3 font-bold uppercase tracking-wide text-paper hover:bg-ink-soft"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}

export function PortalShell({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  } | null>(null);
  const [checked, setChecked] = useState(false);
  const [pendingMarks, setPendingMarks] = useState(0);
  const [billingLocked, setBillingLocked] = useState(false);
  const pathname = useRouterState({ select: (router) => router.location.pathname });

  useEffect(() => {
    void authClient
      .getSession()
      .then(async ({ data }) => {
        if (!data?.user) {
          setUser(null);
          return;
        }
        const response = await neonApi("/api/me");
        setUser(await response.json());
        const billingResponse = await neonApi("/api/billing/status");
        if (billingResponse.ok) {
          const billing = (await billingResponse.json()) as { locked?: boolean };
          setBillingLocked(Boolean(billing.locked));
        }
      })
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refreshSubscription = async () => {
      try {
        const response = await neonApi("/api/billing/status");
        if (!response.ok) return;
        const billing = (await response.json()) as { locked?: boolean };
        if (active) setBillingLocked(Boolean(billing.locked));
      } catch {
        // Keep the current route state if the status check is temporarily unavailable.
      }
    };
    const interval = window.setInterval(() => void refreshSubscription(), 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (user?.role !== "Admin") {
      setPendingMarks(0);
      return;
    }
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await neonApi("/api/notifications/pending-marks");
        const result = (await response.json()) as { count?: number };
        if (active) setPendingMarks(Number(result.count || 0));
      } catch {
        if (active) setPendingMarks(0);
      }
    };
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.role]);

  if (!checked) return null;
  if (!user) return <SignInRequired />;
  if (billingLocked && pathname !== "/billing")
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-5 text-ink">
        <section className="max-w-lg border border-ink/15 bg-white p-8 text-center shadow-sm">
          <p className="eyebrow text-ink-soft">Subscription required</p>
          <h1 className="mt-2 font-display text-3xl uppercase">School access is paused</h1>
          <p className="mt-3 text-sm text-ink-soft">
            The free trial or paid subscription has ended. Open Billing to choose a plan and pay by M-Pesa STK Push. Access resumes after payment is confirmed.
          </p>
          <Link to="/billing" className="mt-6 inline-flex bg-ink px-5 py-3 text-sm font-bold uppercase text-paper">
            Open billing
          </Link>
        </section>
      </div>
    );

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen bg-paper">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-ink/10 bg-paper/90 px-4 backdrop-blur">
          <SidebarTrigger className="text-ink-soft hover:bg-ink/5 hover:text-ink" />
          <div className="min-w-0">
            <div className="eyebrow text-[10px] text-ink-soft">{eyebrow}</div>
            <div className="truncate font-display text-lg uppercase tracking-tight">{title}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {actions}
            {user.role === "Admin" && (
              <Link
                to="/exams"
                aria-label={
                  pendingMarks ? `${pendingMarks} marks awaiting approval` : "Exam approvals"
                }
                title={pendingMarks ? `${pendingMarks} marks awaiting approval` : "Exam approvals"}
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/20 bg-white text-ink hover:ring-2 hover:ring-gold"
              >
                <Bell size={18} />
                {pendingMarks > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-owed px-1 text-[10px] font-bold text-white">
                    {pendingMarks > 99 ? "99+" : pendingMarks}
                  </span>
                )}
              </Link>
            )}
            <Link
              to="/profile"
              aria-label="Open your profile"
              title={user.name}
              className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-ink/20 bg-white text-ink hover:ring-2 hover:ring-gold"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={18} />
              )}
            </Link>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
