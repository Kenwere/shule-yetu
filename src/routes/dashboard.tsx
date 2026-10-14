import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { getMockUser, type MockUser } from "@/lib/mock-auth";
import { dashboardStats, pendingApprovals, recentPayments, upcomingEvents } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — St John's Academy" },
      { name: "description", content: "Staff dashboard for St John's Academy." },
      { property: "og:title", content: "Dashboard — St John's Academy" },
      { property: "og:description", content: "Staff dashboard for St John's Academy." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((s) => (
          <div key={s.label} className="border border-ink/10 bg-paper p-5">
            <div className="eyebrow text-[10px] text-ink-soft">{s.label}</div>
            <div className="mt-2 font-display text-3xl">{s.value}</div>
            <div className="mt-1 text-xs text-ink-soft">{s.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
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

        <div className="space-y-8">
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

          <section>
            <h2 className="eyebrow mb-4 text-ink-soft">Upcoming events</h2>
            <div className="space-y-3">
              {upcomingEvents.map((e) => (
                <div
                  key={e.title}
                  className="flex items-center justify-between border border-ink/10 p-4"
                >
                  <div className="text-sm font-semibold">{e.title}</div>
                  <div className="font-mono text-xs text-ink-soft">{e.date}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
