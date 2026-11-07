import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { inputCls } from "@/components/portal-ui";
import { parentApi, saveParentToken } from "@/lib/neon-api";

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  className: string;
  stream: string;
  activity: {
    materialsAvailable: number;
    materialsCompleted: number;
    secondsViewed: number;
    downloads: number;
  };
  assignments: {
    title: string;
    subject: string;
    status: string;
    marks: number | null;
    feedback: string;
    submittedAt: string;
  }[];
  exams: { exam: string; term: string; academicYear: string; subject: string; score: number }[];
  assessments: {
    title: string;
    subject: string;
    score: number | null;
    maxMarks: number;
    submittedAt: string;
  }[];
};
export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Family learning progress - Shule Yetu" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParentPage,
});
function ParentPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await parentApi("/api/lms/parent/progress");
      const data = (await r.json()) as { students: Child[] };
      setChildren(data.students);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load child progress.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    void parentApi("/api/lms/parent/me")
      .then(async (r) => {
        const d = (await r.json()) as { mustChangePassword: boolean };
        setMustChange(d.mustChangePassword);
      })
      .catch(() => undefined);
  }, []);
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await parentApi("/api/lms/parent/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setMustChange(false);
      setCurrent("");
      setNext("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await parentApi("/api/lms/parent/auth/logout", { method: "POST" });
    } catch {
      // Clear the local session even when the server session has already expired.
    }
    saveParentToken(null);
    window.location.assign("/parent-login");
  }
  return (
    <main className="min-h-screen bg-paper px-4 py-8 text-ink">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5">
          <div>
            <p className="eyebrow text-ink-soft">Shule Yetu · Family access</p>
            <h1 className="mt-1 font-display text-3xl uppercase">Children’s learning</h1>
          </div>
          <button
            className="border border-ink/20 px-4 py-2 text-sm font-bold uppercase"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </header>
        {error && (
          <p role="alert" className="mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        )}
        {mustChange && (
          <form
            className="mt-5 grid gap-3 border border-amber-400 bg-amber-50 p-4 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={(e) => void changePassword(e)}
          >
            <label className="text-sm">
              Temporary password
              <input
                className={inputCls}
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label className="text-sm">
              New password (10 characters minimum)
              <input
                className={inputCls}
                type="password"
                minLength={10}
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <button
              className="self-end bg-ink px-4 py-2 text-sm font-bold uppercase text-paper"
              disabled={busy}
            >
              Update password
            </button>
          </form>
        )}
        {mustChange ? (
          <p className="mt-5 text-sm text-ink-soft">
            Change your temporary password to view linked student progress.
          </p>
        ) : (
          <div className="mt-6 grid gap-6">
            {children.map((child) => (
              <section key={child.id} className="border border-ink/10 bg-card p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl">
                      {child.firstName} {child.lastName}
                    </h2>
                    <p className="text-sm text-ink-soft">
                      {child.admissionNo} · {child.className}
                      {child.stream ? ` / ${child.stream}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    <Metric
                      label="Materials completed"
                      value={`${child.activity.materialsCompleted}/${child.activity.materialsAvailable}`}
                    />
                    <Metric
                      label="Learning time"
                      value={`${Math.floor(child.activity.secondsViewed / 3600)}h ${Math.floor((child.activity.secondsViewed % 3600) / 60)}m`}
                    />
                    <Metric label="Downloads" value={String(child.activity.downloads)} />
                  </div>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-3">
                  <DataList
                    title="Assignments"
                    rows={child.assignments.map(
                      (x) =>
                        `${x.title} · ${x.status}${x.marks !== null ? ` · ${x.marks} marks` : ""}${x.feedback ? ` · ${x.feedback}` : ""}`,
                    )}
                    empty="No assignment submissions yet."
                  />
                  <DataList
                    title="School exam scores"
                    rows={child.exams.map(
                      (x) => `${x.exam} · ${x.subject} · ${x.score} (${x.term} ${x.academicYear})`,
                    )}
                    empty="No approved exam scores yet."
                  />
                  <DataList
                    title="Online quiz results"
                    rows={child.assessments.map(
                      (x) => `${x.title} · ${x.subject} · ${x.score ?? "Pending"}/${x.maxMarks}`,
                    )}
                    empty="No released quiz results yet."
                  />
                </div>
              </section>
            ))}
            {!children.length && !error && (
              <p className="border border-ink/10 bg-card p-6 text-sm text-ink-soft">
                No active students are linked to this parent account. Contact the school
                administrator.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ink/10 px-3 py-2">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
function DataList({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return (
    <div>
      <h3 className="eyebrow text-ink-soft">{title}</h3>
      {rows.length ? (
        <ul className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <li key={`${i}-${row}`} className="border-t border-ink/10 pt-2 text-sm">
              {row}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">{empty}</p>
      )}
    </div>
  );
}
