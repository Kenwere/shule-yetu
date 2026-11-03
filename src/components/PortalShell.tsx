import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/SiteHeader";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { neonApi } from "@/lib/neon-api";
import { authClient } from "@/lib/auth-client";

export function SignInRequired() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-4xl uppercase tracking-tight">Sign in required</h1>
        <p className="mt-3 text-sm text-ink-soft">
          You need to log in to view the staff portal.
        </p>
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
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    void authClient.getSession().then(async ({ data }) => {
      if (!data?.user) { setUser(null); return; }
      const response = await neonApi("/api/me");
      setUser(await response.json());
    }).catch(() => setUser(null)).finally(() => setChecked(true));
  }, []);

  if (!checked) return null;
  if (!user) return <SignInRequired />;

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
          <div className="ml-auto flex items-center gap-3">{actions}</div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
