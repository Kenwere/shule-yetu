import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { neonApi } from "@/lib/neon-api";
import { btn, inputCls, thCls, tdCls } from "@/components/portal-ui";
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
type StudentOption = {
  id: string;
  adm: string;
  first: string;
  last: string;
  class: string;
  stream: string;
};
export const Route = createFileRoute("/fees")({
  head: () => ({ meta: [{ title: "Fees — Shule Yetu" }, { name: "robots", content: "noindex" }] }),
  component: FeesPage,
});
function FeesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<StudentOption[]>([]);
  const [student, setStudent] = useState<StudentOption | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [term, setTerm] = useState("");
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [method, setMethod] = useState("M-Pesa");
  const [receipt, setReceipt] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  async function loadRows() {
    const r = await neonApi("/api/fees");
    setRows(await r.json());
  }
  useEffect(() => {
    void loadRows().catch((e) =>
      setError(e instanceof Error ? e.message : "Could not load fee ledger."),
    );
    void neonApi("/api/me")
      .then((r) => r.json())
      .then((me) => setCanRecord(me.role === "Admin" || me.permissions?.includes("edit_fees")))
      .catch(() => setCanRecord(false));
    void neonApi("/api/me")
      .then((r) => r.json())
      .then((me) => {
        const year = String(me.school?.academicYear || new Date().getFullYear());
        setAcademicYear(year);
        setTerm(`${me.school?.activeTerm || "Term 1"} ${year}`);
      })
      .catch(() => setTerm(`Term 1 ${new Date().getFullYear()}`));
  }, []);
  useEffect(() => {
    if (!open || search.trim().length < 2) {
      setMatches([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void neonApi(`/api/fee-students?q=${encodeURIComponent(search.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (active) setMatches(d);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : "Could not search students.");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, search]);
  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student) {
      setError("Choose a student before recording a payment.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await neonApi(`/api/students/${student.id}/fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: "Payment",
          amount: Number(amount),
          date,
          term,
          method,
          reference: receipt,
          comment,
          requestId: crypto.randomUUID(),
        }),
      });
      setNotice(`Payment recorded for ${student.first} ${student.last}.`);
      setOpen(false);
      setStudent(null);
      setSearch("");
      setAmount("");
      setReceipt("");
      setComment("");
      await loadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }
  const total = (key: "billed" | "paid" | "balance") =>
    rows.reduce((n, r) => n + Number(r[key]), 0);
  const money = (n: number) => `KES ${n.toLocaleString()}`;
  return (
    <PortalShell
      eyebrow="Finance"
      title="Fees"
      actions={
        canRecord ? (
          <button
            className={btn()}
            onClick={() => {
              setOpen(true);
              setError("");
            }}
          >
            Record payment
          </button>
        ) : undefined
      }
    >
      <p className="mb-5 text-sm text-ink-soft">
        Balances are calculated from fee obligations and payments entered on each student profile.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-sm text-collected">
          {notice}
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
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-ink/10 bg-paper p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-ink-soft">Finance</p>
                <h2 id="payment-title" className="font-display text-2xl font-bold">
                  Record fee payment
                </h2>
              </div>
              <button type="button" className={btn("ghost")} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <label className="block text-sm">
              Search by student name or admission number
              <input
                autoFocus
                className={inputCls}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setStudent(null);
                }}
                placeholder="Type at least 2 characters"
              />
            </label>
            {searching && (
              <p role="status" className="mt-2 text-sm text-ink-soft">
                Searching students…
              </p>
            )}
            {matches.length > 0 && !student && (
              <ul className="mt-2 max-h-40 overflow-y-auto border border-ink/10 bg-white">
                {matches.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
                      onClick={() => {
                        setStudent(s);
                        setSearch(`${s.first} ${s.last} · ${s.adm}`);
                        setMatches([]);
                      }}
                    >
                      <strong>
                        {s.first} {s.last}
                      </strong>
                      <span className="ml-2 text-ink-soft">
                        {s.adm} · {s.class} {s.stream}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim().length >= 2 && !searching && !matches.length && !student && (
              <p className="mt-2 text-sm text-ink-soft">No matching student found.</p>
            )}
            {student && (
              <p className="mt-3 border border-collected/30 bg-white p-3 text-sm">
                <strong>Selected:</strong> {student.first} {student.last} · {student.adm} ·{" "}
                {student.class} {student.stream}
              </p>
            )}
            <form
              onSubmit={(e) => void recordPayment(e)}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <label className="block text-sm">
                Amount paid
                <input
                  className={inputCls}
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Date paid
                <input
                  className={inputCls}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Term / academic year
                <select
                  className={inputCls}
                  value={term.match(/Term [123]/)?.[0] || "Term 1"}
                  onChange={(e) => setTerm(`${e.target.value} ${academicYear}`)}
                >
                  {["Term 1", "Term 2", "Term 3"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  type="number"
                  aria-label="Academic year"
                  min="2000"
                  max="2200"
                  value={academicYear}
                  onChange={(e) => {
                    setAcademicYear(e.target.value);
                    setTerm(`${term.match(/Term [123]/)?.[0] || "Term 1"} ${e.target.value}`);
                  }}
                />
              </label>
              <label className="block text-sm">
                Payment method
                <select
                  className={inputCls}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {["M-Pesa", "Cash", "Bank", "Card", "Other"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Receipt / reference number
                <input
                  className={inputCls}
                  value={receipt}
                  onChange={(e) => setReceipt(e.target.value)}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                Comment (optional)
                <textarea
                  className={inputCls}
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="A clear note will be added automatically if left blank."
                />
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" className={btn("ghost")} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className={btn()} disabled={saving || !student}>
                  {saving ? "Saving…" : "Save payment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
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
