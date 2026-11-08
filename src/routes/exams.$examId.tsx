import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type Exam = {
  id: string;
  name: string;
  className: string;
  stream: string;
  term: string;
  academicYear: string;
  startsOn: string;
  endsOn: string;
  subjects: string[];
  pending: number;
};
type Mark = {
  id: string;
  studentId: string;
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

export const Route = createFileRoute("/exams/$examId")({
  head: () => ({
    meta: [{ title: "Exam marks - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: ExamMarksPage,
});

function ExamMarksPage() {
  const { examId } = useParams({ from: "/exams/$examId" });
  const [exam, setExam] = useState<Exam | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirtyMarks, setDirtyMarks] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [examResponse, marksResponse, meResponse] = await Promise.all([
        neonApi("/api/exams"),
        neonApi(`/api/exams/${examId}/marks`),
        neonApi("/api/me"),
      ]);
      for (const response of [examResponse, marksResponse, meResponse]) {
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail.error || "Your account could not load this exam.");
        }
      }
      const [examRows, markRows, me] = await Promise.all([
        examResponse.json() as Promise<Exam[]>,
        marksResponse.json() as Promise<Mark[]>,
        meResponse.json(),
      ]);
      const found = examRows.find((item) => item.id === examId);
      if (!found)
        throw new Error("This exam is unavailable or your account is not assigned to its class.");
      setExam(found);
      setMarks(markRows);
      setDirtyMarks([]);
      setRole(me.role || "");
      setSubjects(
        me.role === "Admin"
          ? found.subjects || []
          : [...new Set(markRows.map((item) => item.subject))],
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load exam marks.");
    } finally {
      setLoading(false);
    }
  }, [examId]);
  useEffect(() => {
    void load();
  }, [load]);

  const students = useMemo(() => {
    const groups = new Map<
      string,
      { studentId: string; student: string; adm: string; marks: Map<string, Mark> }
    >();
    for (const mark of marks) {
      let row = groups.get(mark.studentId);
      if (!row) {
        row = { studentId: mark.studentId, student: mark.student, adm: mark.adm, marks: new Map() };
        groups.set(mark.studentId, row);
      }
      row.marks.set(mark.subject, mark);
    }
    return [...groups.values()];
  }, [marks]);

  async function update(mark: Mark, patch: Partial<Mark>) {
    setSaving(mark.id);
    setError("");
    setMessage("");
    try {
      const response = await neonApi(`/api/marks/${mark.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: patch.score ?? mark.score,
          status: patch.status ?? mark.status,
        }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Could not save this mark.");
      setMarks((old) => old.map((item) => (item.id === mark.id ? saved : item)));
      setMessage(`${mark.student} · ${mark.subject} saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this mark.");
    } finally {
      setSaving("");
    }
  }

  async function saveAllMarks() {
    const changed = marks.filter((mark) => dirtyMarks.includes(mark.id));
    if (!changed.length) return;
    setSaving("all");
    setError("");
    setMessage("");
    try {
      const response = await neonApi(`/api/exams/${examId}/marks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks: changed.map(({ id, score }) => ({ id, score })) }),
      });
      const result = (await response.json()) as { saved?: Mark[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save marks.");
      const saved = result.saved || [];
      setMarks((old) => old.map((mark) => saved.find((row) => row.id === mark.id) || mark));
      setDirtyMarks([]);
      setMessage(`${saved.length} mark${saved.length === 1 ? "" : "s"} saved for approval.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save marks.");
    } finally {
      setSaving("");
    }
  }

  async function approveAll() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await neonApi(`/api/exams/${examId}/approve-pending`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not approve marks.");
      setMessage(`${data.approved} pending marks approved.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve marks.");
    } finally {
      setBusy(false);
    }
  }

  async function loadReport() {
    setError("");
    setReport(null);
    try {
      const response = await neonApi(`/api/exams/${examId}/report`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load exam report.");
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load exam report.");
    }
  }

  return (
    <PortalShell
      eyebrow="Academics"
      title={exam?.name || "Exam marks"}
      actions={
        <Link to="/exams" className={btn("ghost")}>
          Back to exams
        </Link>
      }
    >
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
      {loading && (
        <p role="status" className="py-8 text-center text-ink-soft">
          Loading exam and student marks…
        </p>
      )}
      {exam && !loading && (
        <>
          <Panel title="Exam details" className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <p>
                <strong>{exam.className}</strong> ·{" "}
                {exam.stream === "*" ? "All streams" : exam.stream} · {exam.term}{" "}
                {exam.academicYear}
                <br />
                <span className="text-ink-soft">
                  {exam.startsOn} – {exam.endsOn}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {role === "Admin" && (
                  <>
                    <button
                      className={btn("good")}
                      disabled={busy || Number(exam.pending) === 0}
                      onClick={() => void approveAll()}
                    >
                      {busy ? "Approving…" : "Approve all pending"}
                    </button>
                    <button className={btn("ghost")} onClick={() => void loadReport()}>
                      View report
                    </button>
                  </>
                )}
                <button className={btn("ghost")} onClick={() => void load()}>
                  Reload marks
                </button>
              </div>
            </div>
          </Panel>
          <Panel title="Enter marks by subject">
            {subjects.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  Subjects run horizontally. Teacher marks are submitted for admin approval.
                </p>
                <button
                  type="button"
                  className={btn("primary")}
                  disabled={!dirtyMarks.length || saving === "all"}
                  onClick={() => void saveAllMarks()}
                >
                  {saving === "all"
                    ? "Saving marks…"
                    : `Save all marks${dirtyMarks.length ? ` (${dirtyMarks.length})` : ""}`}
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Student</th>
                    <th className={thCls}>Admission</th>
                    {subjects.map((subject) => (
                      <th key={subject} className={thCls}>
                        {subject}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.studentId}>
                      <td className={`${tdCls} whitespace-nowrap font-semibold`}>
                        {student.student}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>{student.adm}</td>
                      {subjects.map((subject) => {
                        const mark = student.marks.get(subject);
                        return (
                          <td key={subject} className={`${tdCls} min-w-44`}>
                            {mark ? (
                              <div className="flex min-w-40 flex-col gap-1">
                                <input
                                  aria-label={`${student.student} ${subject} score`}
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  className={inputCls}
                                  value={mark.score}
                                  onChange={(event) => {
                                    setMarks((old) =>
                                      old.map((item) =>
                                        item.id === mark.id
                                          ? { ...item, score: Number(event.target.value) }
                                          : item,
                                      ),
                                    );
                                    setDirtyMarks((old) =>
                                      old.includes(mark.id) ? old : [...old, mark.id],
                                    );
                                  }}
                                />
                                <span className="text-xs text-ink-soft">{mark.status}</span>
                                <div className="flex flex-wrap gap-1">
                                  {role === "Admin" && mark.status !== "Approved" && (
                                    <button
                                      className={btn("good")}
                                      disabled={saving === mark.id}
                                      onClick={() => void update(mark, { status: "Approved" })}
                                    >
                                      Approve
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-ink-soft">No mark row</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!students.length && (
                    <tr>
                      <td
                        colSpan={Math.max(2, subjects.length + 2)}
                        className="px-4 py-8 text-center text-ink-soft"
                      >
                        No mark rows are available. Confirm active students and subjects are
                        configured for this exam’s class.
                      </td>
                    </tr>
                  )}
                  {!subjects.length && students.length > 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-ink-soft">
                        No subjects are configured for this class. Add the subjects in Classes &
                        Fees, then reload.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          {report && (
            <Panel title={`${report.schoolName} · ${report.name} ranked report`} className="mt-6">
              <div className="mb-4 flex items-center justify-between print:hidden">
                <p className="text-sm">
                  {report.className} · {report.stream} · {report.term} {report.academicYear}
                </p>
                <button className={btn()} onClick={() => window.print()}>
                  Print report
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Position",
                        "Student",
                        "Admission",
                        "Stream",
                        ...report.subjects,
                        "Total",
                      ].map((label) => (
                        <th key={label} className={thCls}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.students.map((row) => (
                      <tr key={row.id}>
                        <td className={tdCls}>{row.position}</td>
                        <td className={tdCls}>{row.name}</td>
                        <td className={tdCls}>{row.adm}</td>
                        <td className={tdCls}>{row.stream}</td>
                        {report.subjects.map((subject) => (
                          <td key={subject} className={tdCls}>
                            {row.marks[subject] ?? "-"}
                          </td>
                        ))}
                        <td className={tdCls}>{Number(row.total).toFixed(1)}</td>
                      </tr>
                    ))}
                    {!report.students.length && (
                      <tr>
                        <td
                          colSpan={report.subjects.length + 5}
                          className="px-4 py-8 text-center text-ink-soft"
                        >
                          No active students found for this exam.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </PortalShell>
  );
}
