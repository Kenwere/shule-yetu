import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Flash, Label, Panel, PrintButton, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { classes, className, kes, learnerName, learners as seed, seedLedger, type Learner, type LedgerRow } from "@/lib/mock-school";

export const Route = createFileRoute("/students")({
  head: () => ({
    meta: [
      { title: "Students — Shule Yetu" },
      { name: "description", content: "Student register, fee ledger, payments and statements." },
      { property: "og:title", content: "Students — Shule Yetu" },
      { property: "og:description", content: "Student register, fee ledger, payments and statements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentsPage,
});

const chip: Record<string, string> = {
  Active: "bg-collected-soft text-collected",
  Inactive: "bg-owed-soft text-owed",
  Completed: "bg-ink/10 text-ink-soft",
};

const empty: Learner = { adm: "", first: "", last: "", gender: "F", dob: "", classId: "g1", stream: "North", guardian: "", phone: "", address: "", admitted: new Date().toISOString().slice(0, 10), status: "Active" };

function StudentsPage() {
  const [list, setList] = useState<Learner[]>(seed);
  const [ledgers, setLedgers] = useState<Record<string, LedgerRow[]>>({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<Learner | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const rows = useMemo(() => list.filter((l) => (status === "All" || l.status === status) && `${learnerName(l)} ${l.adm} ${className(l.classId)}`.toLowerCase().includes(q.toLowerCase())), [list, q, status]);
  const ledgerOf = (adm: string) => ledgers[adm] ?? seedLedger(adm);
  const balance = (adm: string) => ledgerOf(adm).reduce((s, r) => s + r.debit - r.credit, 0);
  const learner = list.find((l) => l.adm === sel);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.first.trim() || !form.last.trim()) return setFlash("First and last name are required.");
    if (form.adm) {
      setList((ls) => ls.map((l) => (l.adm === form.adm ? form : l)));
      setFlash(`${learnerName(form)} updated.`);
    } else {
      const adm = `SY-${2100 + list.length}`;
      setList((ls) => [...ls, { ...form, adm }]);
      setFlash(`${learnerName(form)} admitted as ${adm}.`);
    }
    setForm(null);
  }

  return (
    <PortalShell eyebrow="Register" title="Students" actions={<button className={btn()} onClick={() => setForm({ ...empty })}>Add student</button>}>
      <Flash message={flash} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {(["Active", "Inactive", "Completed"] as const).map((s) => (
          <div key={s} className={`border border-ink/10 p-4 ${chip[s]}`}>
            <div className="eyebrow text-[10px]">{s} students</div>
            <div className="mt-1 font-display text-3xl">{list.filter((l) => l.status === s).length}</div>
          </div>
        ))}
      </div>

      {form && (
        <Panel title={form.adm ? `Edit ${form.adm}` : "New student"} className="mb-6">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
            <Label text="First name"><input className={inputCls} value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} /></Label>
            <Label text="Last name"><input className={inputCls} value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} /></Label>
            <Label text="Gender"><select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as "F" | "M" })}><option>F</option><option>M</option></select></Label>
            <Label text="Date of birth"><input type="date" className={inputCls} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Label>
            <Label text="Class"><select className={inputCls} value={form.classId} onChange={(e) => { const c = classes.find((x) => x.id === e.target.value)!; setForm({ ...form, classId: c.id, stream: c.streams[0] ?? "" }); }}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label>
            <Label text="Stream"><select className={inputCls} value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })}>{classes.find((c) => c.id === form.classId)!.streams.map((s) => <option key={s}>{s}</option>)}</select></Label>
            <Label text="Guardian"><input className={inputCls} value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} /></Label>
            <Label text="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Label>
            <Label text="Status"><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Learner["status"] })}><option>Active</option><option>Inactive</option><option>Completed</option></select></Label>
            <div className="flex gap-2 sm:col-span-3"><button className={btn()}>Save</button><button type="button" className={btn("ghost")} onClick={() => setForm(null)}>Cancel</button></div>
          </form>
        </Panel>
      )}

      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        <input className={`${inputCls} max-w-xs`} placeholder="Search name, admission no. or class" value={q} onChange={(e) => setQ(e.target.value)} />
        {["All", "Active", "Inactive", "Completed"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={btn(status === s ? "primary" : "ghost")}>{s}</button>
        ))}
      </div>
      <div className="overflow-x-auto border border-ink/10 bg-card print:hidden">
        <table className="w-full text-sm">
          <thead><tr>{["Adm", "Name", "Class", "Guardian", "Balance", "Status", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.adm} className={sel === l.adm ? "bg-gold/10" : ""}>
                <td className={`${tdCls} font-mono text-xs`}>{l.adm}</td>
                <td className={`${tdCls} font-semibold`}>{learnerName(l)}</td>
                <td className={tdCls}>{className(l.classId)} {l.stream}</td>
                <td className={tdCls}>{l.guardian} · {l.phone}</td>
                <td className={`${tdCls} ${balance(l.adm) > 0 ? "text-owed" : "text-collected"}`}>{kes(balance(l.adm))}</td>
                <td className={tdCls}><span className={`px-2 py-0.5 text-xs ${chip[l.status]}`}>{l.status}</span></td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <button className={btn("ghost")} onClick={() => setSel(l.adm)}>Ledger</button>{" "}
                  <button className={btn("ghost")} onClick={() => setForm({ ...l })}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {learner && (
        <LedgerPanel
          learner={learner}
          rows={ledgerOf(learner.adm)}
          onAdd={(row, msg) => { setLedgers((m) => ({ ...m, [learner.adm]: [...ledgerOf(learner.adm), row] })); setFlash(msg); }}
        />
      )}
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">Sample learners · changes reset on reload</p>
    </PortalShell>
  );
}

