import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";
import { authClient } from "@/lib/auth-client";
import { getStaffInvitation, neonApi } from "@/lib/neon-api";
export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — Shule Yetu" },
      { name: "description", content: "Create a school profile and administrator account." },
    ],
  }),
  component: Register,
});
function Register() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState("");
  const [invitation, setInvitation] = useState<{ email: string; name: string; schoolName: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite") || "";
    setInviteCode(code);
    if (code) {
      setInviteLoading(true);
      void getStaffInvitation(code)
        .then((details) => {
          setInvitation({ email: details.email || "", name: details.name || "", schoolName: details.schoolName || "" });
          setEmail(details.email || "");
          setName(details.name || "");
          setError("");
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not verify invitation."))
        .finally(() => setInviteLoading(false));
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (inviteCode && (!invitation || email.trim().toLowerCase() !== invitation.email.toLowerCase())) {
      setError("Use the email address this teacher invitation was sent to.");
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
      if (inviteCode) {
        const session = await authClient.getSession();
        if (session.error || !session.data?.session?.token) {
          setError("Your account was created. Sign in with this email to finish joining the school.");
          return;
        }
        await neonApi("/api/staff/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: inviteCode }),
        });
      } else {
        await neonApi("/api/school-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolName,
            schoolType,
            email: schoolEmail,
            phone: schoolPhone,
            address: schoolAddress,
            website: schoolWebsite,
            motto: schoolMotto,
          }),
        });
      }
      await navigate({ to: "/dashboard" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell
      eyebrow={inviteCode ? "Join a school" : "School setup"}
      title={inviteCode ? "Staff registration" : "Register your school"}
    >
      <form onSubmit={submit}>
        {inviteCode && invitation && (
          <p className="mb-4 text-sm">You are joining <strong>{invitation.schoolName}</strong>. The invitation is for <strong>{invitation.email}</strong>.</p>
        )}
        {inviteCode && inviteLoading && <p className="mb-4 text-sm">Checking invitation…</p>}
        {!inviteCode && (
          <section className="mb-7 border-b border-ink/10 pb-6">
            <h2 className="eyebrow mb-4 text-ink-soft">School information</h2>
            <Field
              label="School name"
              required
              maxLength={160}
              autoComplete="organization"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
            <label className="mb-4 block">
              <span className="eyebrow text-[10px] text-ink-soft">School type</span>
              <select
                className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm"
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value)}
              >
                <option>Primary and secondary</option>
                <option>Early years</option>
                <option>Primary</option>
                <option>Junior secondary</option>
                <option>Senior secondary</option>
                <option>College or university</option>
                <option>Other</option>
              </select>
            </label>
            <Field
              label="School contact email"
              type="email"
              autoComplete="email"
              value={schoolEmail}
              onChange={(e) => setSchoolEmail(e.target.value)}
            />
            <Field
              label="School phone"
              type="tel"
              autoComplete="tel"
              value={schoolPhone}
              onChange={(e) => setSchoolPhone(e.target.value)}
            />
            <Field
              label="School address / location"
              autoComplete="street-address"
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
            />
            <Field
              label="School website (optional)"
              type="url"
              autoComplete="url"
              value={schoolWebsite}
              onChange={(e) => setSchoolWebsite(e.target.value)}
            />
            <Field
              label="School motto (optional)"
              maxLength={200}
              value={schoolMotto}
              onChange={(e) => setSchoolMotto(e.target.value)}
            />
          </section>
        )}
        <section>
          <h2 className="eyebrow mb-4 text-ink-soft">
            {inviteCode ? "Teacher account" : "Administrator account"}
          </h2>
          <Field
            label="Full name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Login email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(inviteCode && invitation)}
          />
          <Field
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field
            label="Confirm password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </section>
        {error && (
          <p role="alert" className="mb-3 text-sm text-owed">
            {error}
          </p>
        )}
        <button className={submitClass} disabled={busy || inviteLoading || Boolean(inviteCode && !invitation)}>
          {busy ? "Creating account…" : inviteCode ? "Join school" : "Create school account"}
        </button>
        <p className="mt-2 text-sm">
          Already have an account?{" "}
          <a href={inviteCode ? `/login?invite=${encodeURIComponent(inviteCode)}` : "/login"} className="font-semibold hover:text-gold">
            Login
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
