import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { btn, inputCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type Invoice = {
  id: string;
  number: string;
  plan: string;
  cycle: string;
  studentCount: number;
  amount: number;
  status: string;
  dueAt: string;
};
type Payment = {
  id: string;
  amount: number;
  method: string;
  reference: string;
  paidAt: string;
  status: string;
};
type BillingData = {
  plan: string;
  cycle: string;
  status: string;
  studentCount: number;
  expiresAt?: string;
  invoices: Invoice[];
  payments: Payment[];
};
const tiers = [
  ["Starter", "1–100", "KSh 1,500"],
  ["Basic", "101–300", "KSh 3,000"],
  ["Standard", "301–600", "KSh 5,000"],
  ["Premium", "601–1,000", "KSh 8,000"],
  ["Enterprise", "1,000+", "Custom pricing"],
];

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [{ title: "Billing - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: BillingPage,
});
function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [cycle, setCycle] = useState("monthly");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    const response = await neonApi("/api/billing");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load billing.");
    setData(payload);
  }
  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load billing."));
  }, []);
  async function createInvoice() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await neonApi("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: data?.plan || "Starter", cycle }),
      });
      const invoice = await response.json();
      if (!response.ok) throw new Error(invoice.error || "Could not create invoice.");
      setReference("");
      setMessage(
        `Invoice ${invoice.number} created. Record its M-Pesa or bank reference after payment.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invoice.");
    } finally {
      setBusy(false);
    }
  }
  async function recordPayment(invoice: Invoice) {
    if (!reference.trim()) {
      setError("Enter the payment reference first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await neonApi(`/api/billing/invoices/${invoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "M-Pesa", reference }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not record payment.");
      setMessage(
        `Payment reference submitted for invoice ${invoice.number}. Access will renew after platform verification.`,
      );
      setReference("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PortalShell eyebrow="Subscription" title="Billing">
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
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Active students", data?.studentCount ?? "—"],
          ["Current plan", data?.plan || "—"],
          ["Subscription status", data?.status || "—"],
        ].map(([label, value]) => (
          <article key={label} className="border border-ink/10 bg-paper p-5">
            <p className="eyebrow text-ink-soft">{label}</p>
            <p className="mt-2 font-display text-2xl">{value}</p>
          </article>
        ))}
      </section>
      <section className="mb-6 overflow-x-auto border border-ink/10 bg-paper p-5">
        <h2 className="eyebrow mb-4">Illustrative monthly plans (priced by active students)</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Plan", "Number of students", "Monthly price"].map((x) => (
                <th key={x} className="border-b border-ink/20 px-3 py-2">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiers.map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell} className="border-b border-ink/10 px-3 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-soft">
          Illustrative starting prices. Enterprise pricing is custom. Annual plans are charged at 10
          months of the monthly price (two months saved); termly billing covers three months.
        </p>
      </section>
      <section className="mb-6 border border-ink/10 bg-paper p-5">
        <h2 className="eyebrow">Choose a billing cycle</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select className={inputCls} value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option value="monthly">Monthly · every 30 days</option>
            <option value="termly">Termly · every 3 months</option>
            <option value="annual">Annual · 12 months, 2 months free</option>
          </select>
          <button
            className={btn()}
            disabled={busy || !data || data.studentCount > 1000}
            onClick={() => void createInvoice()}
          >
            {busy ? "Please wait…" : "Generate invoice"}
          </button>
        </div>
        {Number(data?.studentCount || 0) > 1000 && (
          <p className="mt-2 text-sm text-ink-soft">
            Your school is in the Enterprise tier. Contact us for a custom invoice.
          </p>
        )}
      </section>
      <section className="mb-6 border border-ink/10 bg-paper p-5">
        <h2 className="eyebrow mb-3">Invoices and payments</h2>
        {!data?.invoices.length ? (
          <p className="text-sm text-ink-soft">No invoices yet.</p>
        ) : (
          <div className="space-y-3">
            {data.invoices.map((invoice) => (
              <article
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-ink/10 p-4"
              >
                <div>
                  <strong>{invoice.number}</strong>
                  <p className="text-sm text-ink-soft">
                    {invoice.plan} · {invoice.cycle} · {invoice.studentCount} students · KSh{" "}
                    {Number(invoice.amount).toLocaleString()} · {invoice.status}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Due {new Date(invoice.dueAt).toLocaleDateString()}
                  </p>
                </div>
                {invoice.status === "due" && (
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="M-Pesa reference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                    <button
                      className={btn("good")}
                      disabled={busy}
                      onClick={() => void recordPayment(invoice)}
                    >
                      Record payment
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-ink-soft">
          M-Pesa STK Push is not connected yet. Record the M-Pesa receipt/reference after paying
          through your usual channel. Unpaid subscriptions have a 7-day grace period before school
          access is suspended.
        </p>
      </section>
      <section className="border border-ink/10 bg-paper p-5">
        <h2 className="eyebrow mb-3">Payment history</h2>
        {!data?.payments.length ? (
          <p className="text-sm text-ink-soft">No subscription payments recorded.</p>
        ) : (
          data.payments.map((p) => (
            <p key={p.id} className="border-t border-ink/10 py-3 text-sm">
              KSh {Number(p.amount).toLocaleString()} · {p.method} · {p.reference} ·{" "}
              {new Date(p.paidAt).toLocaleDateString()} Â· {p.status}
            </p>
          ))
        )}
      </section>
    </PortalShell>
  );
}
