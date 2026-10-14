import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/PortalShell";
import { feeLedger, feeSummary } from "@/lib/mock-data";

export const Route = createFileRoute("/fees")({
  head: () => ({
    meta: [
      { title: "Fees — St John's Academy" },
      { name: "description", content: "Fee summary and ledger for St John's Academy." },
      { property: "og:title", content: "Fees — St John's Academy" },
      { property: "og:description", content: "Fee summary and ledger for St John's Academy." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FeesPage,
});

function FeesPage() {
  const totalBilled = feeLedger.reduce((sum, r) => sum + r.billed, 0);
  const totalPaid = feeLedger.reduce((sum, r) => sum + r.paid, 0);

  return (
    <PortalShell eyebrow="Bursar" title="Fees & payments">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-ink/10 bg-collected-soft p-6">
          <h2 className="eyebrow mb-4 text-collected">Fee collected</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {feeSummary.collected.map((c) => (
              <div key={c.label}>
                <div className="text-xs text-collected/80">{c.label}</div>
                <div className="mt-1 font-display text-2xl text-collected">{c.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-ink/10 bg-owed-soft p-6">
          <h2 className="eyebrow mb-4 text-owed">Fee balance</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {feeSummary.balance.map((b) => (
              <div key={b.label}>
                <div className="text-xs text-owed/80">{b.label}</div>
                <div className="mt-1 font-display text-2xl text-owed">{b.value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <h2 className="eyebrow mb-4 mt-10 text-ink-soft">Fee ledger · Term 2</h2>
      <div className="overflow-x-auto border border-ink/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink text-paper">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Class</th>
              <th className="px-4 py-3 font-semibold">Billed</th>
              <th className="px-4 py-3 font-semibold">Paid</th>
              <th className="px-4 py-3 font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {feeLedger.map((r) => {
              const balance = r.billed - r.paid;
              return (
                <tr key={r.student} className="border-t border-ink/10">
                  <td className="px-4 py-3 font-semibold">{r.student}</td>
                  <td className="px-4 py-3">{r.class}</td>
                  <td className="px-4 py-3">KES {r.billed.toLocaleString()}</td>
                  <td className="px-4 py-3">KES {r.paid.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {balance > 0 ? (
                      <span className="font-semibold text-owed">
                        KES {balance.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-collected">Cleared</span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-ink bg-paper font-semibold">
              <td className="px-4 py-3" colSpan={2}>
                Totals
              </td>
              <td className="px-4 py-3">KES {totalBilled.toLocaleString()}</td>
              <td className="px-4 py-3">KES {totalPaid.toLocaleString()}</td>
              <td className="px-4 py-3 text-owed">
                KES {(totalBilled - totalPaid).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Sample ledger · figures are illustrative
      </p>
    </PortalShell>
  );
}
