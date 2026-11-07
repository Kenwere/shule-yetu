import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { inputCls } from "@/components/portal-ui";
import { parentLogin } from "@/lib/neon-api";

export const Route = createFileRoute("/parent-login")({
  head: () => ({ meta: [{ title: "Parent sign in - Shule Yetu" }] }),
  component: ParentLoginPage,
});
function ParentLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await parentLogin(email, password, schoolName);
      window.location.assign("/parent");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <section className="w-full max-w-md border border-ink/10 bg-card p-7 shadow-sm">
        <p className="eyebrow text-ink-soft">Shule Yetu · Family access</p>
        <h1 className="mt-2 font-display text-3xl uppercase">Parent sign in</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Use the email and temporary password provided by your school.
        </p>
        {error && (
          <p className="mt-4 text-sm text-owed" role="alert">
            {error}
          </p>
        )}
        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm">
            Email
            <input
              className={inputCls}
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            School name (if requested)
            <input
              className={inputCls}
              autoComplete="organization"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              className={inputCls}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className="w-full bg-ink px-4 py-3 text-sm font-bold uppercase text-paper disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <a href="/login" className="mt-5 inline-block text-sm underline">
          Staff sign in
        </a>
      </section>
    </main>
  );
}
