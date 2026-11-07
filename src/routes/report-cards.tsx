import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Label, Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type Student = {
  id: string;
  adm: string;
  first: string;
  last: string;
  class: string;
  stream: string;
};
type Mark = {
  exam: string;
  term: string;
  academicYear: string;
  subject: string;
  score: number;
  position: number;
  total: number;
  schoolName: string;
};
type Exam = {
  id: string;
  name: string;
  className: string;
  stream: string;
  term: string;
  academicYear: string;
};
type Ranked = {
  id: string;
  adm: string;
  name: string;
  position: number;
  total: number;
  marks: Record<string, number>;
};
type Report = {
  schoolName: string;
  name: string;
  className: string;
  stream: string;
  term: string;
  academicYear: string;
  subjects: string[];
  students: Ranked[];
};
export const Route = createFileRoute("/report-cards")({
  head: () => ({
    meta: [{ title: "Report cards - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: ReportCards,
});
const grade = (n: number) => (n >= 80 ? "A" : n >= 65 ? "B" : n >= 50 ? "C" : n >= 40 ? "D" : "E");
function ReportCards() {
  const [role, setRole] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [search, setSearch] = useState("");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState<"student" | "class">("student");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([neonApi("/api/me"), neonApi("/api/students"), neonApi("/api/exams")])
      .then(async ([a, b, c]) => {
        const me = await a.json(),
          ss = await b.json(),
          ee = await c.json();
        setRole(me.role || "");
        setSchoolName(me.school?.school_name || "");
        setLogoUrl(me.school?.logoUrl || "");
        setStudents(ss);
        setExams(ee);
        setStudentId(ss[0]?.id || "");
        setExamId(ee[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (role !== "Admin" || mode !== "student" || !studentId) {
      setMarks([]);
      return;
    }
    void neonApi("/api/students/" + studentId + "/report-card")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load card.");
        setMarks(d);
      })
      .catch((e) => setError(e.message));
  }, [role, mode, studentId]);
  const listed = useMemo(
    () =>
      students.filter((s) =>
        (s.first + " " + s.last + " " + s.adm).toLowerCase().includes(search.toLowerCase()),
      ),
    [students, search],
  );
  async function loadClass() {
    setError("");
    setBusy(true);
    try {
      const r = await neonApi("/api/exams/" + examId + "/report"),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load class report.");
      setReport(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load class report.");
    } finally {
      setBusy(false);
    }
  }
  const selected = students.find((s) => s.id === studentId);
  const grouped = useMemo(() => {
    const map = new Map<string, Mark[]>();
    for (const m of marks) {
      const key = m.term + " " + m.academicYear;
      map.set(key, [...(map.get(key) || []), m]);
    }
    return [...map.entries()];
  }, [marks]);
  return (
    <PortalShell
      eyebrow="Academics"
      title="Report cards"
      actions={
        <button className={btn() + " print:hidden"} onClick={() => window.print()}>
          Print {mode === "class" ? "all cards" : "card"}
        </button>
      }
    >
      {error && (
        <p role="alert" className="mb-4 text-owed">
          {error}
        </p>
      )}
      {role && role !== "Admin" && (
        <Panel title="Administrator access required">
          <p>Only administrators can print ranked report cards.</p>
        </Panel>
      )}
      {role === "Admin" && (
        <>
          <div className="mb-4 flex gap-2 print:hidden">
            <button
              className={btn(mode === "student" ? "good" : "ghost")}
              onClick={() => {
                setMode("student");
                setReport(null);
              }}
            >
              One student
            </button>
            <button
              className={btn(mode === "class" ? "good" : "ghost")}
              onClick={() => {
                setMode("class");
                setMarks([]);
              }}
            >
              Whole exam class/stream
            </button>
          </div>
          {mode === "student" && (
            <div className="mb-4 flex flex-wrap gap-3 print:hidden">
              <div className="w-full max-w-sm">
                <Label text="Find student by name or admission number">
                  <input
                    className={inputCls}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                  />
                </Label>
              </div>
              <div className="w-full max-w-sm">
                <Label text="Student">
                  <select
                    className={inputCls}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  >
                    {listed.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first} {s.last} · {s.adm}
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
            </div>
          )}
          {mode === "class" && (
            <div className="mb-4 flex items-end gap-3 print:hidden">
              <div className="w-full max-w-md">
                <Label text="Exam, class and stream">
                  <select
                    className={inputCls}
                    value={examId}
                    onChange={(e) => setExamId(e.target.value)}
                  >
                    {exams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.className} {e.stream} · {e.term} {e.academicYear}
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
              <button className={btn()} disabled={!examId || busy} onClick={() => void loadClass()}>
                {busy ? "Loading…" : "Load cards"}
              </button>
            </div>
          )}
          {mode === "student" && selected && (
            <article className="report-card break-after-page border border-ink/15 bg-white p-6 text-ink">
              <header className="border-b-2 border-ink pb-4 text-center">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="School logo"
                    className="mx-auto mb-2 h-16 w-16 object-contain"
                  />
                )}
                <h2 className="font-display text-2xl uppercase">
                  {marks[0]?.schoolName || schoolName || "Shule Yetu"}
                </h2>
                <p className="eyebrow">Student report card</p>
              </header>
              <div className="grid gap-2 border-b py-4 sm:grid-cols-2">
                <p>
                  <b>Student:</b> {selected.first} {selected.last}
                </p>
                <p>
                  <b>Admission:</b> {selected.adm}
                </p>
                <p>
                  <b>Class:</b> {selected.class}
                </p>
                <p>
                  <b>Stream:</b> {selected.stream || "—"}
                </p>
              </div>
              {grouped.map(([term, rows]) => (
                <section key={term} className="mt-5">
                  <h3 className="font-display text-lg uppercase">{term}</h3>
                  <p className="mb-2 text-sm">
                    Position: {rows[0]?.position || "—"} · Total:{" "}
                    {Number(rows[0]?.total || 0).toFixed(1)}
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Exam", "Subject", "Approved score", "Grade"].map((h) => (
                          <th className={thCls} key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((m, i) => (
                        <tr key={m.exam + m.subject + i}>
                          <td className={tdCls}>{m.exam}</td>
                          <td className={tdCls}>{m.subject}</td>
                          <td className={tdCls}>{m.score}</td>
                          <td className={tdCls}>{grade(Number(m.score))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 flex gap-2 text-xs">
                    Term total{" "}
                    <div className="h-3 flex-1 bg-ink/10">
                      <div
                        className="h-full bg-gold"
                        style={{
                          width:
                            Math.min(100, rows.reduce((sum, m) => sum + Number(m.score), 0) / 6) +
                            "%",
                        }}
                      />
                    </div>
                    {rows.reduce((sum, m) => sum + Number(m.score), 0).toFixed(0)}
                  </div>
                </section>
              ))}
              <label className="mt-6 block text-sm font-semibold">
                Teacher’s remarks
                <textarea
                  className="mt-2 min-h-16 w-full border p-2 print:hidden"
                  value={remarks[selected.id] || ""}
                  onChange={(e) => setRemarks({ ...remarks, [selected.id]: e.target.value })}
                  placeholder="Enter remarks before printing"
                />
                <div className="hidden min-h-12 border-b print:block">{remarks[selected.id]}</div>
              </label>
            </article>
          )}
          {mode === "class" && report && (
            <div className="space-y-5 print:space-y-0">
              {report.students.map((s) => (
                <article
                  key={s.id}
                  className="report-card break-after-page border border-ink/15 bg-white p-6 text-ink"
                >
                  <header className="border-b-2 border-ink pb-4 text-center">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt="School logo"
                        className="mx-auto mb-2 h-16 w-16 object-contain"
                      />
                    )}
                    <h2 className="font-display text-2xl uppercase">
                      {report.schoolName || "Shule Yetu"}
                    </h2>
                    <p className="eyebrow">Student report card</p>
                  </header>
                  <div className="grid gap-2 border-b py-4 sm:grid-cols-2">
                    <p>
                      <b>Student:</b> {s.name}
                    </p>
                    <p>
                      <b>Admission:</b> {s.adm}
                    </p>
                    <p>
                      <b>Class:</b> {report.className}
                    </p>
                    <p>
                      <b>Stream:</b> {report.stream}
                    </p>
                  </div>
                  <h3 className="mt-5 font-display text-lg uppercase">
                    {report.name} · {report.term} {report.academicYear}
                  </h3>
                  <p className="mb-2 text-sm">
                    Position: {s.position} · Total: {Number(s.total).toFixed(1)}
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Subject", "Approved score", "Grade"].map((h) => (
                          <th className={thCls} key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.subjects
                        .filter((sub) => s.marks[sub] !== undefined)
                        .map((sub) => (
                          <tr key={sub}>
                            <td className={tdCls}>{sub}</td>
                            <td className={tdCls}>{s.marks[sub]}</td>
                            <td className={tdCls}>{grade(Number(s.marks[sub]))}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <label className="mt-6 block text-sm font-semibold">
                    Teacher’s remarks
                    <textarea
                      className="mt-2 min-h-16 w-full border p-2 print:hidden"
                      value={remarks[s.id] || ""}
                      onChange={(e) => setRemarks({ ...remarks, [s.id]: e.target.value })}
                    />
                    <div className="hidden min-h-12 border-b print:block">{remarks[s.id]}</div>
                  </label>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </PortalShell>
  );
}
