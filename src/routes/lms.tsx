import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Flash, Panel, btn, inputCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type SchoolClass = { id: string; name: string; streams: string[]; subjects: string[] };
type Topic = { id: string; classId: string; subject: string; title: string };
type Material = {
  id: string;
  classId: string;
  className: string;
  subject: string;
  stream: string;
  topic: string | null;
  title: string;
  description: string;
  type: "note" | "video" | "file";
  body: string;
  externalUrl: string;
  status: "draft" | "published";
  createdByName: string;
  createdAt: string;
};
type Account = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  className: string;
  stream: string;
  accountActive: boolean;
  mustChangePassword: boolean;
};
type Credential = {
  admissionNo: string;
  firstName: string;
  lastName: string;
  className: string;
  stream: string;
  password: string;
};
type Question = {
  id: string;
  className: string;
  subject: string;
  prompt: string;
  type: string;
  marks: number;
};
type Assessment = {
  id: string;
  classId: string;
  className: string;
  subject: string;
  stream: string;
  title: string;
  instructions: string;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number;
  attemptsAllowed: number;
  resultsReleased: boolean;
  status: string;
  questionCount: number;
  maxMarks: number;
  attemptCount: number;
  openAttemptCount: number;
  pendingReviewCount: number;
};
type AssessmentReviewQuestion = {
  id: string;
  type: string;
  prompt: string;
  answer: unknown;
  answerKey: unknown;
  explanation: string;
  marks: number;
  marksAwarded: number | null;
  feedback: string;
};
type AssessmentAttempt = {
  id: string;
  attemptNumber: number;
  status: string;
  score: number | null;
  submittedAt: string | null;
  admissionNo: string;
  studentName: string;
  questions: AssessmentReviewQuestion[];
};
type Discussion = {
  id: string;
  className: string;
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
  classId: string;
  className: string;
  subject: string;
  stream: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  maxMarks: number;
  status: string;
  submissionId: string | null;
  responseText: string | null;
  submissionStatus: string | null;
  marks: number | null;
  feedback: string | null;
};
type Submission = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  responseText: string;
  fileName: string;
  status: string;
  marks: number | null;
  feedback: string;
};

