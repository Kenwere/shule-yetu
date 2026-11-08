import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { btn, inputCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";
import { authClient } from "@/lib/auth-client";
type School = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  plan: string;
  cycle: string;
  activeStudents: number;
  activeStaff: number;
};
type PendingPayment = {
  id: string;
  schoolName: string;
  invoiceNumber: string;
  amount: number;
  method: string;
  reference: string;
  paidAt: string;
};
const plans = ["Starter", "Basic", "Standard", "Premium", "Enterprise"];
export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Platform administration - Shule Yetu" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdminPage,
});
function SuperAdminPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  async function load() {
    const [response, paymentResponse] = await Promise.all([
      neonApi("/api/platform/schools"),
      neonApi("/api/platform/payments"),
    ]);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Super-admin access is not configured.");
    setSchools(data.schools);
    const paymentData = await paymentResponse.json();
    setPayments(paymentResponse.ok ? paymentData.payments : []);
  }
  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load schools."));
  }, []);
  async function update(school: School, patch: { status?: string; plan?: string }) {
    setBusy(school.id);
    setError("");
    setMessage("");
    try {
      const response = await neonApi(`/api/platform/schools/${school.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update school.");
      setMessage(`${school.name} updated.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update school.");
    } finally {
      setBusy("");
    }
  }
  async function decidePayment(payment: PendingPayment, decision: "confirm" | "reject") {
    setBusy(payment.id);
    setError("");
    setMessage("");
    try {
      const response = await neonApi(`/api/platform/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not verify payment.");
      setMessage(`${payment.invoiceNumber} ${decision === "confirm" ? "confirmed" : "rejected"}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify payment.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex h-14 items-center justify-between border-b border-ink/10 px-5">
        <Link to="/" className="font-display text-lg">
          Shule Yetu · Platform
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm underline">
            School login
          </Link>
          <button
            className={btn("ghost")}
            onClick={() => void authClient.signOut().then(() => window.location.assign("/login"))}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7">
        <p className="eyebrow text-ink-soft">Platform controls</p>
        <h1 className="mb-5 font-display text-3xl uppercase">Super admin</h1>
        <p className="mb-5 max-w-3xl text-sm text-ink-soft">
          Manage school access and plan assignment across Shule Yetu. Add a comma-separated,
          authorized email allowlist to the Neon Function environment variable{" "}
          <code>SUPER_ADMIN_EMAILS</code> to grant platform access. This is separate from school
          administrator roles.
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-owed">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-4 text-sm text-collected">
            {message}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="border border-ink/10 bg-paper p-5">
            <p className="eyebrow text-ink-soft">Schools</p>
            <p className="mt-2 font-display text-3xl">{schools.length}</p>
          </article>
          <article className="border border-ink/10 bg-paper p-5">
            <p className="eyebrow text-ink-soft">Active students</p>
            <p className="mt-2 font-display text-3xl">
              {schools.reduce((sum, school) => sum + Number(school.activeStudents), 0)}
            </p>
          </article>
        </div>
        <div className="mt-6 space-y-4">
          {schools.map((school) => (
            <article key={school.id} className="border border-ink/10 bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">{school.name}</h2>
                  <p className="text-sm text-ink-soft">
                    {school.email} · {school.phone || "No phone"}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {school.activeStudents} active students · {school.activeStaff} staff ·{" "}
                    {school.status}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`${school.name} plan`}
                    className={inputCls}
                    value={school.plan}
                    onChange={(e) => void update(school, { plan: e.target.value })}
                  >
                    {plans.map((plan) => (
                      <option key={plan}>{plan}</option>
                    ))}
                  </select>
                  <button
                    className={btn(school.status === "active" ? "bad" : "good")}
                    disabled={busy === school.id}
                    onClick={() =>
                      void update(school, {
                        status: school.status === "active" ? "suspended" : "active",
                      })
                    }
                  >
                    {school.status === "active" ? "Suspend school" : "Restore access"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <section className="mt-8 border border-ink/10 bg-paper p-5">
          <h2 className="eyebrow mb-4">Subscription payment verification</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Manual M-Pesa or bank references remain pending until platform admin verification.
            Confirming extends the school's subscription; rejecting leaves the invoice due.
          </p>
          {payments.length ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <article
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-ink/10 p-4"
                >
                  <div>
                    <strong>{payment.schoolName}</strong>
                    <p className="text-sm text-ink-soft">
                      {payment.invoiceNumber} · KSh {Number(payment.amount).toLocaleString()} ·{" "}
                      {payment.method} reference {payment.reference}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={btn("good")}
                      disabled={busy === payment.id}
                      onClick={() => void decidePayment(payment, "confirm")}
                    >
                      Confirm
                    </button>
                    <button
                      className={btn("bad")}
                      disabled={busy === payment.id}
                      onClick={() => void decidePayment(payment, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              No subscription payments are waiting for verification.
            </p>
          )}
        </section>
        {!error && !schools.length && (
          <p className="mt-6 text-sm text-ink-soft">No registered schools yet.</p>
        )}
      </main>
    </div>
  );
}
