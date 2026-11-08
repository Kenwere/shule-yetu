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
  createdAt?: string;
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
  examMarks?: Mark[];
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
  exams?: Exam[];
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
  const [search, setSearch] = useState("");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [cardStudent, setCardStudent] = useState<CardStudent | null>(null);
  const [attendance, setAttendance] = useState<{ present: number; absent: number; late: number }>({
    present: 0,
    absent: 0,
    late: 0,
  });
  const [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState<"student" | "class">("student");
  const [classFilter, setClassFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [termFilter, setTermFilter] = useState("Term 1");
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
        setClassFilter(ee[0]?.className || "");
        setYearFilter(ee[0]?.academicYear || String(new Date().getFullYear()));
        setTermFilter(ee[0]?.term || "Term 1");
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
  useEffect(() => {
    const value = search.trim().toLowerCase();
    if (!value) return;
    const timeout = window.setTimeout(() => {
      const match = students.find((s) =>
        (s.first + " " + s.last + " " + s.adm).toLowerCase().includes(value),
      );
      if (match && match.id !== studentId) setStudentId(match.id);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, students, studentId]);
  const availableClasses = [...new Set(exams.map((exam) => exam.className))].sort();
  const availableYears = [
    ...new Set(
      exams
        .filter((exam) => !classFilter || exam.className === classFilter)
        .map((exam) => exam.academicYear),
    ),
  ]
    .sort()
    .reverse();
  const availableTerms = [
    ...new Set(
      exams
        .filter((exam) => exam.className === classFilter && exam.academicYear === yearFilter)
        .map((exam) => exam.term),
    ),
  ];
  const reportExams = exams.filter(
    (exam) =>
      exam.className === classFilter &&
      exam.academicYear === yearFilter &&
      exam.term === termFilter,
  );
  async function loadClass() {
    setError("");
    setBusy(true);
    try {
      if (!reportExams.length) throw new Error("No exams found for this class, year and term.");
      const results = await Promise.all(
        reportExams.map(async (exam) => {
          const response = await neonApi(`/api/exams/${exam.id}/report`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || `Could not load ${exam.name}.`);
          return { exam, data: data as Report };
        }),
      );
      const base = results[0]?.data;
      if (!base) throw new Error("No report data was returned for the selected class.");
      const merged = new Map<string, Ranked>();
      for (const { exam, data } of results)
        for (const row of data.students) {
          const entry = merged.get(row.id) || { ...row, examMarks: [] };
          entry.examMarks = [
            ...(entry.examMarks || []),
            ...Object.entries(row.marks || {}).map(([subject, score]) => ({
              exam: exam.name,
              term: exam.term,
              academicYear: exam.academicYear,
              subject,
              score: Number(score),
              position: row.position,
              total: row.total,
              classSize: row.classSize,
              schoolName: data.schoolName,
            })),
          ];
          merged.set(row.id, entry);
        }
      setReport({
        ...base,
        name: reportExams.map((exam) => exam.name).join(", "),
        exams: reportExams,
        students: [...merged.values()],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load class report.");
    } finally {
      setBusy(false);
    }
  }
  const selected = students.find((s) => s.id === studentId);
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
            <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
              <div className="w-full max-w-xs">
                <Label text="Class">
                  <select
                    className={inputCls}
                    value={classFilter}
                    onChange={(e) => {
                      setClassFilter(e.target.value);
                      const first = exams.find((exam) => exam.className === e.target.value);
                      if (first) {
                        setYearFilter(first.academicYear);
                        setTermFilter(first.term);
                      }
                    }}
                  >
                    {availableClasses.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
              <div className="w-full max-w-xs">
                <Label text="Academic year">
                  <select
                    className={inputCls}
                    value={yearFilter}
                    onChange={(e) => {
                      setYearFilter(e.target.value);
                      const first = exams.find(
                        (exam) =>
                          exam.className === classFilter && exam.academicYear === e.target.value,
                      );
                      if (first) setTermFilter(first.term);
                    }}
                  >
                    {availableYears.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </select>
                </Label>
              </div>
              <div className="w-full max-w-xs">
                <Label text="Term">
                  <select
                    className={inputCls}
                    value={termFilter}
                    onChange={(e) => setTermFilter(e.target.value)}
                  >
                    {availableTerms.map((term) => (
                      <option key={term}>{term}</option>
                    ))}
                  </select>
                </Label>
              </div>
              <div className="w-full max-w-md text-sm">
                {reportExams.length} exam{reportExams.length === 1 ? "" : "s"}:{" "}
                {reportExams.map((exam) => exam.name).join(", ") || "none found"}
              </div>
              <button
                className={btn()}
                disabled={!reportExams.length || busy}
                onClick={() => void loadClass()}
              >
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
              onRemark={(key, value) => setRemarks((old) => ({ ...old, [key]: value }))}
            />
          )}
          {mode === "class" && report && (
            <div className="space-y-5 print:space-y-0">
              {report.students.map((row) => {
                const roster = students.find((student) => student.id === row.id);
                const name = row.name.split(" ");
                const gender = row.gender || roster?.gender;
                const dob = row.dob || roster?.dob;
                const guardian = row.guardian || roster?.guardian;
                const phone = row.phone || roster?.phone;
                const student: Student = {
                  id: row.id,
                  adm: row.adm,
                  first: row.first || roster?.first || name[0] || "",
                  last: row.last || roster?.last || name.slice(1).join(" "),
                  class: row.class || report.className,
                  stream: row.stream,
                  ...(gender ? { gender } : {}),
                  ...(dob ? { dob } : {}),
                  ...(guardian ? { guardian } : {}),
                  ...(phone ? { phone } : {}),
                };
                const cardDetail: CardStudent = {
                  ...student,
                  schoolName: report.schoolName,
                  ...(report.motto ? { motto: report.motto } : {}),
                  ...(report.schoolEmail ? { schoolEmail: report.schoolEmail } : {}),
                  ...(report.schoolPhone ? { schoolPhone: report.schoolPhone } : {}),
                  ...(report.schoolAddress ? { schoolAddress: report.schoolAddress } : {}),
                  ...(row.photoUrl ? { photoUrl: row.photoUrl } : {}),
                  ...(report.logoUrl ? { logoUrl: report.logoUrl } : {}),
                };
                const cardMarks: Mark[] =
                  row.examMarks ||
                  report.subjects.flatMap((subject) => {
                    const score = row.marks[subject];
                    return score === undefined
                      ? []
                      : [
                          {
                            exam: report.name,
                            term: report.term,
                            academicYear: report.academicYear,
                            subject,
                            score,
                            position: row.position,
                            classSize: row.classSize,
                            total: row.total,
                            schoolName: report.schoolName,
                          },
                        ];
                  });
                return (
                  <StudentReportCard
                    key={row.id}
                    student={student}
                    schoolName={report.schoolName}
                    logoUrl={report.logoUrl || logoUrl}
                    detail={cardDetail}
                    marks={cardMarks}
                    attendance={{
                      present: Number(row.attendancePresent || 0),
                      absent: Number(row.attendanceAbsent || 0),
                      late: Number(row.attendanceLate || 0),
                    }}
                    remarks={remarks}
                    onRemark={(key, value) => setRemarks((old) => ({ ...old, [key]: value }))}
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