export const Route = createFileRoute("/lms")({
  head: () => ({
    meta: [{ title: "Learning - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: LearningPage,
});

function LearningPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [stream, setStream] = useState("*");
  const [topicId, setTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"note" | "video" | "file">("note");
  const [file, setFile] = useState<File | null>(null);
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [term, setTerm] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManageLms, setCanManageLms] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [parentEmail, setParentEmail] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentCredential, setParentCredential] = useState<{
    email: string;
    temporaryPassword: string;
    students: { firstName: string; lastName: string; className: string }[];
  } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentInstructions, setAssessmentInstructions] = useState("");
  const [assessmentDuration, setAssessmentDuration] = useState("30");
  const [assessmentAttempts, setAssessmentAttempts] = useState("1");
  const [assessmentStart, setAssessmentStart] = useState("");
  const [assessmentEnd, setAssessmentEnd] = useState("");
  const [assessmentStatus, setAssessmentStatus] = useState<"draft" | "published">("draft");
  const [activeReviewAssessment, setActiveReviewAssessment] = useState<Assessment | null>(null);
  const [reviewAttempts, setReviewAttempts] = useState<AssessmentAttempt[]>([]);
  const [reviewMarks, setReviewMarks] = useState<Record<string, string>>({});
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});
  const [questionType, setQuestionType] = useState("multiple_choice");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [questionMarks, setQuestionMarks] = useState("1");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [activeDiscussion, setActiveDiscussion] = useState<Discussion | null>(null);
  const [discussionReplies, setDiscussionReplies] = useState<Reply[]>([]);
  const [discussionReply, setDiscussionReply] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [assignmentDue, setAssignmentDue] = useState("");
  const [assignmentMarks, setAssignmentMarks] = useState("100");
  const [allowLate, setAllowLate] = useState(false);
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [markValues, setMarkValues] = useState<Record<string, string>>({});
  const [feedbackValues, setFeedbackValues] = useState<Record<string, string>>({});

  const currentClass = classes.find((row) => row.id === classId);
  const visibleAccounts = accounts.filter(
    (row) => !currentClass || row.className === currentClass.name,
  );
  const classTopics = useMemo(
    () => topics.filter((topic) => topic.classId === classId && topic.subject === subject),
    [topics, classId, subject],
  );
  const load = useCallback(async () => {
    try {
      const [classResponse, topicResponse, materialResponse] = await Promise.all([
        neonApi("/api/classes"),
        neonApi("/api/lms/topics"),
        neonApi("/api/lms/materials"),
      ]);
      const meResponse = await neonApi("/api/me");
      const discussionResponse = await neonApi("/api/lms/discussions");
      const assignmentResponse = await neonApi("/api/lms/assignments");
      const assessmentResponse = await neonApi("/api/lms/assessments");
      const classRows = (await classResponse.json()) as SchoolClass[];
      const me = (await meResponse.json()) as {
        role: string;
        permissions?: string[];
        school?: { activeTerm?: string; academicYear?: string };
      };
      setIsAdmin(me.role === "Admin");
      setCanManageLms(me.role === "Admin" || !!me.permissions?.includes("manage_lms"));
      if (!term && me.school?.activeTerm) setTerm(me.school.activeTerm);
      if (!academicYear && me.school?.academicYear) setAcademicYear(me.school.academicYear);
      if (me.role !== "Student") {
        const questionResponse = await neonApi("/api/lms/questions");
        setQuestions((await questionResponse.json()) as Question[]);
      }
      setClasses(classRows);
      setTopics((await topicResponse.json()) as Topic[]);
      setMaterials((await materialResponse.json()) as Material[]);
      setDiscussions((await discussionResponse.json()) as Discussion[]);
      setAssignments((await assignmentResponse.json()) as Assignment[]);
      setAssessments((await assessmentResponse.json()) as Assessment[]);
      if (me.role === "Admin") {
        const accountResponse = await neonApi(
          `/api/lms/accounts${classId ? `?class=${encodeURIComponent(classRows.find((row) => row.id === classId)?.name || "")}` : ""}`,
        );
        setAccounts((await accountResponse.json()) as Account[]);
      }
      if (!classId && classRows[0]) {
        setClassId(classRows[0].id);
        setSubject(classRows[0].subjects?.[0] || "");
        setStream(me.role === "Admin" ? "*" : classRows[0].streams?.[0] || "");
      }
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load learning content.");
    }
  }, [academicYear, classId, term]);
  useEffect(() => {
    void load();
  }, [load]);

  async function removeLms(path: string, title: string) {
    if (
      !window.confirm(
        `Delete “${title}”? Student records already submitted or attempted will be preserved.`,
      )
    )
      return;
    setError("");
    try {
      const response = await neonApi(path, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete this item.");
      setFlash(`${title} deleted.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this item.");
    }
  }
  async function updateLms(
    path: string,
    currentTitle: string,
    currentInstructions: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const title = window.prompt("Update title", currentTitle);
    if (title === null) return;
    const instructions = window.prompt("Update content or instructions", currentInstructions);
    if (instructions === null) return;
    try {
      const response = await neonApi(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...extra,
          title,
          instructions,
          body: extra.body ?? instructions,
          description: extra.description ?? instructions,
          status,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this item.");
      setFlash(`${title} updated.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this item.");
    }
  }

  async function editQuestion(question: Question) {
    const prompt = window.prompt("Update question text", question.prompt);
    if (prompt === null) return;
    const marks = window.prompt("Update mark value", String(question.marks));
    if (marks === null) return;
    try {
      const response = await neonApi(`/api/lms/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, marks: Number(marks) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this question.");
      setFlash("Question updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this question.");
    }
  }

  async function editTopic(topic: Topic) {
    const title = window.prompt("Update topic name", topic.title);
    if (title === null) return;
    try {
      const response = await neonApi(`/api/lms/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this topic.");
      setFlash("Topic updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this topic.");
    }
  }

  async function createTopic(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await neonApi("/api/lms/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subject, title: topicTitle }),
      });
      setTopicTitle("");
      setFlash("Topic created.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the topic.");
    } finally {
      setBusy(false);
    }
  }

  async function createMaterial(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (kind === "file") {
        if (!file) throw new Error("Choose a file to upload.");
        const params = new URLSearchParams({
          classId,
          subject,
          stream,
          title,
          description,
          topicId,
          status,
          term,
          academicYear,
        });
        await neonApi(`/api/lms/materials/upload?${params}`, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: file,
        });
      } else {
        await neonApi("/api/lms/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId,
            subject,
            stream,
            topicId,
            title,
            description,
            type: kind,
            body,
            externalUrl: videoUrl,
            status,
            term,
            academicYear,
          }),
        });
      }
      setTitle("");
      setDescription("");
      setBody("");
      setVideoUrl("");
      setFile(null);
      setFlash(status === "published" ? "Learning material published." : "Draft saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the learning material.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePasswords() {
    setBusy(true);
    setError("");
    try {
      const className = classes.find((row) => row.id === classId)?.name || "";
      const response = await neonApi("/api/lms/accounts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selectedStudents.length ? { studentIds: selectedStudents } : { className },
        ),
      });
      const result = (await response.json()) as { credentials: Credential[] };
      setCredentials(result.credentials);
      setSelectedStudents([]);
      setFlash(
        `Created or reset ${result.credentials.length} permanent student password(s). Save or share them securely.`,
      );
      window.setTimeout(() => setCredentials([]), 60_000);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate student passwords.");
    } finally {
      setBusy(false);
    }
  }
  async function generateParentAccess(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setParentCredential(null);
    try {
      const response = await neonApi("/api/lms/parent-accounts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parentEmail, name: parentName }),
      });
      setParentCredential(
        (await response.json()) as {
          email: string;
          temporaryPassword: string;
          students: { firstName: string; lastName: string; className: string }[];
        },
      );
      setFlash(
        "Parent account is ready. Share the temporary password securely; it is shown only once.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create parent account.");
    } finally {
      setBusy(false);
    }
  }
  async function createQuestion(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const options = questionOptions
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      await neonApi("/api/lms/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          subject,
          type: questionType,
          prompt: questionPrompt,
          options,
          answerKey: questionAnswer,
          marks: Number(questionMarks),
        }),
      });
      setQuestionPrompt("");
      setQuestionOptions("");
      setQuestionAnswer("");
      setFlash("Question added to the reusable question bank.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the question.");
    } finally {
      setBusy(false);
    }
  }
  async function createAssessment(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await neonApi("/api/lms/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          subject,
          stream,
          title: assessmentTitle,
          instructions: assessmentInstructions,
          durationMinutes: Number(assessmentDuration),
          attemptsAllowed: Number(assessmentAttempts),
          startsAt: assessmentStart ? new Date(assessmentStart).toISOString() : null,
          endsAt: assessmentEnd ? new Date(assessmentEnd).toISOString() : null,
          questionIds: selectedQuestions,
          status: assessmentStatus,
        }),
      });
      setAssessmentTitle("");
      setAssessmentInstructions("");
      setSelectedQuestions([]);
      setFlash("Assessment created with the selected reusable questions.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create assessment.");
    } finally {
      setBusy(false);
    }
  }
  async function releaseAssessmentResults(item: Assessment) {
    try {
      await neonApi(`/api/lms/assessments/${item.id}/results-release`, { method: "POST" });
      setFlash("Results are now visible to students.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not release results.");
    }
  }
  async function openAssessmentAttempts(item: Assessment) {
    try {
      const response = await neonApi(`/api/lms/assessments/${item.id}/attempts`);
      setReviewAttempts((await response.json()) as AssessmentAttempt[]);
      setActiveReviewAssessment(item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load assessment attempts.");
    }
  }
  async function saveAssessmentMark(
    attempt: AssessmentAttempt,
    question: AssessmentReviewQuestion,
  ) {
    try {
      await neonApi(`/api/lms/attempts/${attempt.id}/answers/${question.id}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marks: Number(reviewMarks[`${attempt.id}:${question.id}`] ?? question.marksAwarded ?? 0),
          feedback: reviewFeedback[`${attempt.id}:${question.id}`] ?? question.feedback ?? "",
        }),
      });
      if (activeReviewAssessment) await openAssessmentAttempts(activeReviewAssessment);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save question marks.");
    }
  }
  async function openDiscussion(item: Discussion) {
    try {
      const response = await neonApi(`/api/lms/discussions/${item.id}/replies`);
      setDiscussionReplies((await response.json()) as Reply[]);
      setActiveDiscussion(item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the discussion.");
    }
  }
  async function sendDiscussionReply(event: FormEvent) {
    event.preventDefault();
    if (!activeDiscussion) return;
    try {
      await neonApi(`/api/lms/discussions/${activeDiscussion.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: discussionReply }),
      });
      setDiscussionReply("");
      await openDiscussion(activeDiscussion);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reply to this discussion.");
    }
  }
  async function createAssignment(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await neonApi("/api/lms/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          subject,
          stream,
          title: assignmentTitle,
          instructions: assignmentInstructions,
          dueAt: assignmentDue ? new Date(assignmentDue).toISOString() : null,
          maxMarks: Number(assignmentMarks),
          allowLate,
          allowResubmit,
          status,
        }),
      });
      setAssignmentTitle("");
      setAssignmentInstructions("");
      setFlash("Assignment saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the assignment.");
    } finally {
      setBusy(false);
    }
  }
  async function openSubmissions(item: Assignment) {
    try {
      const response = await neonApi(`/api/lms/assignments/${item.id}/submissions`);
      setSubmissions((await response.json()) as Submission[]);
      setActiveAssignment(item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load submissions.");
    }
  }
  async function markSubmission(item: Submission) {
    if (!activeAssignment) return;
    try {
      await neonApi(`/api/lms/assignments/${activeAssignment.id}/submissions/${item.id}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marks: Number(markValues[item.id] ?? item.marks ?? 0),
          feedback: feedbackValues[item.id] ?? item.feedback ?? "",
        }),
      });
      await openSubmissions(activeAssignment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the mark.");
    }
  }
  async function downloadSubmission(item: Submission) {
    try {
      const response = await neonApi(`/api/lms/submissions/${item.id}/download`);
      const result = (await response.json()) as { url: string; fileName: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not download submitted work.");
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.fileName;
      link.rel = "noreferrer";
      link.click();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download submitted work.");
    }
  }
  function downloadCredentials() {
    const csv = [
      "Admission number,Student,Class,Stream,Password",
      ...credentials.map((row) =>
        [
          row.admissionNo,
          `${row.firstName} ${row.lastName}`,
          row.className,
          row.stream,
          row.password,
        ]
          .map((value) => `"${value.replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-lms-passwords.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell eyebrow="Teaching and learning" title="Learning hub">
      <p className="mb-5 max-w-3xl text-sm text-ink-soft">
        Organize learning by the school’s existing classes, streams, subjects, and topics. Teachers
        can publish class notes and video links or keep them as drafts.
      </p>
      <Flash message={flash} />
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Class
          <select
            className={inputCls}
            value={classId}
            onChange={(event) => {
              const nextClass = classes.find((row) => row.id === event.target.value);
              setClassId(event.target.value);
              setSubject("");
              setTopicId("");
              setSelectedQuestions([]);
              setStream(isAdmin ? "*" : nextClass?.streams?.[0] || "");
              setSelectedStudents([]);
            }}
          >
            <option value="">Choose class</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Subject
          <select
            className={inputCls}
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setTopicId("");
              setSelectedQuestions([]);
            }}
          >
            <option value="">Choose subject</option>
            {(currentClass?.subjects || []).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Stream
          <select
            className={inputCls}
            value={stream}
            onChange={(event) => setStream(event.target.value)}
          >
            {isAdmin && <option value="*">All streams</option>}
            {(currentClass?.streams || []).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Panel title="Learning materials">
          <div className="space-y-3">
            {materials.map((item) => (
              <article key={item.id} className="border border-ink/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="text-xs text-ink-soft">
                      {item.className} · {item.subject}
                      {item.stream !== "*" ? ` · ${item.stream}` : ""}
                      {item.topic ? ` · ${item.topic}` : ""}
                    </p>
                  </div>
                  {canManageLms && (
                    <div className="flex gap-2">
                      <button
                        className="text-xs underline"
                        onClick={() =>
                          void updateLms(
                            `/api/lms/materials/${item.id}`,
                            item.title,
                            item.type === "note" ? item.body : item.description,
                            item.status,
                            { externalUrl: item.externalUrl },
                          )
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-owed underline"
                        onClick={() => void removeLms(`/api/lms/materials/${item.id}`, item.title)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  <span className="text-xs uppercase tracking-wide text-ink-soft">
                    {item.status} · {item.type}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
                )}
                {item.type === "note" && (
                  <div className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap border-l-2 border-gold pl-3 text-sm">
                    {item.body}
                  </div>
                )}
                {item.type === "video" && (
                  <a
                    className="mt-3 inline-block text-sm underline"
                    href={item.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open learning video
                  </a>
                )}
                <p className="mt-3 text-xs text-ink-soft">
                  Added by {item.createdByName} · {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </article>
            ))}
            {!materials.length && (
              <p className="py-6 text-sm text-ink-soft">
                No learning materials yet. Create a topic and publish the first resource.
              </p>
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Add a topic">
            <form className="space-y-3" onSubmit={(event) => void createTopic(event)}>
              <label className="block text-sm">
                Topic name
                <input
                  className={inputCls}
                  maxLength={180}
                  required
                  value={topicTitle}
                  onChange={(event) => setTopicTitle(event.target.value)}
                />
              </label>
              <button className={btn("primary")} disabled={busy || !classId || !subject}>
                Create topic
              </button>
            </form>
            {classTopics.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-ink/10 pt-4">
                <p className="eyebrow text-ink-soft">Manage topics for this class and subject</p>
                {classTopics.map((topic) => (
                  <div key={topic.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{topic.title}</span>
                    {canManageLms && (
                      <div className="flex gap-2">
                        <button className={btn("ghost")} onClick={() => void editTopic(topic)}>
                          Edit
                        </button>
                        <button
                          className={btn("bad")}
                          onClick={() => void removeLms(`/api/lms/topics/${topic.id}`, "Topic")}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Create learning material">
            <form className="space-y-3" onSubmit={(event) => void createMaterial(event)}>
              <label className="block text-sm">
                Title
                <input
                  className={inputCls}
                  maxLength={180}
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Description
                <textarea
                  className={inputCls}
                  maxLength={3000}
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Topic
                <select
                  className={inputCls}
                  value={topicId}
                  onChange={(event) => setTopicId(event.target.value)}
                >
                  <option value="">No topic</option>
                  {classTopics.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Term
                  <select
                    className={inputCls}
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                  >
                    <option value="">No term</option>
                    <option>Term 1</option>
                    <option>Term 2</option>
                    <option>Term 3</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Academic year
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    maxLength={4}
                    value={academicYear}
                    onChange={(event) => setAcademicYear(event.target.value)}
                    placeholder="2026"
                  />
                </label>
              </div>
              <label className="block text-sm">
                Content type
                <select
                  className={inputCls}
                  value={kind}
                  onChange={(event) => setKind(event.target.value as "note" | "video" | "file")}
                >
                  <option value="note">Written notes</option>
                  <option value="video">External video</option>
                  <option value="file">Learning file</option>
                </select>
              </label>
              {kind === "note" ? (
                <label className="block text-sm">
                  Notes
                  <textarea
                    className={inputCls}
                    required
                    rows={7}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                  />
                </label>
              ) : kind === "video" ? (
                <label className="block text-sm">
                  Video URL
                  <input
                    type="url"
                    className={inputCls}
                    required
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  File (maximum 20 MB)
                  <input
                    className={inputCls}
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.mp4,.webm,.zip,.txt"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                </label>
              )}
              <label className="block text-sm">
                Save as
                <select
                  className={inputCls}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as "draft" | "published")}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <button className={btn("primary")} disabled={busy || !classId || !subject}>
                {busy ? "Saving…" : "Save material"}
              </button>
            </form>
          </Panel>
        </div>
      </div>
      <section className="mt-7 grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Online quizzes and exams">
          <div className="space-y-3">
            {assessments.map((item) => (
              <article key={item.id} className="border border-ink/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-ink-soft">
                      {item.className} · {item.subject} · {item.stream} · {item.questionCount}{" "}
                      questions · {item.maxMarks} marks · {item.durationMinutes} min
                    </p>
                  </div>
                  {canManageLms && (
                    <div className="flex gap-2">
                      <button
                        className="text-xs underline"
                        onClick={() =>
                          void updateLms(
                            `/api/lms/assessments/${item.id}`,
                            item.title,
                            item.instructions,
                            item.status,
                          )
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-owed underline"
                        onClick={() =>
                          void removeLms(`/api/lms/assessments/${item.id}`, item.title)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  <span className="text-xs uppercase text-ink-soft">{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {item.attemptCount} attempt(s) - {item.openAttemptCount} still open -{" "}
                  {item.pendingReviewCount} written answer(s) awaiting marks
                </p>
                {item.instructions && <p className="mt-2 text-sm">{item.instructions}</p>}
                <button
                  className={`${btn("ghost")} mt-2 mr-2`}
                  disabled={!item.attemptCount}
                  onClick={() => void openAssessmentAttempts(item)}
                >
                  Review attempts
                </button>
                <button
                  className={`${btn("ghost")} mt-2`}
                  disabled={
                    item.resultsReleased || item.pendingReviewCount > 0 || item.openAttemptCount > 0
                  }
                  onClick={() => void releaseAssessmentResults(item)}
                >
                  {item.resultsReleased
                    ? "Results released"
                    : item.openAttemptCount > 0
                      ? "Wait for open attempts"
                      : item.pendingReviewCount > 0
                        ? "Mark written answers to release"
                        : "Release student results"}
                </button>
              </article>
            ))}
            {!assessments.length && (
              <p className="text-sm text-ink-soft">No quizzes or exams created yet.</p>
            )}
          </div>
        </Panel>
        <Panel title="Create an online quiz or exam">
          <form className="space-y-3" onSubmit={(event) => void createAssessment(event)}>
            <label className="block text-sm">
              Title
              <input
                className={inputCls}
                required
                maxLength={180}
                value={assessmentTitle}
                onChange={(event) => setAssessmentTitle(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              Instructions
              <textarea
                className={inputCls}
                rows={3}
                maxLength={10000}
                value={assessmentInstructions}
                onChange={(event) => setAssessmentInstructions(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Duration in minutes
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  max="600"
                  value={assessmentDuration}
                  onChange={(event) => setAssessmentDuration(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Allowed attempts
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  max="10"
                  value={assessmentAttempts}
                  onChange={(event) => setAssessmentAttempts(event.target.value)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Starts at (optional)
                <input
                  className={inputCls}
                  type="datetime-local"
                  value={assessmentStart}
                  onChange={(event) => setAssessmentStart(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Closes at (optional)
                <input
                  className={inputCls}
                  type="datetime-local"
                  value={assessmentEnd}
                  onChange={(event) => setAssessmentEnd(event.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm">
              Publish as
              <select
                className={inputCls}
                value={assessmentStatus}
                onChange={(event) =>
                  setAssessmentStatus(event.target.value as "draft" | "published")
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <fieldset className="max-h-56 space-y-2 overflow-auto border border-ink/10 p-3">
              <legend className="px-1 text-sm">
                Select question bank items for {currentClass?.name || "class"} ·{" "}
                {subject || "subject"}
              </legend>
              {questions
                .filter((q) => q.className === currentClass?.name && q.subject === subject)
                .map((q) => (
                  <label key={q.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.includes(q.id)}
                      onChange={(event) =>
                        setSelectedQuestions((ids) =>
                          event.target.checked ? [...ids, q.id] : ids.filter((id) => id !== q.id),
                        )
                      }
                    />
                    {q.prompt} ({q.marks} marks)
                  </label>
                ))}
              {!questions.some(
                (q) => q.className === currentClass?.name && q.subject === subject,
              ) && (
                <p className="text-xs text-ink-soft">
                  Save questions in the question bank for this class and subject first.
                </p>
              )}
              {questions.some((q) => q.className === currentClass?.name && q.subject === subject) &&
                !selectedQuestions.length && (
                  <p className="text-xs text-ink-soft">
                    Select one or more questions above before saving the assessment.
                  </p>
                )}
            </fieldset>
            <button
              className={btn("primary")}
              disabled={
                busy || !classId || !subject || !assessmentTitle || !selectedQuestions.length
              }
            >
              {busy ? "Saving…" : "Create assessment"}
            </button>
          </form>
        </Panel>
      </section>
      {activeReviewAssessment && (
        <section className="mt-7 border border-ink/10 bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="eyebrow text-ink-soft">Marking assessment</h2>
              <p className="mt-1 font-display text-xl">{activeReviewAssessment.title}</p>
            </div>
            <button className={btn("ghost")} onClick={() => setActiveReviewAssessment(null)}>
              Close
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {reviewAttempts.map((attempt) => (
              <article key={attempt.id} className="border border-ink/10 p-4">
                <div>
                  <h3 className="font-semibold">
                    {attempt.studentName} · {attempt.admissionNo}
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Attempt {attempt.attemptNumber} · {attempt.status} ·{" "}
                    {attempt.submittedAt
                      ? new Date(attempt.submittedAt).toLocaleString()
                      : "Not submitted"}{" "}
                    · Score so far: {attempt.score ?? "—"}
                  </p>
                </div>
                {attempt.status === "in_progress" && (
                  <p className="mt-3 text-sm text-ink-soft">
                    This student is still taking the assessment. Marking is available after
                    submission.
                  </p>
                )}
                <div className="mt-3 space-y-3">
                  {attempt.questions.map((question) => (
                    <div key={question.id} className="border-t border-ink/10 pt-3">
                      <p className="text-sm font-semibold">
                        {question.prompt}{" "}
                        <span className="font-normal text-ink-soft">
                          ({question.marks} marks · {question.type.replaceAll("_", " ")})
                        </span>
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">
                        Student answer:{" "}
                        {question.answer === null || question.answer === undefined
                          ? "No answer"
                          : typeof question.answer === "string"
                            ? question.answer
                            : JSON.stringify(question.answer)}
                      </p>
                      {(question.type === "essay" || question.type === "matching") &&
                      attempt.status !== "in_progress" ? (
                        <>
                          <details className="mt-2 text-xs text-ink-soft">
                            <summary className="cursor-pointer">
                              Show answer key and explanation
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap">
                              Expected answer:{" "}
                              {typeof question.answerKey === "string"
                                ? question.answerKey
                                : JSON.stringify(question.answerKey)}
                            </p>
                            {question.explanation && <p className="mt-1">{question.explanation}</p>}
                          </details>
                          <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                            <input
                              className={inputCls}
                              type="number"
                              min="0"
                              max={question.marks}
                              step="0.5"
                              aria-label={`Marks for ${attempt.admissionNo}`}
                              value={
                                reviewMarks[`${attempt.id}:${question.id}`] ??
                                question.marksAwarded ??
                                ""
                              }
                              onChange={(event) =>
                                setReviewMarks((values) => ({
                                  ...values,
                                  [`${attempt.id}:${question.id}`]: event.target.value,
                                }))
                              }
                            />
                            <input
                              className={inputCls}
                              aria-label="Feedback for answer"
                              placeholder="Feedback (optional)"
                              value={
                                reviewFeedback[`${attempt.id}:${question.id}`] ??
                                question.feedback ??
                                ""
                              }
                              onChange={(event) =>
                                setReviewFeedback((values) => ({
                                  ...values,
                                  [`${attempt.id}:${question.id}`]: event.target.value,
                                }))
                              }
                            />
                            <button
                              className={btn("primary")}
                              onClick={() => void saveAssessmentMark(attempt, question)}
                            >
                              Save mark
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-ink-soft">
                            Marked:{" "}
                            {question.marksAwarded === null
                              ? "No"
                              : `${question.marksAwarded} / ${question.marks}`}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-ink-soft">
                          Automatic score:{" "}
                          {question.marksAwarded === null
                            ? "Pending"
                            : `${question.marksAwarded} / ${question.marks}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {!reviewAttempts.length && (
              <p className="text-sm text-ink-soft">No attempts have been submitted yet.</p>
            )}
          </div>
        </section>
      )}
      <section className="mt-7 grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Reusable question bank">
          <p className="mb-4 text-sm text-ink-soft">
            Keep questions with their existing class and subject. Correct answers are staff-only and
            are not exposed to student APIs.
          </p>
          <div className="max-h-96 space-y-3 overflow-auto">
            {questions.map((question) => (
              <article key={question.id} className="border border-ink/10 p-3">
                <p className="text-xs text-ink-soft">
                  {question.className} · {question.subject} · {question.type.replaceAll("_", " ")} ·{" "}
                  {question.marks} mark(s)
                </p>
                <p className="mt-2 text-sm">{question.prompt}</p>
                {canManageLms && (
                  <div className="mt-3 flex gap-2">
                    <button className={btn("ghost")} onClick={() => void editQuestion(question)}>
                      Edit
                    </button>
                    <button
                      className={btn("bad")}
                      onClick={() =>
                        void removeLms(`/api/lms/questions/${question.id}`, "Question")
                      }
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!questions.length && (
              <p className="py-4 text-sm text-ink-soft">No saved questions in this school yet.</p>
            )}
          </div>
        </Panel>
        <Panel title="Save a question">
          <form className="space-y-3" onSubmit={(event) => void createQuestion(event)}>
            <label className="block text-sm">
              Question type
              <select
                className={inputCls}
                value={questionType}
                onChange={(event) => setQuestionType(event.target.value)}
              >
                <option value="multiple_choice">Multiple choice</option>
                <option value="true_false">True or false</option>
                <option value="short_answer">Short answer</option>
                <option value="fill_blank">Fill in the blank</option>
                <option value="matching">Matching</option>
                <option value="essay">Essay</option>
              </select>
            </label>
            <label className="block text-sm">
              Question
              <textarea
                className={inputCls}
                required
                maxLength={10000}
                rows={3}
                value={questionPrompt}
                onChange={(event) => setQuestionPrompt(event.target.value)}
              />
            </label>
            {questionType === "multiple_choice" && (
              <label className="block text-sm">
                Answer options, one per line
                <textarea
                  className={inputCls}
                  rows={4}
                  value={questionOptions}
                  onChange={(event) => setQuestionOptions(event.target.value)}
                />
              </label>
            )}
            <label className="block text-sm">
              Answer key
              <input
                className={inputCls}
                required={questionType !== "essay"}
                value={questionAnswer}
                onChange={(event) => setQuestionAnswer(event.target.value)}
                placeholder="Correct option or model answer"
              />
            </label>
            <label className="block text-sm">
              Marks
              <input
                className={inputCls}
                type="number"
                min="0.5"
                step="0.5"
                required
                value={questionMarks}
                onChange={(event) => setQuestionMarks(event.target.value)}
              />
            </label>
            <button className={btn("primary")} disabled={busy || !classId || !subject}>
              {busy ? "Saving…" : "Add to question bank"}
            </button>
          </form>
        </Panel>
      </section>
      <section className="mt-7 grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Assignments and marking">
          <div className="space-y-3">
            {assignments.map((item) => (
              <article key={item.id} className="border border-ink/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-ink-soft">
                      {item.className} · {item.subject} · {item.stream} · {item.maxMarks} marks
                      {item.dueAt ? ` · due ${new Date(item.dueAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  {canManageLms && (
                    <div className="flex gap-2">
                      <button
                        className="text-xs underline"
                        onClick={() =>
                          void updateLms(
                            `/api/lms/assignments/${item.id}`,
                            item.title,
                            item.instructions,
                            item.status,
                          )
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-owed underline"
                        onClick={() =>
                          void removeLms(`/api/lms/assignments/${item.id}`, item.title)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  <span className="text-xs uppercase text-ink-soft">{item.status}</span>
                </div>
                {item.instructions && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{item.instructions}</p>
                )}
                <button
                  className={`${btn("ghost")} mt-3`}
                  onClick={() => void openSubmissions(item)}
                >
                  Review submissions
                </button>
              </article>
            ))}
            {!assignments.length && (
              <p className="py-4 text-sm text-ink-soft">
                No assignments have been created for your classes yet.
              </p>
            )}
          </div>
          {activeAssignment && (
            <div className="mt-5 border-t border-ink/10 pt-4">
              <h3 className="font-semibold">Submissions: {activeAssignment.title}</h3>
              <div className="mt-3 space-y-3">
                {submissions.map((item) => (
                  <article key={item.id} className="border border-ink/10 p-3">
                    <p className="font-semibold">
                      {item.firstName} {item.lastName} · {item.admissionNo}
                    </p>
                    <p className="my-2 whitespace-pre-wrap text-sm">{item.responseText}</p>
                    {item.fileName && (
                      <button
                        className="text-sm underline"
                        onClick={() => void downloadSubmission(item)}
                      >
                        Download {item.fileName}
                      </button>
                    )}
                    <p className="text-xs text-ink-soft">{item.status}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_auto]">
                      <input
                        aria-label={`Marks for ${item.admissionNo}`}
                        className={inputCls}
                        type="number"
                        min="0"
                        max={activeAssignment.maxMarks}
                        step="0.5"
                        value={markValues[item.id] ?? item.marks ?? ""}
                        onChange={(event) =>
                          setMarkValues((values) => ({ ...values, [item.id]: event.target.value }))
                        }
                      />
                      <input
                        aria-label={`Feedback for ${item.admissionNo}`}
                        className={inputCls}
                        value={feedbackValues[item.id] ?? item.feedback ?? ""}
                        onChange={(event) =>
                          setFeedbackValues((values) => ({
                            ...values,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="Feedback"
                      />
                      <button className={btn("primary")} onClick={() => void markSubmission(item)}>
                        Save mark
                      </button>
                    </div>
                  </article>
                ))}
                {!submissions.length && (
                  <p className="text-sm text-ink-soft">No student work submitted yet.</p>
                )}
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Create assignment">
          <form className="space-y-3" onSubmit={(event) => void createAssignment(event)}>
            <label className="block text-sm">
              Title
              <input
                className={inputCls}
                required
                maxLength={180}
                value={assignmentTitle}
                onChange={(event) => setAssignmentTitle(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              Instructions
              <textarea
                className={inputCls}
                rows={4}
                maxLength={10000}
                value={assignmentInstructions}
                onChange={(event) => setAssignmentInstructions(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Due date
                <input
                  className={inputCls}
                  type="datetime-local"
                  value={assignmentDue}
                  onChange={(event) => setAssignmentDue(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Maximum marks
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={assignmentMarks}
                  onChange={(event) => setAssignmentMarks(event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowLate}
                onChange={(event) => setAllowLate(event.target.checked)}
              />
              Accept late submissions
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowResubmit}
                onChange={(event) => setAllowResubmit(event.target.checked)}
              />
              Allow students to resubmit
            </label>
            <button className={btn("primary")} disabled={busy || !classId || !subject}>
              {busy ? "Saving…" : "Save assignment"}
            </button>
          </form>
        </Panel>
      </section>
      <section className="mt-7 grid gap-6 xl:grid-cols-2">
        <Panel title="Student discussion forums">
          <p className="mb-3 text-sm text-ink-soft">
            Read questions from students in classes and subjects assigned to you, then respond in
            their thread.
          </p>
          <div className="max-h-80 space-y-2 overflow-auto">
            {discussions.map((item) => (
              <button
                key={item.id}
                className="block w-full border border-ink/10 p-3 text-left hover:bg-ink/5"
                onClick={() => void openDiscussion(item)}
              >
                <span className="font-semibold">{item.title}</span>
                <span className="block text-xs text-ink-soft">
                  {item.className} · {item.subject} · {item.authorName} · {item.replyCount} replies
                </span>
              </button>
            ))}
            {!discussions.length && (
              <p className="py-4 text-sm text-ink-soft">
                No student questions in your assigned classes yet.
              </p>
            )}
          </div>
        </Panel>
        <Panel title="Respond to a question">
          {activeDiscussion ? (
            <>
              <h3 className="font-semibold">{activeDiscussion.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{activeDiscussion.body}</p>
              <p className="mt-2 text-xs text-ink-soft">
                {activeDiscussion.className} · {activeDiscussion.subject} · asked by{" "}
                {activeDiscussion.authorName}
              </p>
              <div className="mt-4 space-y-3">
                {discussionReplies.map((reply) => (
                  <article key={reply.id} className="border-l-2 border-gold pl-3">
                    <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {reply.authorName} · {new Date(reply.createdAt).toLocaleString()}
                    </p>
                  </article>
                ))}
              </div>
              <form
                className="mt-4 space-y-3"
                onSubmit={(event) => void sendDiscussionReply(event)}
              >
                <textarea
                  className={inputCls}
                  required
                  maxLength={5000}
                  rows={3}
                  aria-label="Reply to discussion"
                  value={discussionReply}
                  onChange={(event) => setDiscussionReply(event.target.value)}
                />
                <button className={btn("primary")}>Post reply</button>
              </form>
            </>
          ) : (
            <p className="text-sm text-ink-soft">Select a student question to respond.</p>
          )}
        </Panel>
      </section>
      {isAdmin && (
        <section className="mt-7 border border-ink/10 bg-card p-5">
          <div className="mb-6 border-b border-ink/10 pb-5">
            <h2 className="eyebrow text-ink-soft">Parent learning access</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">
              Add a guardian email to each linked student record first. Parent accounts can view
              learning activity and assignments for every active child at that email, plus approved
              school exam scores and released online quiz results.
            </p>
            <form
              className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
              onSubmit={(event) => void generateParentAccess(event)}
            >
              <input
                className={inputCls}
                type="email"
                required
                placeholder="Guardian email"
                value={parentEmail}
                onChange={(event) => setParentEmail(event.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Guardian name (optional)"
                value={parentName}
                onChange={(event) => setParentName(event.target.value)}
              />
              <button className={btn("primary")} disabled={busy}>
                {busy ? "Creating…" : "Create / reset parent access"}
              </button>
            </form>
            {parentCredential && (
              <div className="mt-3 border border-gold p-3 text-sm">
                <p>
                  Login: <strong>{parentCredential.email}</strong> · temporary password:{" "}
                  <code className="font-mono font-bold">{parentCredential.temporaryPassword}</code>
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Linked:{" "}
                  {parentCredential.students
                    .map((child) => `${child.firstName} ${child.lastName} (${child.className})`)
                    .join(", ")}
                  . Share at{" "}
                  <a className="underline" href="/parent-login">
                    /parent-login
                  </a>
                  . This password will not be shown again.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="eyebrow text-ink-soft">Student LMS accounts</h2>
              <p className="mt-2 text-sm text-ink-soft">
                Generate a permanent password for each student. Passwords are shown once, then
                disappear automatically after one minute or when you hide them.
              </p>
            </div>
            <button
              className={btn("primary")}
              disabled={busy || !classId}
              onClick={() => void generatePasswords()}
            >
              {busy
                ? "Generating…"
                : selectedStudents.length
                  ? `Generate for ${selectedStudents.length} selected`
                  : "Generate for this class"}
            </button>
          </div>
          {credentials.length > 0 && (
            <div className="mt-4 border border-gold p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">Temporary password sheet · download it now</p>
                <div className="flex gap-2">
                  <button className={btn("ghost")} onClick={downloadCredentials}>
                    Download CSV
                  </button>
                  <button className={btn("ghost")} onClick={() => setCredentials([])}>
                    Hide passwords
                  </button>
                </div>
              </div>
              <div className="mt-3 max-h-64 overflow-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="p-2">Admission</th>
                      <th className="p-2">Student</th>
                      <th className="p-2">Class / stream</th>
                      <th className="p-2">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map((row) => (
                      <tr key={row.admissionNo} className="border-t border-ink/10">
                        <td className="p-2">{row.admissionNo}</td>
                        <td className="p-2">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="p-2">
                          {row.className} / {row.stream}
                        </td>
                        <td className="p-2 font-mono">{row.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-4 max-h-72 space-y-2 overflow-auto">
            {visibleAccounts.map((row) => (
              <label
                key={row.id}
                className="flex items-center gap-3 border-b border-ink/5 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(row.id)}
                  onChange={(event) =>
                    setSelectedStudents((current) =>
                      event.target.checked
                        ? [...current, row.id]
                        : current.filter((id) => id !== row.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  {row.firstName} {row.lastName} · {row.admissionNo} · {row.className} /{" "}
                  {row.stream}
                </span>
                <span className="text-xs text-ink-soft">
                  {row.accountActive
                    ? row.mustChangePassword
                      ? "Must change password"
                      : "Active"
                    : "No account"}
                </span>
              </label>
            ))}
            {!visibleAccounts.length && (
              <p className="py-3 text-sm text-ink-soft">
                Select a class above to view its active students.
              </p>
            )}
          </div>
        </section>
      )}
    </PortalShell>
  );
}
