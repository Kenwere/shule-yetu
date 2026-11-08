import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Panel, btn, inputCls } from "@/components/portal-ui";
import { authClient } from "@/lib/auth-client";
import { neonApi } from "@/lib/neon-api";

type Account = { id: string; name: string; email: string; role: string; active: boolean };
type Draft = { name: string; email: string; password: string; currentPassword: string };
const authAdmin = authClient as unknown as {
  admin: {
    updateUser(input: {
      userId: string;
      data: { name: string; email: string };
    }): Promise<{ error: { message?: string } | null }>;
    setUserPassword(input: {
      userId: string;
      newPassword: string;
    }): Promise<{ error: { message?: string } | null }>;
  };
};

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [{ title: "Accounts - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const [staffResponse, meResponse] = await Promise.all([
        neonApi("/api/accounts"),
        neonApi("/api/me"),
      ]);
      const staff = await staffResponse.json();
      const me = await meResponse.json();
      setAccounts(staff.accounts || []);
      setUserId(me.userId || "");
      setDrafts(
        Object.fromEntries(
          (staff.accounts || []).map((row: Account) => [
            row.id,
            { name: row.name, email: row.email, password: "", currentPassword: "" },
          ]),
        ),
      );
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load school accounts.");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function setDraft(id: string, field: keyof Draft, value: string) {
    setDrafts((rows) => {
      const current = rows[id];
      return current ? { ...rows, [id]: { ...current, [field]: value } } : rows;
    });
  }

  async function saveProfile(account: Account, event: FormEvent) {
    event.preventDefault();
    const draft = drafts[account.id];
    if (!draft) return;
    setBusy(account.id);
    setError("");
    setMessage("");
    try {
      const email = draft.email.trim().toLowerCase();
      const result =
        account.id === userId && email === account.email.toLowerCase()
          ? await authClient.updateUser({ name: draft.name.trim() })
          : await authAdmin.admin.updateUser({
              userId: account.id,
              data: { name: draft.name.trim(), email },
            });
      if (result.error)
        throw new Error(result.error.message || "Neon Auth could not update this account.");
      await neonApi(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, email: draft.email }),
      });
      setMessage(`Updated ${draft.name}'s name and email.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the account.");
    } finally {
      setBusy("");
    }
  }

  async function savePassword(account: Account, event: FormEvent) {
    event.preventDefault();
    const draft = drafts[account.id];
    if (!draft) return;
    if (draft.password.length < 10) {
      setError("Passwords must contain at least 10 characters.");
      return;
    }
    setBusy(account.id);
    setError("");
    setMessage("");
    try {
      const result =
        account.id === userId
          ? await authClient.changePassword({
              currentPassword: draft.currentPassword,
              newPassword: draft.password,
            })
          : await authAdmin.admin.setUserPassword({
              userId: account.id,
              newPassword: draft.password,
            });
      if (result.error)
        throw new Error(result.error.message || "Neon Auth could not change this password.");
      setDraft(account.id, "password", "");
      setDraft(account.id, "currentPassword", "");
      setMessage(`Password updated for ${account.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the password.");
    } finally {
      setBusy("");
    }
  }

  return (
    <PortalShell eyebrow="School administration" title="Accounts">
      <Panel title="School user accounts">
        <p className="mb-5 text-sm text-ink-soft">
          Update staff names and email addresses or set a new login password. Passwords are saved
          directly in Neon Auth and are never displayed after saving.
        </p>
        <p className="mb-5 border border-ink/10 p-3 text-xs text-ink-soft">
          Updating your own password requires your current password. Changing another user’s login
          email or password requires this account to also have the Neon Auth administrator role.
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-owed">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-4 text-sm text-collected">
            {message}
          </p>
        )}
        <div className="space-y-5">
          {accounts.map((account) => {
            const draft = drafts[account.id];
            if (!draft) return null;
            return (
              <section key={account.id} className="border border-ink/10 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{account.name}</h2>
                  <span className="text-xs text-ink-soft">
                    {account.role}
                    {account.active ? "" : " · inactive"}
                  </span>
                </div>
                <form
                  onSubmit={(event) => void saveProfile(account, event)}
                  className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <label className="text-sm">
                    Full name
                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      className={inputCls}
                      value={draft.name}
                      onChange={(event) => setDraft(account.id, "name", event.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Email
                    <input
                      required
                      type="email"
                      className={inputCls}
                      value={draft.email}
                      onChange={(event) => setDraft(account.id, "email", event.target.value)}
                    />
                  </label>
                  <button className={btn("good")} disabled={busy === account.id}>
                    Save profile
                  </button>
                </form>
                <form
                  onSubmit={(event) => void savePassword(account, event)}
                  className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  {account.id === userId && (
                    <label className="text-sm">
                      Current password
                      <input
                        required
                        type="password"
                        autoComplete="current-password"
                        className={inputCls}
                        value={draft.currentPassword}
                        onChange={(event) =>
                          setDraft(account.id, "currentPassword", event.target.value)
                        }
                      />
                    </label>
                  )}
                  <label className="text-sm">
                    New password
                    <input
                      required
                      minLength={10}
                      type="password"
                      autoComplete="new-password"
                      className={inputCls}
                      value={draft.password}
                      onChange={(event) => setDraft(account.id, "password", event.target.value)}
                    />
                  </label>
                  <button className={btn("ghost")} disabled={busy === account.id}>
                    Update password
                  </button>
                </form>
              </section>
            );
          })}
          {!accounts.length && (
            <p className="py-6 text-center text-sm text-ink-soft">No school accounts found.</p>
          )}
        </div>
      </Panel>
    </PortalShell>
  );
}
