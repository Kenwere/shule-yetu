import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";
type Student = {
  id: string;
  adm: string;
  first: string;
  last: string;
  gender: string;
  dob: string | null;
  admitted: string;
  class: string;
  stream: string;
  guardian: string;
  phone: string;
  address: string;
  status: string;
  photoUrl: string;
};
type Fee = {
  id: string;
  date: string;
  term: string;
  entry: string;
  debit: number;
  credit: number;
  method: string;
  reference: string;
  comment: string;
};
export const Route = createFileRoute("/students/$studentId")({
  head: () => ({
    meta: [{ title: "Student profile - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: StudentProfile,
});
function StudentProfile() {
  const { studentId } = useParams({ from: "/students/$studentId" });
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [school, setSchool] = useState({
    name: "",
    motto: "",
    email: "",
    phone: "",
    address: "",
    logoUrl: "",
  });
  const [error, setError] = useState("");
  const [entry, setEntry] = useState("Payment");
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("M-Pesa");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [r, me] = await Promise.all([
        neonApi(`/api/students/${studentId}`),
        neonApi("/api/me"),
      ]);
      const d = await r.json();
      const m = await me.json();
      setStudent(d.student);
      setFees(d.fees);
      setSchool({
        name: m.school?.school_name || "",
        motto: m.school?.motto || "",
        email: m.school?.contact_email || "",
        phone: m.school?.phone || "",
        address: m.school?.address || "",
        logoUrl: m.school?.logoUrl || "",
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load student profile.");
    }
  }, [studentId]);
  useEffect(() => {
    void load();
  }, [load]);
  const chronological = [...fees].reverse();
  const balances = new Map<string, number>();
  let runningBalance = 0;
  for (const fee of chronological) {
    runningBalance += Number(fee.debit) - Number(fee.credit);
    balances.set(fee.id, runningBalance);
  }
  const balance = runningBalance;
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await neonApi(`/api/students/${studentId}/fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry,
          amount: Number(amount),
          term,
          date,
          method,
          reference,
          comment,
          requestId: crypto.randomUUID(),
        }),
      });
      setAmount("");
      setComment("");
      setReference("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save fee entry.");
    } finally {
      setBusy(false);
    }
  }
  const money = (n: number) =>
    `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <PortalShell
      eyebrow="Student profile"
      title={student ? `${student.first} ${student.last}` : "Student"}
      actions={
        <>
          <button className={`${btn("ghost")} print:hidden`} onClick={() => window.print()}>
            Print fee statement
          </button>
          <Link to="/students" className={`${btn("ghost")} print:hidden`}>
            All students
          </Link>
        </>
      }
    >
      <style>{`@page{size:A4 portrait;margin:12mm}@media print{body{background:#fff!important;color:#111!important;font-size:9pt}.student-fee-statement table{width:100%;border-collapse:collapse}.student-fee-statement th,.student-fee-statement td{border:1px solid #444;padding:5px 6px}.student-fee-statement thead{display:table-header-group}.student-fee-statement tr{break-inside:avoid}.student-fee-statement .fee-summary{border:1px solid #333;padding:8px;margin-top:8px}}`}</style>
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}
      {student && (
        <>
          {student.photoUrl && (
            <div className="mb-5 print:mb-3">
              <img
                src={student.photoUrl}
                alt={`${student.first} ${student.last}`}
                className="h-28 w-28 rounded-full object-cover print:h-20 print:w-20"
              />
            </div>
          )}
          <header className="mb-5 hidden border-b-2 border-ink pb-4 print:block">
            <div className="flex items-center gap-4">
              {school.logoUrl && (
                <img src={school.logoUrl} alt="" className="h-16 w-16 object-contain" />
              )}
              <div className="min-w-0 flex-1 text-center">
                <h1 className="font-display text-2xl font-bold uppercase">
                  {school.name || "School"}
                </h1>
                {school.motto && <p className="text-sm italic">{school.motto}</p>}
                <p className="text-xs">
                  {[school.address, school.phone, school.email].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <h2 className="mt-3 border-y border-ink py-1 text-center font-semibold uppercase">
              Student fee statement
            </h2>
            <p className="mt-2 text-xs">Printed: {new Date().toLocaleDateString()}</p>
          </header>
          <div className="mb-6 grid gap-4 sm:grid-cols-3 print:grid-cols-3">
            {[
              ["Admission", student.adm],
              ["Gender", student.gender || "-"],
              ["Class", `${student.class} ${student.stream}`],
              ["Date of birth", student.dob || "-"],
              ["Admission date", student.admitted || "-"],
              ["Status", student.status],
              ["Guardian", student.guardian],
              ["Phone", student.phone],
              ["Address", student.address],
            ].map(([k, v]) => (
              <div key={k} className="border border-ink/10 bg-paper p-4 print:bg-white">
                <div className="eyebrow text-[10px] text-ink-soft">{k}</div>
                <div className="mt-1 text-sm font-semibold">{v || "-"}</div>
              </div>
            ))}
          </div>
          <div className="student-fee-statement grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] print:block">
            <Panel title="Fee ledger">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Date",
                        "Term / year",
                        "Entry",
                        "Debit",
                        "Credit",
                        "Balance",
                        "Method / reference",
                        "Comment",
                      ].map((h) => (
                        <th key={h} className={thCls}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chronological.map((f) => {
                      const running = balances.get(f.id) ?? 0;
                      return (
                        <tr key={f.id}>
                          <td className={tdCls}>{new Date(f.date).toLocaleDateString()}</td>
                          <td className={tdCls}>{f.term || "-"}</td>
                          <td className={tdCls}>{f.entry}</td>
                          <td className={tdCls}>
                            {Number(f.debit) ? money(Number(f.debit)) : "-"}
                          </td>
                          <td className={tdCls}>
                            {Number(f.credit) ? money(Number(f.credit)) : "-"}
                          </td>
                          <td className={`${tdCls} font-semibold`}>{money(running)}</td>
                          <td className={tdCls}>
                            {[f.method, f.reference].filter(Boolean).join(" / ") || "-"}
                          </td>
                          <td className={tdCls}>{f.comment || "-"}</td>
                        </tr>
                      );
                    })}
                    {!fees.length && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-ink-soft">
                          No fee entries recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="fee-summary mt-4 text-right text-sm font-semibold">
                Current balance: {money(balance)}
              </p>
            </Panel>
            <Panel title="Record payment or adjustment" className="print:hidden">
              <form onSubmit={save} className="space-y-3">
                <label className="block text-sm">
                  Entry type
                  <select
                    className={inputCls}
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                  >
                    <option>Payment</option>
                    <option>Debt added</option>
                    <option>Credit added</option>
                    <option>Balance set</option>
                  </select>
                </label>
                <label className="block text-sm">
                  {entry === "Balance set" ? "New balance" : "Amount"}
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    className={inputCls}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Date
                  <input
                    required
                    type="date"
                    className={inputCls}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Term / academic year
                  <input
                    className={inputCls}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="e.g. Term 1 2027"
                  />
                </label>
                {entry === "Payment" && (
                  <>
                    <label className="block text-sm">
                      Payment method
                      <select
                        required
                        className={inputCls}
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                      >
                        {["M-Pesa", "Cash", "Bank", "Card", "Other"].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Reference number
                      <input
                        className={inputCls}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <label className="block text-sm">
                  {entry === "Payment" ? "Comment" : "Reason / comment"}
                  <textarea
                    required={entry !== "Payment"}
                    rows={3}
                    className={inputCls}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <button className={btn()} disabled={busy}>
                  {busy ? "Saving..." : "Save ledger entry"}
                </button>
              </form>
            </Panel>
          </div>
        </>
      )}
    </PortalShell>
  );
}
