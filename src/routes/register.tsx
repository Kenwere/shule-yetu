import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";
import { authClient } from "@/lib/auth-client";
import { signInMock } from "@/lib/mock-auth";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register — Shule Yetu" }, { name: "description", content: "Request a staff account for the Shule Yetu portal." }] }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Teacher");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error || !result.data) {
        setError(result.error?.message ?? "Registration failed.");
        return;
      }
      signInMock({ name: result.data.user.name, email: result.data.user.email, role });
      await navigate({ to: "/dashboard" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="New staff account" title="Register">
      <form onSubmit={submit}>
        <Field label="Full name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <Field label="Confirm password" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        <label className="mb-6 block">
          <span className="eyebrow text-[10px] text-ink-soft">Requested role</span>
          <select className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
            <option>Teacher</option>
            <option>Accountant</option>
            <option>Admin</option>
          </select>
        </label>
        {error && <p role="alert" className="mb-3 text-sm text-owed">{error}</p>}
        <button className={submitClass} disabled={busy}>{busy ? "Creating account..." : "Request account"}</button>
        <p className="mt-2 text-sm">Already have an account? <Link to="/login" className="font-semibold hover:text-gold">Login</Link></p>
      </form>
    </AuthShell>
  );
}