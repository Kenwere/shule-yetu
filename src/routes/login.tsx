import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";
import { authClient } from "@/lib/auth-client";
import { neonApi } from "@/lib/neon-api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Staff Login — Shule Yetu" },
      { name: "description", content: "Sign in to the Shule Yetu management portal." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error || !result.data) {
        setError(result.error?.message ?? "Sign in failed.");
        return;
      }
      const inviteCode = new URLSearchParams(window.location.search).get("invite");
      if (inviteCode) {
        await neonApi("/api/staff/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: inviteCode }),
        });
      }
      await navigate({ to: "/dashboard" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Staff portal" title="Login">
      <form onSubmit={submit}>
        <Field
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p role="alert" className="mb-3 text-sm text-owed">
            {error}
          </p>
        )}
        <button className={submitClass} disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <div className="mt-4 flex justify-between text-sm">
          <a className="text-ink-soft hover:text-ink">Forgot password?</a>
          <a
            href={new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("invite")
              ? `/register?invite=${encodeURIComponent(new URLSearchParams(window.location.search).get("invite") || "")}`
              : "/register"}
            className="font-semibold hover:text-gold"
          >
            Register
          </a>
        </div>
        <Link
          to="/student-login"
          className="mt-5 block text-center text-sm font-semibold underline underline-offset-4"
        >
          Student learning sign in
        </Link>
      </form>
    </AuthShell>
  );
}
