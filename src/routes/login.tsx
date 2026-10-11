import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field, submitClass } from "@/components/AuthShell";
import { signInMock } from "@/lib/mock-auth";

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
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  return (
    <AuthShell eyebrow="Staff portal" title="Login">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = email.split("@")[0]?.replace(/[._-]/g, " ").trim() || "Staff Member";
          signInMock({
            name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
            email,
            role: "Admin",
          });
          navigate({ to: "/dashboard" });
        }}
      >
        <Field
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field label="Password" type="password" required autoComplete="current-password" />
        <button className={submitClass}>Sign in</button>
        <p className="mt-3 text-xs text-ink-soft">
          Demo mode: any email and password signs you in.
        </p>
        <div className="mt-4 flex justify-between text-sm">
          <a className="text-ink-soft hover:text-ink">Forgot password?</a>
          <Link to="/register" className="font-semibold hover:text-gold">Register</Link>
        </div>
      </form>
    </AuthShell>
  );
}
