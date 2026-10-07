import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — St John's Academy" },
      { name: "description", content: "Request a staff account for the St John's Academy portal." },
      { property: "og:title", content: "Register — St John's Academy" },
      { property: "og:description", content: "Request a staff account; an admin approves new users." },
    ],
  }),
  component: Register,
});

function Register() {
  return (
    <AuthShell eyebrow="New staff account" title="Register">
      <form onSubmit={(e) => e.preventDefault()}>
        <Field label="Full name" required />
        <Field label="Email" type="email" required />
        <Field label="Password" type="password" required minLength={8} />
        <Field label="Confirm password" type="password" required minLength={8} />
        <label className="mb-6 block">
          <span className="eyebrow text-[10px] text-ink-soft">Requested role</span>
          <select className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm">
            <option>Teacher</option>
            <option>Accountant</option>
            <option>Admin</option>
          </select>
        </label>
        <button className={submitClass}>Request account</button>
        <p className="mt-4 text-xs text-ink-soft">New accounts stay pending until an admin approves them.</p>
        <p className="mt-2 text-sm">Already have an account? <Link to="/login" className="font-semibold hover:text-gold">Login</Link></p>
      </form>
    </AuthShell>
  );
}
