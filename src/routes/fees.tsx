import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { neonApi } from "@/lib/neon-api";
import { thCls, tdCls } from "@/components/portal-ui";
type Row = {
  id: string;
  adm: string;
  first: string;
  last: string;
  class: string;
  billed: number;
  paid: number;
  balance: number;
};
export const Route = createFileRoute("/fees")({
  head: () => ({ meta: [{ title: "Fees — Shule Yetu" }, { name: "robots", content: "noindex" }] }),
  component: FeesPage,
});
function FeesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void neonApi("/api/fees")
      .then((r) => r.json())
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load fee ledger."));
  }, []);
  const total = (key: "billed" | "paid" | "balance") =>
    rows.reduce((n, r) => n + Number(r[key]), 0);
  const money = (n: number) => `KES ${n.toLocaleString()}`;
  return (
    <PortalShell eyebrow="Finance" title="Fees">
      <p className="mb-5 text-sm text-ink-soft">
        Balances are calculated from fee obligations and payments entered on each student profile.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Billed", total("billed")],
          ["Paid", total("paid")],
          ["Balance", total("balance")],
        ].map(([label, value]) => (
          <div key={label} className="border border-ink/10 bg-paper p-5">
            <div className="eyebrow text-[10px] text-ink-soft">{label}</div>
            <div className="mt-2 font-display text-2xl">{money(Number(value))}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto border border-ink/10 bg-paper">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Admission", "Student", "Class", "Billed", "Paid", "Balance"].map((h) => (
                <th key={h} className={thCls}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${tdCls} font-mono text-xs`}>{r.adm}</td>
                <td className={`${tdCls} font-semibold`}>
                  <Link
                    to="/students/$studentId"
                    params={{ studentId: r.id }}
                    className="underline decoration-gold underline-offset-4"
                  >
                    {r.first} {r.last}
                  </Link>
                </td>
                <td className={tdCls}>{r.class || "—"}</td>
                <td className={tdCls}>{money(Number(r.billed))}</td>
                <td className={tdCls}>{money(Number(r.paid))}</td>
                <td
                  className={`${tdCls} font-semibold ${Number(r.balance) > 0 ? "text-owed" : "text-collected"}`}
                >
                  {money(Number(r.balance))}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-soft">
                  No student fee records yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="border-t-2 border-ink px-4 py-3 font-semibold" colSpan={3}>
                Totals
              </td>
              {(["billed", "paid", "balance"] as const).map((k) => (
                <td key={k} className="border-t-2 border-ink px-4 py-3 font-semibold">
                  {money(total(k))}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </PortalShell>
  );
}