function LedgerPanel({ learner, rows, onAdd }: { learner: Learner; rows: LedgerRow[]; onAdd: (r: LedgerRow, msg: string) => void }) {
  const [entry, setEntry] = useState<LedgerRow["entry"]>("Payment");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [receipt, setReceipt] = useState<LedgerRow | null>(null);
  let run = 0;
  const bal = rows.reduce((s, r) => s + r.debit - r.credit, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    const debit = entry === "Debt added" ? n : entry === "Balance set" ? Math.max(n - bal, 0) : 0;
    const credit = entry === "Payment" || entry === "Credit added" ? n : entry === "Balance set" ? Math.max(bal - n, 0) : 0;
    const row: LedgerRow = { date: new Date().toISOString().slice(0, 10), term: "Term 3 · 2026", entry, debit, credit, comment: comment || entry };
    onAdd(row, `${entry} of ${kes(n)} recorded for ${learnerName(learner)}.`);
    if (entry === "Payment") setReceipt(row);
    setAmount(""); setComment("");
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      <Panel title={`Statement · ${learnerName(learner)} (${learner.adm})`} action={<PrintButton label="Print statement" />} className="lg:col-span-2">
        <table className="w-full text-sm">
          <thead><tr>{["Date", "Term", "Entry", "Debit", "Credit", "Balance", "Comment"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => { run += r.debit - r.credit; return (
              <tr key={i}><td className={tdCls}>{r.date}</td><td className={tdCls}>{r.term}</td><td className={tdCls}>{r.entry}</td><td className={tdCls}>{r.debit ? kes(r.debit) : "—"}</td><td className={tdCls}>{r.credit ? kes(r.credit) : "—"}</td><td className={`${tdCls} font-semibold`}>{kes(run)}</td><td className={`${tdCls} text-ink-soft`}>{r.comment}</td></tr>
            ); })}
          </tbody>
        </table>
        <div className={`mt-3 text-right font-display text-2xl ${bal > 0 ? "text-owed" : "text-collected"}`}>Balance {kes(bal)}</div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Record entry">
          <form onSubmit={submit} className="space-y-3">
            <Label text="Type"><select className={inputCls} value={entry} onChange={(e) => setEntry(e.target.value as LedgerRow["entry"])}>{["Payment", "Debt added", "Credit added", "Balance set"].map((x) => <option key={x}>{x}</option>)}</select></Label>
            <Label text={entry === "Balance set" ? "New balance (KES)" : "Amount (KES)"}><input type="number" min="1" required className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Label>
            <Label text="Comment / reference"><input className={inputCls} maxLength={120} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. M-Pesa QFT…" /></Label>
            <button className={btn()}>Save entry</button>
          </form>
        </Panel>
        {receipt && (
          <Panel title="Receipt" action={<PrintButton label="Print receipt" />}>
            <div className="font-display text-xl uppercase">Shule Yetu</div>
            <div className="mt-2 space-y-1 text-sm">
              <div>Received from: <b>{learner.guardian}</b> for {learnerName(learner)} ({learner.adm})</div>
              <div>Amount: <b>{kes(receipt.credit)}</b></div>
              <div>Ref: {receipt.comment} · {receipt.date}</div>
              <div>Balance after: {kes(bal)}</div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
