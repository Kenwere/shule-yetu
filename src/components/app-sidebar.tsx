import { Link, useNavigate, useRouterState, type LinkProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarCheck2,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Receipt,
  Settings,
  Users,
  ClipboardList,
  FileText,
  ChartNoAxesCombined,
  Layers,
  Megaphone,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { neonApi } from "@/lib/neon-api";
import { authClient } from "@/lib/auth-client";
import crest from "@/assets/crest.jpg";

type PortalPath = NonNullable<LinkProps["to"]>;
type PortalUser = {
  name: string;
  email: string;
  role: string;
  permissions: string[];
  school?: { school_name?: string; logoUrl?: string } | null;
};

const portalItems: { title: string; url: PortalPath; icon: typeof LayoutDashboard }[] = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: GraduationCap },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Fees", url: "/fees", icon: Receipt },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck2 },
  { title: "Teachers", url: "/teachers", icon: Users },
  { title: "Exams & marks", url: "/exams", icon: ClipboardList },
  { title: "Report cards", url: "/report-cards", icon: FileText },
  { title: "Reports", url: "/reports", icon: ChartNoAxesCombined },
  { title: "Classes & fees", url: "/classes", icon: Layers },
  { title: "Settings", url: "/settings", icon: Settings },
];

const schoolItems: { title: string; url: PortalPath; icon: typeof Home }[] = [
  { title: "Ask us", url: "/ask", icon: MessagesSquare },
  { title: "School site", url: "/", icon: Home },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const [user, setUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    void neonApi("/api/me")
      .then((r) => r.json())
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const isActive = (url: string) => pathname === url;
  const permissionFor: Record<string, string> = {
    "/dashboard": "view_students",
    "/students": "view_students",
    "/announcements": "view_announcements",
    "/fees": "view_fees",
    "/attendance": "view_attendance",
    "/teachers": "manage_staff",
    "/exams": "view_exams",
    "/report-cards": "view_exams",
    "/reports": "view_students",
    "/classes": "view_classes",
    "/settings": "manage_settings",
  };
  const visibleItems = portalItems.filter(
    (item) =>
      user?.role === "Admin" ||
      (item.url === "/reports"
        ? ["view_students", "view_fees", "view_attendance", "view_exams"].some((permission) =>
            user?.permissions.includes(permission),
          )
        : user?.permissions.includes(permissionFor[item.url as string] ?? "")),
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Shule Yetu">
              <Link to="/" className="flex flex-col items-center gap-2 py-2">
                <img
                  src={user?.school?.logoUrl || crest}
                  alt={
                    user?.school?.school_name
                      ? user.school.school_name + " logo"
                      : "Shule Yetu crest"
                  }
                  className="h-12 w-12 shrink-0 rounded-full bg-white object-contain p-0.5"
                />
                <div className="flex min-w-0 flex-col items-center leading-none group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-display text-lg uppercase tracking-tight">
                    Shule Yetu
                  </span>
                  <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
                    School portal
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Staff portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-60" />

        <SidebarGroup>
          <SidebarGroupLabel>School</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {schoolItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={user ? `${user.name} â€” ${user.role}` : "Not signed in"}
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center border border-sidebar-border font-mono text-xs text-gold">
                {user ? initials(user.name) : "â€“"}
              </div>
              <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">
                  {user?.name ?? "Not signed in"}
                </span>
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
                  {user?.role ?? "Guest"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={() => {
                void authClient.signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
