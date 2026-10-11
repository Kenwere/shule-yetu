import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { getMockUser, signOutMock, type MockUser } from "@/lib/mock-auth";
import { dashboardStats, recentPayments, pendingApprovals, upcomingEvents } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — St John's Academy" },
      { name: "description", content: "Staff dashboard for St John's Academy." },
      { property: "og:title", content: "Dashboard — St John's Academy" },
      { property: "og:description", content: "Staff dashboard for St John's Academy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<MockUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setUser(getMockUser());
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-4xl uppercase tracking-tight">Sign in required</h1>
          <p className="mt-3 text-sm text-ink-soft">You need to log in to view the staff dashboard.</p>
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

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
          <div>
            <div className="eyebrow mb-2 text-gold">{user.role} portal</div>
            <h1 className="font-display text-4xl uppercase tracking-tight text-paper">
              Karibu, {user.name.split(" ")[0]}
            </h1>
          </div>
          <button
            onClick={() => {
              signOutMock();
              navigate({ to: "/" });
            }}
            className="border border-paper/30 px-4 py-2 text-sm font-semibold text-paper hover:border-gold hover:text-gold"
          >
            Sign out
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div key={a.name} className="flex items-center justify-between border border-ink/10 p-4">
                    <div>
                      <div className="text-sm font-semibold">{a.name}</div>
                      <div className="text-xs text-ink-soft">{a.role} · {a.requested}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-ink px-3 py-1 text-xs font-bold uppercase text-paper hover:bg-ink-soft">Approve</button>
                      <button className="border border-ink/20 px-3 py-1 text-xs font-bold uppercase hover:border-ink">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="eyebrow mb-4 text-ink-soft">Upcoming events</h2>
              <div className="space-y-3">
                {upcomingEvents.map((e) => (
                  <div key={e.title} className="flex items-center justify-between border border-ink/10 p-4">
                    <div className="text-sm font-semibold">{e.title}</div>
                    <div className="font-mono text-xs text-ink-soft">{e.date}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
