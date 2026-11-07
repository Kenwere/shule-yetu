import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Label, Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { StudentReportCard } from "@/components/StudentReportCard";
import { neonApi } from "@/lib/neon-api";

type Student = {
  id: string;
  adm: string;
  first: string;
  last: string;
  class: string;
  stream: string;
  gender?: string;
  dob?: string;
  guardian?: string;
  phone?: string;
  address?: string;
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
  classSize: number;
};
type CardStudent = Student & {
  schoolName: string;
  motto?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  schoolAddress?: string;
  photoUrl?: string;
  logoUrl?: string;
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
  first: string;
  last: string;
  gender?: string;
  dob?: string;
  guardian?: string;
  phone?: string;
  class: string;
  stream: string;
  photoUrl?: string;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceLate: number;
  position: number;
  classSize: number;
  total: number;
  marks: Record<string, number>;
};
type Report = {
  schoolName: string;
  motto?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  schoolAddress?: string;
  logoUrl?: string;
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
  const [cardStudent, setCardStudent] = useState<CardStudent | null>(null);
  const [attendance, setAttendance] = useState<{ present: number; absent: number; late: number }>({ present: 0, absent: 0, late: 0 });
  const [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState<"student" | "class">("student");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, string>>({});
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
        setMarks(d.marks || []);
        setCardStudent(d.student || null);
        setAttendance({
          present: Number(d.attendance?.present || 0),
          absent: Number(d.attendance?.absent || 0),
          late: Number(d.attendance?.late || 0),
        });
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
            <StudentReportCard
              student={selected}
              schoolName={schoolName}
              logoUrl={logoUrl}
              detail={cardStudent}
              marks={marks}
              attendance={attendance}
              remarks={remarks}
              ratings={ratings}
              onRemark={(key, value) => setRemarks((old) => ({ ...old, [key]: value }))}
              onRating={(key, value) => setRatings((old) => ({ ...old, [key]: value }))}
            />
          )}
          {mode === "class" && report && (
            <div className="space-y-5 print:space-y-0">
              {report.students.map((row) => {
                const roster = students.find((student) => student.id === row.id);
                const name = row.name.split(" ");
                const student: Student = {
                  id: row.id,
                  adm: row.adm,
                  first: row.first || roster?.first || name[0] || "",
                  last: row.last || roster?.last || name.slice(1).join(" "),
                  class: row.class || report.className,
                  stream: row.stream,
                  gender: row.gender || roster?.gender,
                  dob: row.dob || roster?.dob,
                  guardian: row.guardian || roster?.guardian,
                  phone: row.phone || roster?.phone,
                };
                const cardDetail: CardStudent = {
                  ...student,
                  schoolName: report.schoolName,
                  motto: report.motto,
                  schoolEmail: report.schoolEmail,
                  schoolPhone: report.schoolPhone,
                  schoolAddress: report.schoolAddress,
                  photoUrl: row.photoUrl,
                  logoUrl: report.logoUrl,
                };
                const cardMarks: Mark[] = report.subjects.flatMap((subject) => {
                  const score = row.marks[subject];
                  return score === undefined ? [] : [{
                    exam: report.name,
                    term: report.term,
                    academicYear: report.academicYear,
                    subject,
                    score,
                    position: row.position,
                    classSize: row.classSize,
                    total: row.total,
                    schoolName: report.schoolName,
                  }];
                });
                return (
                  <StudentReportCard
                    key={row.id}
                    student={student}
                    schoolName={report.schoolName}
                    logoUrl={report.logoUrl || logoUrl}
                    detail={cardDetail}
                    marks={cardMarks}
                    attendance={{ present: Number(row.attendancePresent || 0), absent: Number(row.attendanceAbsent || 0), late: Number(row.attendanceLate || 0) }}
                    remarks={remarks}
                    ratings={ratings}
                    onRemark={(key, value) => setRemarks((old) => ({ ...old, [key]: value }))}
                    onRating={(key, value) => setRatings((old) => ({ ...old, [key]: value }))}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </PortalShell>
  );
}
