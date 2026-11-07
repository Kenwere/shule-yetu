import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { studentLogin } from "@/lib/neon-api";
import { inputCls } from "@/components/portal-ui";

export const Route = createFileRoute("/student-login")({
  head: () => ({ meta: [{ title: "Student login - Shule Yetu" }] }),
  component: StudentLoginPage,
});

function StudentLoginPage() {
  const [admissionNo, setAdmissionNo] = useState("");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await studentLogin(admissionNo, password, schoolName);
      window.location.assign("/student");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <section className="w-full max-w-md border border-ink/10 bg-card p-7 shadow-sm">
        <p className="eyebrow text-ink-soft">Shule Yetu · Student learning</p>
        <h1 className="mt-2 font-display text-3xl uppercase">Student sign in</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Use the admission number and temporary password provided by your school.
        </p>
        {error && (
          <p className="mt-4 text-sm text-owed" role="alert">
            {error}
          </p>
        )}
        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm">
            Admission number
            <input
              className={inputCls}
              autoComplete="username"
              required
              value={admissionNo}
              onChange={(event) => setAdmissionNo(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            School name (only if admission numbers overlap)
            <input
              className={inputCls}
              autoComplete="organization"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              className={inputCls}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className="w-full bg-ink px-4 py-3 text-sm font-bold uppercase text-paper disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-xs text-ink-soft">
          Forgot your password? Ask your school administrator to reset it.
        </p>
        <a href="/login" className="mt-5 inline-block text-sm underline">
          Staff sign in
        </a>
        <a href="/parent-login" className="ml-4 inline-block text-sm underline">
          Parent sign in
        </a>
      </section>
    </main>
  );
}
