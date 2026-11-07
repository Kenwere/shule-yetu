import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";
type ClassRow = { name: string; streams: string[]; subjects: string[] };
type Exam = {
  id: string;
  name: string;
  className: string;
  stream: string;
  term: string;
  academicYear: string;
  startsOn: string;
  endsOn: string;
  pending: number;
};
type Mark = {
  id: string;
  student: string;
  adm: string;
  subject: string;
  score: number;
  status: "Pending" | "Approved" | "Denied";
};
type Report = {
  schoolName: string;
  name: string;
  className: string;
  stream: string;
  term: string;
  academicYear: string;
  subjects: string[];
  students: {
    id: string;
    adm: string;
    name: string;
    stream: string;
    total: number;
    position: number;
    marks: Record<string, number>;
  }[];
};
export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [{ title: "Exams and marks - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: ExamsPage,
});
function ExamsPage() {
  const [role, setRole] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [examId, setExamId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [printCards, setPrintCards] = useState(false);
  const [marksLoading, setMarksLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingMark, setSavingMark] = useState("");
  const marksPanelRef = useRef<HTMLElement | null>(null);
  const reportPanelRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    className: "",
    stream: "*",
    term: "Term 1",
    academicYear: String(new Date().getFullYear()),
    startsOn: "",
    endsOn: "",
  });
  async function loadExams() {
    try {
      const [c, e, me] = await Promise.all([
        neonApi("/api/classes"),
        neonApi("/api/exams"),
        neonApi("/api/me"),
      ]);
      const cs = await c.json();
      const es = await e.json();
      const user = await me.json();
      setClasses(cs);
      setExams(es);
      setRole(user.role || "");
      if (user.school?.academicYear)
        setDraft((d) => ({
          ...d,
          academicYear: user.school.academicYear,
          term: user.school.activeTerm || d.term,
        }));
      setExamId((id) => (es.some((x: Exam) => x.id === id) ? id : es[0]?.id || ""));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load exams.");
    }
  }
  useEffect(() => {
    void loadExams();
  }, []);
  useEffect(() => {
    if (!examId) {
      setMarks([]);
      setMarksLoading(false);
      return;
    }
    let current = true;
    setMarks([]);
    setMarksLoading(true);
    setError("");
    void neonApi(`/api/exams/${examId}/marks`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load marks.");
        if (current) setMarks(d);
      })
      .catch((e) => {
        if (current) setError(e instanceof Error ? e.message : "Could not load marks.");
      })
      .finally(() => {
        if (current) setMarksLoading(false);
      });
    return () => { current = false; };
  }, [examId]);
  useEffect(() => {
    if (examId)
      requestAnimationFrame(() =>
        marksPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  }, [examId]);
  useEffect(() => {
    if (report)
      requestAnimationFrame(() =>
        reportPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  }, [report]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await neonApi("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not create exam.");
      if (typeof d.id !== "string")
        throw new Error("Exam was saved, but the server did not return its ID.");
      setExamId(d.id);
      setDraft({ ...draft, name: "" });
      await loadExams();
      setExamId(d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create exam.");
    }
  }
  async function update(mark: Mark, patch: Partial<Mark>) {
    setSavingMark(mark.id);
    try {
      const r = await neonApi(`/api/marks/${mark.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: patch.score ?? mark.score,
          status: patch.status ?? mark.status,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save mark.");
      setMarks((rows) => rows.map((x) => (x.id === mark.id ? d : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save mark.");
    } finally {
      setSavingMark("");
    }
  }
  async function approveAll() {
    if (!examId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await neonApi(`/api/exams/${examId}/approve-pending`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not approve marks.");
      setMessage(`${d.approved} pending marks approved.`);
      const refreshed = await neonApi(`/api/exams/${examId}/marks`);
      setMarks(await refreshed.json());
      await loadExams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve marks.");
    } finally {
      setBusy(false);
    }
  }
  async function viewReport(id: string) {
    setError("");
    setMessage("");
    setReport(null);
    setReportLoading(true);
    try {
      const r = await neonApi(`/api/exams/${id}/report`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load ranked report.");
      setReport(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ranked report.");
    } finally {
      setReportLoading(false);
    }
  }
  function openExam(id: string) {
    setError("");
    setMessage("");
    setReport(null);
    setExamId(id);
    requestAnimationFrame(() =>
      marksPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  async function deleteExam(exam: Exam) {
    if (!window.confirm(`Delete “${exam.name}” and all marks entered for it?`)) return;
    setError("");
    setMessage("");
    try {
      await neonApi(`/api/exams/${exam.id}`, { method: "DELETE" });
      if (examId === exam.id) setExamId("");
      if (report?.name === exam.name) setReport(null);
      setMessage(`“${exam.name}” and its marks were deleted.`);
      await loadExams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete exam.");
    }
  }
  function printExamCards() {
    setPrintCards(true);
    window.addEventListener("afterprint", () => setPrintCards(false), { once: true });
    window.setTimeout(() => window.print(), 50);
  }
  const selected = exams.find((x) => x.id === examId);
  return (
    <PortalShell
      eyebrow="Academics"
      title="Exams and marks"
      actions={<button className={btn("ghost")} onClick={() => void loadExams()}>Reload exams</button>}
    >
      {error && (
        <p role="alert" className="mb-4 text-owed">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 text-collected">
          {message}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="School exams" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Exam", "Class", "Term", "Academic year", "Dates", "Pending", ""].map((x) => (
                    <th key={x} className={thCls}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exams.map((x) => (
                  <tr key={x.id}>
                    <td className={tdCls}>{x.name}</td>
                    <td className={tdCls}>
                      {x.className} {x.stream === "*" ? "All streams" : x.stream}
                    </td>
                    <td className={tdCls}>{x.term}</td>
                    <td className={tdCls}>{x.academicYear}</td>
                    <td className={tdCls}>
                      {x.startsOn} - {x.endsOn}
                    </td>
                    <td className={tdCls}>{x.pending}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      <button className={btn("ghost")} onClick={() => openExam(x.id)}>
                        Open
                      </button>{" "}
                      {role === "Admin" && (
                        <>
                          <button className={btn("ghost")} disabled={reportLoading} onClick={() => void viewReport(x.id)}>
                            {reportLoading ? "Loading report…" : "View report"}
                          </button>{" "}
                          <button className={btn("bad")} onClick={() => void deleteExam(x)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!exams.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                      No exams are available for your account. Teachers may only see exams for their assigned class and stream.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        {role === "Admin" && (
          <Panel title="Create exam">
            <form onSubmit={create} className="space-y-3">
              <label className="block text-sm">
                Exam name
                <input
                  required
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Class
                <select
                  required
                  className={inputCls}
                  value={draft.className}
                  onChange={(e) => {
                    const c = classes.find((x) => x.name === e.target.value);
                    setDraft({ ...draft, className: e.target.value, stream: "*" });
                  }}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Stream
                <select
                  required
                  className={inputCls}
                  value={draft.stream}
                  onChange={(e) => setDraft({ ...draft, stream: e.target.value })}
                >
                  <option value="*">All streams</option>
                  {(classes.find((c) => c.name === draft.className)?.streams || []).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Term
                <select
                  required
                  className={inputCls}
                  value={draft.term}
                  onChange={(e) => setDraft({ ...draft, term: e.target.value })}
                >
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </label>
              <label className="block text-sm">
                Academic year
                <input
                  required
                  pattern="20[0-9]{2}"
                  className={inputCls}
                  value={draft.academicYear}
                  onChange={(e) => setDraft({ ...draft, academicYear: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  Start
                  <input
                    required
                    type="date"
                    className={inputCls}
                    value={draft.startsOn}
                    onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  End
                  <input
                    required
                    type="date"
                    className={inputCls}
                    value={draft.endsOn}
                    onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })}
                  />
                </label>
              </div>
              <button className={btn()}>Create exam</button>
            </form>
          </Panel>
        )}
      </div>
      {selected && (
        <section ref={marksPanelRef} tabIndex={-1} aria-label={`Marks for ${selected.name}`}>
          <Panel title={`Marks - ${selected.name}`} className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-ink-soft">
                {selected.className} {selected.stream === "*" ? "All streams" : selected.stream} -{" "}
                {selected.term} {selected.academicYear}
              </span>
              {role === "Admin" && Number(selected.pending) > 0 && (
                <button className={btn("good")} disabled={busy} onClick={() => void approveAll()}>
                  {busy ? "Approving..." : "Approve all pending"}
                </button>
              )}
            </div>
            {marksLoading && <p role="status" className="mb-3 text-sm text-ink-soft">Loading students and marks…</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Student", "Admission", "Subject", "Score", "Status", "Actions"].map((x) => (
                      <th key={x} className={thCls}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marks.map((m) => (
                    <tr key={m.id}>
                      <td className={tdCls}>{m.student}</td>
                      <td className={tdCls}>{m.adm}</td>
                      <td className={tdCls}>{m.subject}</td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-20 border border-input px-2 py-1"
                          value={m.score}
                          onChange={(e) =>
                            setMarks((rows) => rows.map((row) => row.id === m.id ? { ...row, score: Number(e.target.value) } : row))
                          }
                        />
                      </td>
                      <td className={tdCls}>{m.status}</td>
                      <td className={tdCls}>
                        {role === "Admin" ? (
                          <>
                            <button
                              className={btn("ghost")}
                              disabled={savingMark === m.id || !Number.isFinite(Number(m.score))}
                              onClick={() => void update(m, { status: "Pending" })}
                            >
                              {savingMark === m.id ? "Saving…" : "Save score"}
                            </button>{" "}
                            <button
                              className={btn("good")}
                              disabled={savingMark === m.id}
                              onClick={() => void update(m, { status: "Approved" })}
                            >
                              Approve
                            </button>{" "}
                            <button
                              className={btn("bad")}
                              disabled={savingMark === m.id}
                              onClick={() => void update(m, { status: "Denied" })}
                            >
                              Deny
                            </button>
                          </>
                        ) : (
                          <button className={btn("ghost")} disabled={savingMark === m.id} onClick={() => void update(m, { status: "Pending" })}>
                            {savingMark === m.id ? "Saving…" : "Save score for approval"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!marksLoading && !marks.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                        No marks were created for this exam. Check that students are active and match its class and stream; teachers also need an assignment for the class, stream, and subject.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      )}
      {report && (
        <section ref={reportPanelRef} tabIndex={-1} aria-label={`${report.name} report`}>
        <Panel title={`${report.schoolName} - ${report.name} ranked report`} className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="text-sm">
              {report.className} {report.stream} - {report.term} {report.academicYear}
            </p>
            <div className="flex gap-2">
              <button className={btn("ghost")} onClick={() => window.print()}>
                Print ranked report
              </button>
              <button className={btn()} onClick={printExamCards}>
                Print report cards
              </button>
            </div>
          </div>
          <div className={`${printCards ? "block print:block" : "hidden print:hidden"} mb-4`}>
            {report.students.map((s) => (
              <article key={s.id} className="mb-8 border border-ink/20 p-6 print:break-after-page">
                <h2 className="font-display text-2xl">{report.schoolName}</h2>
                <h3 className="mt-2 font-semibold">{report.name} report card</h3>
                <p>{s.name} · {s.adm} · {report.className} {s.stream}</p>
                <p>{report.term} {report.academicYear} · Position {s.position}</p>
                <table className="mt-4 w-full text-sm">
                  <thead><tr><th className={thCls}>Subject</th><th className={thCls}>Score</th></tr></thead>
                  <tbody>{report.subjects.map((subject) => (
                    <tr key={subject}><td className={tdCls}>{subject}</td><td className={tdCls}>{s.marks[subject] ?? "-"}</td></tr>
                  ))}</tbody>
                  <tfoot><tr><th className={tdCls}>Total</th><th className={tdCls}>{Number(s.total).toFixed(1)}</th></tr></tfoot>
                </table>
              </article>
            ))}
          </div>
          <div className={`${printCards ? "hidden print:hidden" : "hidden print:block"} mb-4`}>
            <p>
              {report.className} {report.stream} - {report.term} {report.academicYear}
            </p>
          </div>
          <div className={`${printCards ? "hidden print:hidden" : "overflow-x-auto"}`}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Position", "Student", "Admission", "Stream", ...report.subjects, "Total"].map(
                    (x) => (
                      <th key={x} className={thCls}>
                        {x}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {report.students.map((s) => (
                  <tr key={s.id}>
                    <td className={tdCls}>{s.position}</td>
                    <td className={tdCls}>{s.name}</td>
                    <td className={tdCls}>{s.adm}</td>
                    <td className={tdCls}>{s.stream}</td>
                    {report.subjects.map((subject) => (
                      <td key={subject} className={tdCls}>
                        {s.marks[subject] ?? "-"}
                      </td>
                    ))}
                    <td className={`${tdCls} font-semibold`}>{Number(s.total).toFixed(1)}</td>
                  </tr>
                ))}
                {!report.students.length && (
                  <tr>
                    <td
                      colSpan={report.subjects.length + 5}
                      className="px-4 py-8 text-center text-ink-soft"
                    >
                      No active students are in this exam class and stream.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        </section>
      )}
    </PortalShell>
  );
}
