import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { inputCls } from "@/components/portal-ui";
import { studentApi, saveStudentToken } from "@/lib/neon-api";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Student = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  className: string;
  stream: string;
  classId: string;
  subjects: string[];
  schoolName: string;
  academicYear: string;
  activeTerm: string;
  mustChangePassword: boolean;
};
type Material = {
  id: string;
  subject: string;
  topic: string | null;
  title: string;
  description: string;
  type: "note" | "video" | "file";
  body: string;
  externalUrl: string;
  createdByName: string;
  createdAt: string;
};
type Progress = {
  materialId: string;
  completedAt: string | null;
  secondsViewed: number;
  downloadCount: number;
};
type Discussion = {
  id: string;
  title: string;
  body: string;
  subject: string;
  authorName: string;
  createdAt: string;
  replyCount: number;
};
type Reply = { id: string; body: string; authorName: string; createdAt: string };
type Assignment = {
  id: string;
  title: string;
  instructions: string;
  subject: string;
  dueAt: string | null;
  maxMarks: number;
  allowResubmit: boolean;
  submissionId: string | null;
  responseText: string | null;
  fileName: string | null;
  submissionStatus: string | null;
  marks: number | null;
  feedback: string | null;
};
type Assessment = {
  id: string;
  title: string;
  instructions: string;
  subject: string;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  questionCount: number;
  maxMarks: number;
  resultsReleased: boolean;
  releasedScore: number | null;
};
type AttemptQuestion = {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  marks: number;
  answer: unknown;
};
type ActiveAttempt = {
  assessment: { id: string; title: string; instructions: string };
  attempt: { id: string; deadline_at: string; status: string };
  questions: AttemptQuestion[];
};
type ReportRow = {
  examId: string;
  exam: string;
  term: string;
  academicYear: string;
  examDate: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  className: string;
  stream: string;
  schoolName: string;
  total: number;
  average: number;
  subjects: Record<string, number>;
  position: number;
  classSize: number;
};

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [{ title: "My learning - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: StudentLearningPage,
});

function StudentLearningPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [discussionSubject, setDiscussionSubject] = useState("");
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionBody, setDiscussionBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [assignmentFiles, setAssignmentFiles] = useState<Record<string, File | null>>({});
  const [active, setActive] = useState<Material | null>(null);
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttempt | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<Record<string, string>>({});
  const [reportCard, setReportCard] = useState<ReportRow[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [
        studentResponse,
        materialResponse,
        progressResponse,
        discussionResponse,
        assignmentResponse,
        assessmentResponse,
        reportResponse,
      ] = await Promise.all([
        studentApi("/api/lms/student/me"),
        studentApi("/api/lms/materials"),
        studentApi("/api/lms/student/progress"),
        studentApi("/api/lms/discussions"),
        studentApi("/api/lms/assignments"),
        studentApi("/api/lms/assessments"),
        studentApi("/api/lms/student/report-card"),
      ]);
      const studentData = (await studentResponse.json()) as Student;
      setStudent(studentData);
      if (!discussionSubject && studentData.subjects?.[0])
        setDiscussionSubject(studentData.subjects[0]);
      setMaterials((await materialResponse.json()) as Material[]);
      setProgress((await progressResponse.json()) as Progress[]);
      setDiscussions((await discussionResponse.json()) as Discussion[]);
      setAssignments((await assignmentResponse.json()) as Assignment[]);
      setAssessments((await assessmentResponse.json()) as Assessment[]);
      setReportCard((await reportResponse.json()) as ReportRow[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your learning dashboard.");
    }
  }, [discussionSubject]);

  async function startAssessment(item: Assessment) {
    setError("");
    try {
      const response = await studentApi(`/api/lms/assessments/${item.id}/start`, {
        method: "POST",
      });
      const result = (await response.json()) as ActiveAttempt & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not start assessment.");
      setActiveAttempt(result);
      setAttemptAnswers(
        Object.fromEntries(result.questions.map((q) => [q.id, String(q.answer ?? "")])),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start assessment.");
    }
  }

  const saveAttemptAnswer = useCallback(
    async (question: AttemptQuestion) => {
      if (!activeAttempt) return;
      try {
        const response = await studentApi(
          `/api/lms/attempts/${activeAttempt.attempt.id}/answers/${question.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer: attemptAnswers[question.id] || "" }),
          },
        );
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Could not save this answer.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save this answer.");
      }
    },
    [activeAttempt, attemptAnswers],
  );

  const submitAttempt = useCallback(async () => {
    if (!activeAttempt) return;
    try {
      await Promise.all(activeAttempt.questions.map((question) => saveAttemptAnswer(question)));
      const response = await studentApi(`/api/lms/attempts/${activeAttempt.attempt.id}/submit`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not submit assessment.");
      setActiveAttempt(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit assessment.");
    }
  }, [activeAttempt, refresh, saveAttemptAnswer]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeAttempt) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= new Date(activeAttempt.attempt.deadline_at).getTime()) {
        window.clearInterval(timer);
        void submitAttempt();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt, submitAttempt]);

  useEffect(() => {
    if (!active || active.type !== "video") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void studentApi(`/api/lms/materials/${active.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secondsViewed: 15 }),
      })
        .then(() => refresh())
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [active, refresh]);

  async function openMaterial(item: Material) {
    setActive(item);
    try {
      await studentApi(`/api/lms/materials/${item.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secondsViewed: 0 }),
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record learning activity.");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await studentApi("/api/lms/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = (await response.json()) as { token: string };
      saveStudentToken(result.token);
      setCurrentPassword("");
      setNewPassword("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your password.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadMaterial(item: Material) {
    try {
      const response = await studentApi(`/api/lms/materials/${item.id}/download`);
      const result = (await response.json()) as { url: string; fileName: string };
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.fileName;
      link.rel = "noreferrer";
      link.click();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download this file.");
    }
  }

  async function startDiscussion(event: FormEvent) {
    event.preventDefault();
    try {
      await studentApi("/api/lms/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: student?.classId,
          subject: discussionSubject,
          title: discussionTitle,
          body: discussionBody,
        }),
      });
      setDiscussionTitle("");
      setDiscussionBody("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post your question.");
    }
  }

  async function openDiscussion(item: Discussion) {
    try {
      const response = await studentApi(`/api/lms/discussions/${item.id}/replies`);
      setReplies((await response.json()) as Reply[]);
      setSelectedDiscussion(item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this discussion.");
    }
  }

  async function replyToDiscussion(event: FormEvent) {
    event.preventDefault();
    if (!selectedDiscussion) return;
    try {
      await studentApi(`/api/lms/discussions/${selectedDiscussion.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody }),
      });
      setReplyBody("");
      await openDiscussion(selectedDiscussion);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post your reply.");
    }
  }

  async function submitAssignment(event: FormEvent, assignment: Assignment) {
    event.preventDefault();
    try {
      const responseText = assignmentDrafts[assignment.id] || assignment.responseText || "";
      const file = assignmentFiles[assignment.id];
      if (!responseText.trim() && !file) throw new Error("Write a response or attach a file.");
      const form = new FormData();
      form.set("responseText", responseText);
      if (file) form.set("file", file);
      await studentApi(`/api/lms/assignments/${assignment.id}/submit`, {
        method: "POST",
        body: form,
      });
      setAssignmentFiles((files) => ({ ...files, [assignment.id]: null }));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your work.");
    }
  }

  async function downloadSubmission(id: string) {
    try {
      const response = await studentApi(`/api/lms/submissions/${id}/download`);
      const result = (await response.json()) as { url: string; fileName: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not download this submission.");
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.fileName;
      link.rel = "noreferrer";
      link.click();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download this submission.");
    }
  }

  const doneCount = progress.filter((item) => item.completedAt).length;
  if (!student && !error)
    return (
      <main className="min-h-screen bg-paper p-10 text-sm text-ink-soft">
        Loading your learning dashboard…
      </main>
    );
  return (
    <main className="min-h-screen bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 bg-card px-5 py-4 sm:px-8">
        <div>
          <p className="eyebrow text-ink-soft">{student?.schoolName || "Shule Yetu"}</p>
          <h1 className="font-display text-2xl uppercase">My learning</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {student?.firstName} {student?.lastName} · {student?.className} {student?.stream}
          </span>
          <button
            className="underline"
            onClick={() => {
              void studentApi("/api/lms/auth/logout", { method: "POST" })
                .catch(() => undefined)
                .finally(() => {
                  saveStudentToken(null);
                  window.location.assign("/student-login");
                });
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-8">
        {error && (
          <p role="alert" className="mb-5 border-l-4 border-owed bg-card p-3 text-sm text-owed">
            {error}{" "}
            <a className="underline" href="/student-login">
              Sign in again
            </a>
          </p>
        )}
        {student?.mustChangePassword && (
          <section className="mb-6 border border-gold bg-card p-5">
            <h2 className="font-semibold">Change your temporary password</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Choose a password with at least 10 characters to continue safely.
            </p>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-3"
              onSubmit={(event) => void changePassword(event)}
            >
              <input
                className={inputCls}
                type="password"
                autoComplete="current-password"
                placeholder="Temporary password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <input
                className={inputCls}
                type="password"
                autoComplete="new-password"
                minLength={10}
                placeholder="New password (10+ characters)"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <button
                className="bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-40"
                disabled={saving}
              >
                {saving ? "Saving…" : "Change password"}
              </button>
            </form>
          </section>
        )}
        <section className="mb-7 grid gap-4 sm:grid-cols-3">
          <div className="border border-ink/10 bg-card p-5">
            <p className="eyebrow text-ink-soft">Academic year</p>
            <p className="mt-2 text-xl">{student?.academicYear || "—"}</p>
          </div>
          <div className="border border-ink/10 bg-card p-5">
            <p className="eyebrow text-ink-soft">Current term</p>
            <p className="mt-2 text-xl">{student?.activeTerm || "—"}</p>
          </div>
          <div className="border border-ink/10 bg-card p-5">
            <p className="eyebrow text-ink-soft">Materials completed</p>
            <p className="mt-2 text-xl">
              {doneCount} / {materials.length}
            </p>
          </div>
        </section>
        <section className="mb-7 border border-ink/10 bg-card p-5 print:border-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="eyebrow text-ink-soft">Student report card</h2>
              <p className="mt-1 font-display text-2xl">Approved exam performance</p>
              <p className="mt-1 text-sm text-ink-soft">
                {student?.firstName} {student?.lastName} · {student?.className}
                {student?.stream ? ` / ${student.stream}` : ""} · {student?.admissionNo}
              </p>
            </div>
            <button
              className="border border-ink/20 px-3 py-2 text-xs font-bold uppercase print:hidden"
              onClick={() => window.print()}
            >
              Print report card
            </button>
          </div>
          {reportCard.length ? (
            <>
              <div
                className="mt-5 h-64 w-full"
                role="img"
                aria-label="Line graph of average marks across approved exams"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportCard} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7ddd8" />
                    <XAxis dataKey="exam" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, "Average"]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload
                          ? `${payload[0].payload.term} ${payload[0].payload.academicYear}`
                          : "Exam"
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="average"
                      name="Average"
                      stroke="#14614c"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#d8a12c" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/15 text-xs uppercase text-ink-soft">
                      <th className="py-2 pr-3">Exam</th>
                      <th className="py-2 pr-3">Term / year</th>
                      <th className="py-2 pr-3">Subject marks</th>
                      <th className="py-2 pr-3">Average</th>
                      <th className="py-2">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportCard.map((row) => (
                      <tr key={row.examId} className="border-b border-ink/10 align-top">
                        <td className="py-3 pr-3 font-semibold">{row.exam}</td>
                        <td className="py-3 pr-3">
                          {row.term} {row.academicYear}
                        </td>
                        <td className="py-3 pr-3">
                          {Object.entries(row.subjects).map(([name, score]) => (
                            <span key={name} className="mr-3 inline-block">
                              {name}: {score}
                            </span>
                          ))}
                        </td>
                        <td className="py-3 pr-3">{Number(row.average).toFixed(1)}%</td>
                        <td className="py-3">
                          {row.position} / {row.classSize}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">
              Your report card will appear when the school approves your exam marks.
            </p>
          )}
        </section>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <div className="border border-ink/10 bg-card p-5">
            <h2 className="eyebrow text-ink-soft">My subjects and resources</h2>
            <div className="mt-4 space-y-3">
              {materials.map((item) => {
                const activity = progress.find((row) => row.materialId === item.id);
                return (
                  <article key={item.id} className="border border-ink/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-ink-soft">
                          {item.subject}
                          {item.topic ? ` · ${item.topic}` : ""} · {item.type}
                        </p>
                      </div>
                      <button
                        className="border border-ink/20 px-3 py-2 text-xs font-bold uppercase"
                        onClick={() => void openMaterial(item)}
                      >
                        {activity?.completedAt ? "Review" : "Open"}
                      </button>
                    </div>
                    {activity && (
                      <p className="mt-2 text-xs text-ink-soft">
                        {activity.completedAt ? "Completed" : "Opened"}
                        {item.type === "video"
                          ? ` · ${Math.floor(activity.secondsViewed / 60)} minutes active`
                          : ""}
                      </p>
                    )}
                  </article>
                );
              })}
              {!materials.length && (
                <p className="py-5 text-sm text-ink-soft">
                  Your teachers have not published any learning materials yet.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <div className="border border-ink/10 bg-card p-5">
              <h2 className="eyebrow text-ink-soft">Learning material</h2>
              {active ? (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">{active.title}</h3>
                  <p className="text-sm text-ink-soft">
                    {active.subject} · by {active.createdByName}
                  </p>
                  {active.type === "note" ? (
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-6">{active.body}</div>
                  ) : active.type === "video" ? (
                    <a
                      className="mt-4 inline-block underline"
                      href={active.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open video in a new tab
                    </a>
                  ) : (
                    <button
                      className="mt-4 border border-ink/20 px-3 py-2 text-xs font-bold uppercase"
                      onClick={() => void downloadMaterial(active)}
                    >
                      Download file
                    </button>
                  )}
                  <button
                    className="mt-5 border border-ink/20 px-3 py-2 text-xs font-bold uppercase"
                    onClick={() =>
                      void studentApi(`/api/lms/materials/${active.id}/activity`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ completed: true }),
                      })
                        .then(refresh)
                        .catch((cause) =>
                          setError(
                            cause instanceof Error ? cause.message : "Could not save progress.",
                          ),
                        )
                    }
                  >
                    Mark complete
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-soft">
                  Select a note or video to open it and record your progress.
                </p>
              )}
            </div>
            <div className="border border-ink/10 bg-card p-5">
              <h2 className="eyebrow text-ink-soft">Need help?</h2>
              <p className="mt-3 text-sm text-ink-soft">
                For password recovery or access issues, contact your school administrator.
              </p>
              <p className="mt-3 text-xs text-ink-soft">Admission number: {student?.admissionNo}</p>
            </div>
          </div>
        </section>
        <section className="mt-7 grid gap-6 lg:grid-cols-2">
          <div className="border border-ink/10 bg-card p-5">
            <h2 className="eyebrow text-ink-soft">Ask a question</h2>
            <form className="mt-4 space-y-3" onSubmit={(event) => void startDiscussion(event)}>
              <label className="block text-sm">
                Subject
                <select
                  className={inputCls}
                  required
                  value={discussionSubject}
                  onChange={(event) => setDiscussionSubject(event.target.value)}
                >
                  <option value="">Choose a subject</option>
                  {student?.subjects?.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Topic
                <input
                  className={inputCls}
                  required
                  maxLength={180}
                  value={discussionTitle}
                  onChange={(event) => setDiscussionTitle(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Question
                <textarea
                  className={inputCls}
                  required
                  maxLength={5000}
                  rows={3}
                  value={discussionBody}
                  onChange={(event) => setDiscussionBody(event.target.value)}
                />
              </label>
              <button
                className="bg-ink px-4 py-2 text-xs font-bold uppercase text-paper"
                disabled={!student?.classId}
              >
                Post question
              </button>
            </form>
            <div className="mt-5 space-y-2">
              {discussions.map((item) => (
                <button
                  key={item.id}
                  className="block w-full border border-ink/10 p-3 text-left hover:bg-ink/5"
                  onClick={() => void openDiscussion(item)}
                >
                  <span className="font-semibold">{item.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {item.subject} · {item.authorName} · {item.replyCount} replies
                  </span>
                </button>
              ))}
              {!discussions.length && (
                <p className="text-sm text-ink-soft">No discussion questions yet.</p>
              )}
            </div>
          </div>
          <div className="border border-ink/10 bg-card p-5">
            <h2 className="eyebrow text-ink-soft">Class discussion</h2>
            {selectedDiscussion ? (
              <>
                <h3 className="mt-4 font-semibold">{selectedDiscussion.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">{selectedDiscussion.body}</p>
                <p className="mt-2 text-xs text-ink-soft">
                  Asked by {selectedDiscussion.authorName}
                </p>
                <div className="mt-4 space-y-3">
                  {replies.map((reply) => (
                    <article key={reply.id} className="border-l-2 border-gold pl-3">
                      <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {reply.authorName} · {new Date(reply.createdAt).toLocaleString()}
                      </p>
                    </article>
                  ))}
                </div>
                <form
                  className="mt-5 space-y-3"
                  onSubmit={(event) => void replyToDiscussion(event)}
                >
                  <label className="block text-sm">
                    Reply
                    <textarea
                      className={inputCls}
                      rows={3}
                      required
                      maxLength={5000}
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                    />
                  </label>
                  <button className="border border-ink/20 px-3 py-2 text-xs font-bold uppercase">
                    Reply
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-4 text-sm text-ink-soft">
                Open a class question to read replies and respond.
              </p>
            )}
          </div>
        </section>
        <section className="mt-7 border border-ink/10 bg-card p-5">
          <h2 className="eyebrow text-ink-soft">Quizzes and online exams</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {assessments.map((assessment) => (
              <article key={assessment.id} className="border border-ink/10 p-4">
                <h3 className="font-semibold">{assessment.title}</h3>
                <p className="mt-1 text-xs text-ink-soft">
                  {assessment.subject} · {assessment.questionCount} questions ·{" "}
                  {assessment.maxMarks} marks · {assessment.durationMinutes} minutes ·{" "}
                  {assessment.attemptsUsed}/{assessment.attemptsAllowed} attempts
                </p>
                {assessment.instructions && (
                  <p className="mt-3 whitespace-pre-wrap text-sm">{assessment.instructions}</p>
                )}
                {assessment.attemptsUsed > 0 && (
                  <p className="mt-2 text-sm text-ink-soft">
                    {assessment.releasedScore !== null && assessment.releasedScore !== undefined
                      ? `${assessment.resultsReleased ? "Final score" : "Automatic score"}: ${assessment.releasedScore} / ${assessment.maxMarks}`
                      : "Your score appears after submission; written answers may need teacher marking."}
                  </p>
                )}
                <button
                  className="mt-3 bg-ink px-3 py-2 text-xs font-bold uppercase text-paper"
                  disabled={assessment.attemptsUsed >= assessment.attemptsAllowed}
                  onClick={() => void startAssessment(assessment)}
                >
                  {assessment.attemptsUsed ? "Continue / retry assessment" : "Start assessment"}
                </button>
              </article>
            ))}
            {!assessments.length && (
              <p className="text-sm text-ink-soft">No online quizzes or exams are available yet.</p>
            )}
          </div>
          {activeAttempt && (
            <div className="mt-5 border-t border-ink/10 pt-4">
              <h3 className="font-semibold">{activeAttempt.assessment.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Deadline: {new Date(activeAttempt.attempt.deadline_at).toLocaleString()}. Answers
                save when you select Save answer.
              </p>
              <div className="mt-3 space-y-4">
                {activeAttempt.questions.map((question, index) => (
                  <div key={question.id} className="border border-ink/10 p-3">
                    <p className="font-medium">
                      {index + 1}. {question.prompt}{" "}
                      <span className="text-xs text-ink-soft">({question.marks} marks)</span>
                    </p>
                    {question.type === "multiple_choice" && Array.isArray(question.options) ? (
                      <div className="mt-2 space-y-1">
                        {question.options.map((option, i) => (
                          <label key={`${question.id}-${i}`} className="flex gap-2 text-sm">
                            <input
                              type="radio"
                              name={question.id}
                              value={option}
                              checked={attemptAnswers[question.id] === option}
                              onChange={(event) =>
                                setAttemptAnswers((values) => ({
                                  ...values,
                                  [question.id]: event.target.value,
                                }))
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        className={`${inputCls} mt-2`}
                        rows={question.type === "essay" ? 5 : 2}
                        value={attemptAnswers[question.id] || ""}
                        onChange={(event) =>
                          setAttemptAnswers((values) => ({
                            ...values,
                            [question.id]: event.target.value,
                          }))
                        }
                      />
                    )}
                    <button
                      className="mt-2 border border-ink/20 px-3 py-1 text-xs font-bold uppercase"
                      onClick={() => void saveAttemptAnswer(question)}
                    >
                      Save answer
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="mt-4 bg-ink px-3 py-2 text-xs font-bold uppercase text-paper"
                onClick={() => void submitAttempt()}
              >
                Submit assessment
              </button>
            </div>
          )}
        </section>
        <section className="mt-7 border border-ink/10 bg-card p-5">
          <h2 className="eyebrow text-ink-soft">Assignments and homework</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {assignments.map((assignment) => (
              <article key={assignment.id} className="border border-ink/10 p-4">
                <h3 className="font-semibold">{assignment.title}</h3>
                <p className="mt-1 text-xs text-ink-soft">
                  {assignment.subject} · {assignment.maxMarks} marks
                  {assignment.dueAt ? ` · due ${new Date(assignment.dueAt).toLocaleString()}` : ""}
                </p>
                {assignment.instructions && (
                  <p className="mt-3 whitespace-pre-wrap text-sm">{assignment.instructions}</p>
                )}
                {assignment.marks !== null && assignment.marks !== undefined && (
                  <p className="mt-3 font-semibold">
                    Mark: {assignment.marks} / {assignment.maxMarks}
                  </p>
                )}
                {assignment.feedback && (
                  <p className="mt-2 text-sm text-ink-soft">
                    Teacher feedback: {assignment.feedback}
                  </p>
                )}
                {assignment.fileName && assignment.submissionId && (
                  <button
                    type="button"
                    className="mt-2 block text-sm underline"
                    onClick={() => void downloadSubmission(assignment.submissionId!)}
                  >
                    Download submitted file: {assignment.fileName}
                  </button>
                )}
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => void submitAssignment(event, assignment)}
                >
                  <label className="block text-sm">
                    Your work
                    <textarea
                      className={inputCls}
                      maxLength={20000}
                      rows={4}
                      value={assignmentDrafts[assignment.id] ?? assignment.responseText ?? ""}
                      onChange={(event) =>
                        setAssignmentDrafts((drafts) => ({
                          ...drafts,
                          [assignment.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    Attach work (PDF, Office, image, ZIP or text; max 20 MB)
                    <input
                      className={`${inputCls} mt-1`}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip,.txt"
                      onChange={(event) =>
                        setAssignmentFiles((files) => ({
                          ...files,
                          [assignment.id]: event.target.files?.[0] || null,
                        }))
                      }
                    />
                  </label>
                  <button
                    className="bg-ink px-3 py-2 text-xs font-bold uppercase text-paper disabled:opacity-40"
                    disabled={Boolean(assignment.submissionId && !assignment.allowResubmit)}
                  >
                    {assignment.submissionStatus === "marked"
                      ? "Resubmit work"
                      : assignment.submissionId
                        ? "Update submission"
                        : "Submit work"}
                  </button>
                  {assignment.submissionStatus && (
                    <span className="ml-3 text-xs text-ink-soft">
                      {assignment.submissionStatus}
                    </span>
                  )}
                </form>
              </article>
            ))}
            {!assignments.length && (
              <p className="text-sm text-ink-soft">No homework has been published yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
