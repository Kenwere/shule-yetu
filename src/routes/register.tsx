import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";
import { signInMock } from "@/lib/mock-auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — Shule Yetu" },
      { name: "description", content: "Request a staff account for the Shule Yetu portal." },
      { property: "og:title", content: "Register — Shule Yetu" },
      { property: "og:description", content: "Request a staff account; an admin approves new users." },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Teacher");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <AuthShell eyebrow="New staff account" title="Registered">
        <p className="text-sm">
          Your account request has been recorded. In this demo you're signed in straight away as{" "}
          <strong>{name}</strong> ({role}).
        </p>
        <button className={submitClass + " mt-6"} onClick={() => navigate({ to: "/dashboard" })}>
          Go to dashboard
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="New staff account" title="Register">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signInMock({ name, email, role });
          setDone(true);
        }}
      >
        <Field label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" required minLength={8} />
        <Field label="Confirm password" type="password" required minLength={8} />
        <label className="mb-6 block">
          <span className="eyebrow text-[10px] text-ink-soft">Requested role</span>
          <select
            className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option>Teacher</option>
            <option>Accountant</option>
            <option>Admin</option>
          </select>
        </label>
        <button className={submitClass}>Request account</button>
        <p className="mt-4 text-xs text-ink-soft">Demo mode: registration signs you in immediately.</p>
        <p className="mt-2 text-sm">Already have an account? <Link to="/login" className="font-semibold hover:text-gold">Login</Link></p>
      </form>
    </AuthShell>
  );
}
