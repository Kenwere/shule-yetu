import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Staff Login — St John's Academy" },
      { name: "description", content: "Sign in to the St John's Academy management portal." },
      { property: "og:title", content: "Staff Login — St John's Academy" },
      { property: "og:description", content: "Sign in to the school management portal." },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <AuthShell eyebrow="Staff portal" title="Login">
      <form onSubmit={(e) => e.preventDefault()}>
        <Field label="Email" type="email" required autoComplete="email" />
        <Field label="Password" type="password" required autoComplete="current-password" />
        <button className={submitClass}>Sign in</button>
        <div className="mt-4 flex justify-between text-sm">
          <a className="text-ink-soft hover:text-ink">Forgot password?</a>
          <Link to="/register" className="font-semibold hover:text-gold">Register</Link>
        </div>
      </form>
    </AuthShell>
  );
}
