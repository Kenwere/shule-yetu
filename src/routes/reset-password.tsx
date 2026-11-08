import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password - Shule Yetu" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const token =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing its token. Request a new password reset link.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error(result.error.message || "Could not reset your password.");
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Staff portal" title="Reset password">
      {done ? (
        <div>
          <p role="status" className="mb-5 text-sm text-collected">
            Your password has been changed. You can now sign in.
          </p>
          <button className={submitClass} onClick={() => void navigate({ to: "/login" })}>
            Go to login
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Field
            label="New password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Field
            label="Confirm new password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error && (
            <p role="alert" className="mb-3 text-sm text-owed">
              {error}
            </p>
          )}
          <button className={submitClass} disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </button>
          <Link
            to="/login"
            className="mt-4 block text-center text-sm font-semibold underline underline-offset-4"
          >
            Back to login
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
