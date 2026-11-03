import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";
import { authClient } from "@/lib/auth-client";
import { neonApi } from "@/lib/neon-api";
import { signInMock } from "@/lib/mock-auth";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register — Shule Yetu" }, { name: "description", content: "Create a school profile and staff account for the Shule Yetu portal." }] }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Teacher");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("Primary and secondary");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolWebsite, setSchoolWebsite] = useState("");
  const [schoolMotto, setSchoolMotto] = useState("");
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
      const response = await neonApi("/api/school-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName, schoolType, email: schoolEmail, phone: schoolPhone,
          address: schoolAddress, website: schoolWebsite, motto: schoolMotto,
        }),
      });
      if (!response.ok) throw new Error("Your account was created, but saving the school profile failed. Sign in and try again from school settings.");
      signInMock({ name: result.data.user.name, email: result.data.user.email, role });
      await navigate({ to: "/dashboard" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="School setup" title="Register">
      <form onSubmit={submit}>
        <section className="mb-7 border-b border-ink/10 pb-6">
          <h2 className="eyebrow mb-4 text-ink-soft">School information</h2>
          <Field label="School name" required maxLength={160} autoComplete="organization" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
          <label className="mb-4 block">
            <span className="eyebrow text-[10px] text-ink-soft">School type</span>
            <select className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm" value={schoolType} onChange={(event) => setSchoolType(event.target.value)}>
              <option>Primary and secondary</option><option>Early years</option><option>Primary</option><option>Junior secondary</option><option>Senior secondary</option><option>College or university</option><option>Other</option>
            </select>
          </label>
          <Field label="School contact email" type="email" autoComplete="email" value={schoolEmail} onChange={(event) => setSchoolEmail(event.target.value)} />
          <Field label="School phone" type="tel" autoComplete="tel" value={schoolPhone} onChange={(event) => setSchoolPhone(event.target.value)} />
          <Field label="School address / location" autoComplete="street-address" value={schoolAddress} onChange={(event) => setSchoolAddress(event.target.value)} />
          <Field label="School website (optional)" type="url" autoComplete="url" value={schoolWebsite} onChange={(event) => setSchoolWebsite(event.target.value)} />
          <Field label="School motto (optional)" maxLength={200} value={schoolMotto} onChange={(event) => setSchoolMotto(event.target.value)} />
        </section>
        <section>
          <h2 className="eyebrow mb-4 text-ink-soft">Administrator account</h2>
          <Field label="Full name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          <Field label="Login email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Field label="Password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Field label="Confirm password" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <label className="mb-6 block">
            <span className="eyebrow text-[10px] text-ink-soft">Requested role</span>
            <select className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
              <option>Teacher</option><option>Accountant</option><option>Admin</option>
            </select>
          </label>
        </section>
        {error && <p role="alert" className="mb-3 text-sm text-owed">{error}</p>}
        <button className={submitClass} disabled={busy}>{busy ? "Creating school account..." : "Create school account"}</button>
        <p className="mt-2 text-sm">Already have an account? <Link to="/login" className="font-semibold hover:text-gold">Login</Link></p>
      </form>
    </AuthShell>
  );
}