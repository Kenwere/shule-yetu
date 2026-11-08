import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { btn, inputCls } from "@/components/portal-ui";
import { authClient } from "@/lib/auth-client";
import { compressImageByHalf } from "@/lib/compress-image";
import { neonApi } from "@/lib/neon-api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "My profile - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});
function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void neonApi("/api/me")
      .then((r) => r.json())
      .then((me) => {
        setName(me.name || "");
        setEmail(me.email || "");
        setAvatar(me.avatarUrl || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load profile."));
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await authClient.updateUser({ name: name.trim() });
      if (updated.error)
        throw new Error(updated.error.message || "Neon Auth could not update the profile.");
      if (file) {
        const compressed = await compressImageByHalf(file);
        const response = await neonApi("/api/me/photo", {
          method: "POST",
          headers: { "Content-Type": compressed.type },
          body: compressed,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not update profile image.");
        setAvatar(data.avatarUrl);
        setFile(null);
      }
      setMessage("Profile saved. Contact a school administrator to change the sign-in email.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PortalShell eyebrow="Your account" title="My profile">
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
      <form onSubmit={(e) => void save(e)} className="max-w-xl border border-ink/10 bg-paper p-6">
        <div className="mb-6 flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt="Profile"
              className="h-20 w-20 rounded-full border border-ink/10 object-cover"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-ink text-xl font-bold text-paper">
              {name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <label className="text-sm">
            Profile photo
            <input
              className={`${inputCls} mt-1`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        <label className="mb-4 block text-sm">
          Full name
          <input
            required
            minLength={2}
            maxLength={120}
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mb-5 block text-sm">
          Sign-in email
          <input readOnly type="email" className={inputCls} value={email} />
        </label>
        <button className={btn()} disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
    </PortalShell>
  );
}
