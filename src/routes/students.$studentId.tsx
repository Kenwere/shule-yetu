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
      setTerm(
        `${m.school?.activeTerm || "Term 1"} ${m.school?.academicYear || new Date().getFullYear()}`,
      );
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
  const totalBilled = chronological.reduce((sum, fee) => sum + Number(fee.debit || 0), 0);
  const totalPaid = chronological.reduce(
    (sum, fee) => sum + (fee.entry === "Payment" ? Number(fee.credit || 0) : 0),
    0,
  );
  const totalCredits = chronological.reduce((sum, fee) => sum + Number(fee.credit || 0), 0);
  const statementDate = (value: string) =>
    new Date(value)
      .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
      .replaceAll(" ", "-");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const effectiveComment =
        comment.trim() ||
        (entry === "Adjust balance"
          ? "Student balance adjusted by school administrator."
          : entry === "Debt added"
            ? "Additional fee balance recorded."
            : entry === "Credit added"
              ? "Fee credit adjustment recorded."
              : `Fee payment recorded${reference.trim() ? `; receipt ${reference.trim()}` : ""}.`);
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
          comment: effectiveComment,
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
      <style>{`@page{size:A4 portrait;margin:14mm}@media print{body{background:#fff!important;color:#111!important;font-size:9pt}div[data-side],header.sticky{display:none!important}main{padding:0!important}.fee-print-report{display:block!important;font-family:Arial,sans-serif}.fee-print-report table{width:100%;border-collapse:collapse;font:8pt Arial,sans-serif}.fee-print-report th{border-bottom:1.5px solid #111;padding:5px 3px;text-align:left}.fee-print-report td{padding:4px 3px;border-bottom:1px solid #bbb;vertical-align:top}.fee-print-report .amount{text-align:right;white-space:nowrap}.fee-print-report tr{break-inside:avoid}.fee-print-report tfoot{display:table-row-group;font-weight:bold}.fee-print-report .statement-header{border:1px dotted #555;padding:8px}.fee-print-report .statement-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:16px 0 10px;font-size:8pt}.fee-print-report .statement-meta span:nth-child(even){text-align:right}.student-fee-statement{display:none!important}}`}</style>
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}
      {student && (
        <>
          {student.photoUrl && (
            <div className="mb-5 print:hidden">
              <img
                src={student.photoUrl}
                alt={`${student.first} ${student.last}`}
                className="h-28 w-28 rounded-full object-cover print:h-20 print:w-20"
              />
            </div>
          )}
          <header className="mb-5 hidden border-b-2 border-ink pb-4 print:hidden">
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
            <h2 className="mt-3 border-y-2 border-ink py-2 text-center font-display text-lg font-bold uppercase">
              Student fee report
            </h2>
            <p className="mt-2 flex justify-between text-xs">
              <span>Statement date: {new Date().toLocaleDateString("en-KE")}</span>
              <span>Admission number: {student.adm}</span>
            </p>
          </header>
          <div className="mb-6 grid gap-4 sm:grid-cols-3 print:hidden">
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
          <div className="fee-print-report hidden print:block">
            <div className="statement-header flex items-center gap-4">
              {school.logoUrl && (
                <img src={school.logoUrl} alt="" className="h-20 w-20 object-contain" />
              )}
              <div className="flex-1 text-center">
                <h1 className="text-xl font-medium uppercase">{school.name || "School"}</h1>
                <h2 className="mt-3 font-mono text-xs font-bold">Statement of Account</h2>
              </div>
            </div>
            <div className="statement-meta">
              <span>
                Account Code: <strong>{student.adm}</strong>
              </span>
              <span>Report Date: {statementDate(new Date().toISOString())}</span>
            </div>
            <p className="mb-2 font-bold">
              {student.first} {student.last}
            </p>
            <p className="mb-3 text-xs">
              {student.class} {student.stream} · Guardian: {student.guardian || "—"}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Journal</th>
                  <th>Description</th>
                  <th className="amount" colSpan={3}>
                    Amount
                  </th>
                </tr>
                <tr>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th className="amount">Debits</th>
                  <th className="amount">Credits</th>
                  <th className="amount">Balance</th>
                </tr>
              </thead>
              <tbody>
                {chronological.map((fee) => {
                  const running = balances.get(fee.id) ?? 0;
                  const journal =
                    [fee.method, fee.reference].filter(Boolean).join(" / ") || fee.entry;
                  const description = [fee.term, fee.comment || fee.entry]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={fee.id}>
                      <td>{statementDate(fee.date)}</td>
                      <td>{journal}</td>
                      <td>{description}</td>
                      <td className="amount">
                        {Number(fee.debit)
                          ? Number(fee.debit).toLocaleString("en-KE", { minimumFractionDigits: 2 })
                          : ""}
                      </td>
                      <td className="amount">
                        {Number(fee.credit)
                          ? Number(fee.credit).toLocaleString("en-KE", { minimumFractionDigits: 2 })
                          : ""}
                      </td>
                      <td className="amount">
                        {running.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
                {!chronological.length && (
                  <tr>
                    <td colSpan={6}>No fee transactions recorded.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="amount">
                    {totalBilled.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="amount">
                    {totalCredits.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="amount">
                    {balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="student-fee-statement grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Panel title="Fee payment report">
              <div className="fee-report-heading mb-4 hidden grid-cols-3 gap-2 print:grid">
                {[
                  ["Fees charged", totalBilled],
                  ["Payments received", totalPaid],
                  ["Balance due", balance],
                ].map(([label, amount]) => (
                  <div key={label} className="border border-ink px-3 py-2 text-center">
                    <div className="text-[8pt] uppercase">{label}</div>
                    <strong>{money(Number(amount))}</strong>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Date",
                        "Term",
                        "Entry",
                        "Debit",
                        "Credit",
                        "Balance",
                        "Payment method / receipt no.",
                        "Description / remarks",
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
                          <td className={tdCls}>
                            {f.entry === "Balance set" ? "Adjust balance" : f.entry}
                          </td>
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
                Total billed: {money(totalBilled)} <span className="mx-2">|</span>
                Total paid: {money(totalPaid)} <span className="mx-2">|</span>
                Balance due: {money(balance)}
              </p>
              <div className="fee-report-signatures mt-10 hidden grid-cols-2 gap-16 print:grid">
                <div className="border-t border-ink pt-2 text-center text-xs">
                  Bursar / authorized signature
                </div>
                <div className="border-t border-ink pt-2 text-center text-xs">
                  Parent / guardian signature
                </div>
              </div>
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
                    <option>Adjust balance</option>
                  </select>
                </label>
                <label className="block text-sm">
                  {entry === "Adjust balance" ? "New balance" : "Amount"}
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
                  <select
                    className={inputCls}
                    value={term.match(/Term [123]/)?.[0] || "Term 1"}
                    onChange={(e) =>
                      setTerm(
                        `${e.target.value} ${term.match(/\d{4}/)?.[0] || new Date().getFullYear()}`,
                      )
                    }
                  >
                    {["Term 1", "Term 2", "Term 3"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <input
                    className={inputCls}
                    type="number"
                    min="2000"
                    max="2200"
                    aria-label="Academic year"
                    value={term.match(/\d{4}/)?.[0] || new Date().getFullYear()}
                    onChange={(e) =>
                      setTerm(`${term.match(/Term [123]/)?.[0] || "Term 1"} ${e.target.value}`)
                    }
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
                  {entry === "Payment" ? "Comment (optional)" : "Reason / comment (optional)"}
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Leave blank to add an automatic note"
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
