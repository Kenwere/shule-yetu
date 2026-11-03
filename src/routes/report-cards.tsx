import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Label, Panel, PrintButton, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type Student = { id: string; adm: string; first: string; last: string; class: string; stream: string };
type Mark = { exam: string; term: string; subject: string; score: number };
export const Route = createFileRoute("/report-cards")({
  head: () => ({ meta: [{ title: "Report cards — Shule Yetu" }, { name: "robots", content: "noindex" }] }),
  component: ReportCards,
});
const grade = (s: number) => (s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : s >= 40 ? "D" : "E");
function ReportCards() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void neonApi("/api/students").then((r) => r.json()).then((rows: Student[]) => { setStudents(rows); setStudentId(rows[0]?.id ?? ""); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (!studentId) { setMarks([]); return; } void neonApi(`/api/students/${studentId}/report-card`).then((r) => r.json()).then((rows: Mark[]) => setMarks(rows)).catch((e) => setError(e.message)); }, [studentId]);
  const student = students.find((s) => s.id === studentId);
  return <PortalShell eyebrow="Academics" title="Report cards" actions={<PrintButton label="Print card" />}>
    {error && <p role="alert" className="mb-4 text-owed">{error}</p>}
    {!students.length ? <Panel title="No student records"><p>Add students and approved exam marks to create report cards.</p></Panel> : <>
      <div className="mb-4 max-w-xs print:hidden"><Label text="Student"><select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.first} {s.last} · {s.adm}</option>)}</select></Label></div>
      {student && <Panel><div className="flex items-end justify-between border-b border-ink/10 pb-4"><div><div className="font-display text-3xl uppercase">Report card</div><div className="eyebrow text-ink-soft">Approved marks</div></div><div className="text-right text-sm"><b>{student.first} {student.last}</b><br/>{student.adm} · {student.class} {student.stream}</div></div>
        {!marks.length ? <p className="py-8 text-sm text-ink-soft">No approved marks have been recorded for this student.</p> : <table className="mt-4 w-full text-sm"><thead><tr>{["Exam", "Term", "Subject", "Score", "Grade"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead><tbody>{marks.map((m, i) => <tr key={`${m.exam}-${m.subject}-${i}`}><td className={tdCls}>{m.exam}</td><td className={tdCls}>{m.term}</td><td className={tdCls}>{m.subject}</td><td className={tdCls}>{m.score}</td><td className={tdCls}>{grade(m.score)}</td></tr>)}</tbody></table>}
      </Panel>}
    </>}
  </PortalShell>;
}

