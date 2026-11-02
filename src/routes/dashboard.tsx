import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { attendanceTrend, notifications, weeklyPayments } from "@/lib/mock-school";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { getMockUser, type MockUser } from "@/lib/mock-auth";
import { announcements, dashboardStats, pendingApprovals, recentPayments, upcomingEvents } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Shule Yetu" },
      { name: "description", content: "Staff dashboard for Shule Yetu." },
      { property: "og:title", content: "Dashboard — Shule Yetu" },
      { property: "og:description", content: "Staff dashboard for Shule Yetu." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function MiniCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const dayNum = today.getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<number | null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthName = today.toLocaleDateString("en-GB", { month: "long" });
  const weekday = today.toLocaleDateString("en-GB", { weekday: "long" });

  return (
    <div className="border border-ink/10 bg-paper">
      <div className="flex items-center justify-between bg-ink px-4 py-3 text-paper">
        <div>
          <div className="eyebrow text-[10px] text-gold">{weekday}</div>
          <div className="font-display text-lg uppercase tracking-tight">
            {monthName} {year}
          </div>
        </div>
        <div className="font-display text-4xl leading-none text-gold">{dayNum}</div>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase text-ink-soft">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {cells.map((c, i) =>
            c === null ? (
              <div key={i} />
            ) : (
              <div key={i} className={`py-1 ${c === dayNum ? "bg-gold font-bold text-ink" : "text-ink/70"}`}>
                {c}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [user, setUser] = useState<MockUser | null>(null);
  useEffect(() => setUser(getMockUser()), []);

  const first = user?.name.split(" ")[0] ?? "there";

  return (
    <PortalShell
      eyebrow={user ? `${user.role} portal` : "Staff portal"}
      title={`Karibu, ${first}`}
    >
      <section className="relative overflow-hidden bg-ink px-6 py-8">
        <div className="stripes absolute inset-0 opacity-10" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2 text-gold">Term 2 · Michaelmas</div>
            <p className="max-w-lg text-sm text-paper/80">
              Here is where the school stands today — learners, fees and attendance, all sample
              data for now.
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/60">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Active students", "1,082", ""], ["Inactive students", "8", ""], ["Completed students", "214", ""],
              ["Fee collected · week", "KES 1.24M", "g"], ["Fee collected · month", "KES 4.9M", "g"], ["Fee collected · year", "KES 18.4M", "g"],
              ["Fee balance · term", "KES 2.1M", "r"], ["Fee balance · year", "KES 3.6M", "r"],
            ].map(([label, value, tone]) => (
              <div key={label} className={`border border-ink/10 p-5 ${tone === "g" ? "bg-collected-soft text-collected" : tone === "r" ? "bg-owed-soft text-owed" : "bg-paper"}`}>
                <div className="eyebrow text-[10px]">{label}</div>
                <div className="mt-2 font-display text-3xl">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-ink/10 p-5">
              <h2 className="eyebrow mb-3 text-ink-soft">Payments by week (KES millions)</h2>
              <div className="h-56"><ResponsiveContainer><BarChart data={weeklyPayments}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="week" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="amount" fill="var(--color-collected)" /></BarChart></ResponsiveContainer></div>
            </div>
            <div className="border border-ink/10 p-5">
              <h2 className="eyebrow mb-3 text-ink-soft">Attendance this week (%)</h2>
              <div className="h-56"><ResponsiveContainer><LineChart data={attendanceTrend}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="day" fontSize={12} /><YAxis domain={[85, 100]} fontSize={12} /><Tooltip /><Line dataKey="rate" stroke="var(--color-ink)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-ink/10 p-5">
              <h2 className="eyebrow mb-3 text-ink-soft">Notifications</h2>
              <ul className="space-y-2 text-sm">{notifications.map((n) => <li key={n} className="border-l-2 border-gold pl-3">{n}</li>)}</ul>
            </div>
            <div className="border border-ink/10 p-5">
              <h2 className="eyebrow mb-3 text-ink-soft">Quick actions</h2>
              <div className="flex flex-wrap gap-2">
                {([["Add student", "/students"], ["Record payment", "/students"], ["Approve marks", "/exams"], ["Assign teacher", "/teachers"], ["Generate term fees", "/classes"], ["Report cards", "/report-cards"]] as const).map(([t, to]) => (
                  <Link key={t} to={to} className="bg-ink px-3 py-2 text-xs font-bold uppercase tracking-wide text-paper hover:bg-ink-soft">{t}</Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <section className="lg:col-span-2">
              <h2 className="eyebrow mb-4 text-ink-soft">Recent fee payments</h2>
              <div className="overflow-x-auto border border-ink/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ink text-paper">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Receipt</th>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Class</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Method</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id} className="border-t border-ink/10">
                        <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                        <td className="px-4 py-3 font-semibold">{p.student}</td>
                        <td className="px-4 py-3">{p.class}</td>
                        <td className="px-4 py-3">{p.amount}</td>
                        <td className="px-4 py-3">{p.method}</td>
                        <td className="px-4 py-3 text-ink-soft">{p.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="eyebrow mb-4 text-ink-soft">Pending account approvals</h2>
              <div className="space-y-3">
                {pendingApprovals.map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center justify-between border border-ink/10 p-4"
                  >
                    <div>
                      <div className="text-sm font-semibold">{a.name}</div>
                      <div className="text-xs text-ink-soft">
                        {a.role} · {a.requested}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-ink px-3 py-1 text-xs font-bold uppercase text-paper hover:bg-ink-soft">
                        Approve
                      </button>
                      <button className="border border-ink/20 px-3 py-1 text-xs font-bold uppercase hover:border-ink">
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Right side panel */}
        <aside className="space-y-8 self-start xl:sticky xl:top-20">
          <section>
            <h2 className="eyebrow mb-3 text-ink-soft">Calendar</h2>
            <MiniCalendar />
          </section>

          <section>
            <h2 className="eyebrow mb-3 text-ink-soft">Upcoming events</h2>
            <div className="space-y-2">
              {upcomingEvents.map((e) => (
                <div
                  key={e.title}
                  className="flex items-center justify-between gap-3 border border-ink/10 bg-paper px-4 py-3"
                >
                  <div className="text-sm font-semibold">{e.title}</div>
                  <div className="shrink-0 font-mono text-xs text-ink-soft">{e.date}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-3 text-ink-soft">Announcements</h2>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div
                  key={a.title}
                  className="border border-ink/10 border-l-2 border-l-gold bg-paper px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{a.title}</div>
                    <div className="shrink-0 font-mono text-xs text-ink-soft">{a.date}</div>
                  </div>
                  <div className="mt-1 text-xs text-ink-soft">{a.body}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </PortalShell>
  );
}
