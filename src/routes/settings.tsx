import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { neonApi } from "@/lib/neon-api";
import { compressImageByHalf } from "@/lib/compress-image";
import { btn, inputCls } from "@/components/portal-ui";
type Profile = {
  school_name: string;
  school_type: string;
  contact_email: string;
  phone: string;
  address: string;
  website: string;
  motto: string;
  vision: string;
  academicYear: string;
  activeTerm: string;
  term1StartDate: string;
  term1EndDate: string;
  term2StartDate: string;
  term2EndDate: string;
  term3StartDate: string;
  term3EndDate: string;
  logoUrl?: string;
};
const blank: Profile = {
  school_name: "",
  school_type: "",
  contact_email: "",
  phone: "",
  address: "",
  website: "",
  motto: "",
  vision: "",
  academicYear: "",
  activeTerm: "",
  term1StartDate: "",
  term1EndDate: "",
  term2StartDate: "",
  term2EndDate: "",
  term3StartDate: "",
  term3EndDate: "",
  logoUrl: "",
};
export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "School settings - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});
function SettingsPage() {
  const [form, setForm] = useState<Profile>(blank);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void neonApi("/api/school-profile")
      .then((r) => r.json())
      .then((p) => {
        if (p) setForm(normalizeProfile(p));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load school settings."))
      .finally(() => setBusy(false));
  }, []);
  function normalizeProfile(profile: Partial<Profile>): Profile {
    const dates = [
      "term1StartDate",
      "term1EndDate",
      "term2StartDate",
      "term2EndDate",
      "term3StartDate",
      "term3EndDate",
    ] as const;
    return {
      ...blank,
      ...profile,
      ...Object.fromEntries(dates.map((key) => [key, String(profile[key] || "").slice(0, 10)])),
    } as Profile;
  }
  function update(key: keyof Profile, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > 5 * 1024 * 1024) {
      setError("School logo must be 5 MB or smaller.");
      return;
    }
    setLogoBusy(true);
    try {
      const compressed = await compressImageByHalf(file);
      const r = await neonApi("/api/school-profile/logo", {
        method: "POST",
        headers: { "Content-Type": compressed.type },
        body: compressed,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not upload logo.");
      setForm((old) => ({ ...old, logoUrl: d.logoUrl }));
      setMessage("School logo uploaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload logo.");
    } finally {
      setLogoBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const r = await neonApi("/api/school-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: form.school_name,
          schoolType: form.school_type,
          email: form.contact_email,
          phone: form.phone,
          address: form.address,
          website: form.website,
          motto: form.motto,
          vision: form.vision,
          academicYear: form.academicYear,
          activeTerm: form.activeTerm,
          term1StartDate: form.term1StartDate,
          term1EndDate: form.term1EndDate,
          term2StartDate: form.term2StartDate,
          term2EndDate: form.term2EndDate,
          term3StartDate: form.term3StartDate,
          term3EndDate: form.term3EndDate,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save settings.");
      setForm((old) => normalizeProfile({ ...old, ...data, logoUrl: old.logoUrl }));
      setMessage(
        data.generatedFees
          ? "Settings saved. " +
              data.generatedFees +
              " active student fee obligations were created for " +
              data.activeTerm +
              " " +
              data.academicYear +
              "."
          : "School settings saved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }
  const fields: [keyof Profile, string, string?][] = [
    ["school_name", "School name"],
    ["school_type", "School type"],
    ["contact_email", "Contact email", "email"],
    ["phone", "Phone", "tel"],
    ["address", "Address / location"],
    ["website", "Website", "url"],
    ["motto", "Motto"],
  ];
  return (
    <PortalShell eyebrow="Administration" title="School settings">
      <p className="mb-5 max-w-2xl text-sm text-ink-soft">
        Manage school identity, academic year, and term dates. Changing the active term
        automatically posts one fee obligation per active student, based on their class and stream
        fees.
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
      <form onSubmit={save} className="max-w-4xl space-y-6">
        {busy ? (
          <p className="text-sm text-ink-soft">Loading school details...</p>
        ) : (
          <>
            <section className="border border-ink/10 bg-paper p-6">
              <h2 className="eyebrow mb-5 text-ink-soft">School details</h2>
              <div className="mb-5 flex flex-wrap items-center gap-4">
                <div>
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="School logo preview"
                      className="h-20 w-20 rounded border border-ink/10 bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center border border-dashed border-ink/30 text-xs text-ink-soft">
                      No logo
                    </div>
                  )}
                </div>
                <label className="block text-sm">
                  School logo (JPG, PNG, WEBP · max 5 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={inputCls}
                    disabled={logoBusy}
                    onChange={(e) => {
                      void uploadLogo(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                  {logoBusy && <span className="text-xs">Uploading…</span>}
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(([key, label, type]) => (
                  <label key={key} className="block">
                    <span className="eyebrow text-[10px] text-ink-soft">{label}</span>
                    <input
                      required={key === "school_name"}
                      type={type || "text"}
                      className={inputCls}
                      value={String(form[key] || "")}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label className="mt-4 block">
                <span className="eyebrow text-[10px] text-ink-soft">Vision</span>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.vision}
                  onChange={(e) => update("vision", e.target.value)}
                />
              </label>
            </section>
            <section className="border border-ink/10 bg-paper p-6">
              <h2 className="eyebrow mb-5 text-ink-soft">Academic calendar</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Academic year
                  <input
                    required={!!form.activeTerm}
                    pattern="20[0-9]{2}"
                    placeholder="2027"
                    className={inputCls}
                    value={form.academicYear}
                    onChange={(e) => update("academicYear", e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Active term
                  <select
                    className={inputCls}
                    value={form.activeTerm}
                    onChange={(e) => update("activeTerm", e.target.value)}
                  >
                    <option value="">Select term</option>
                    <option>Term 1</option>
                    <option>Term 2</option>
                    <option>Term 3</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 space-y-4">
                {([1, 2, 3] as const).map((term) => {
                  const a = ("term" + term + "StartDate") as keyof Profile,
                    b = ("term" + term + "EndDate") as keyof Profile;
                  return (
                    <div
                      key={term}
                      className="grid gap-4 border-t border-ink/10 pt-4 sm:grid-cols-[120px_1fr_1fr]"
                    >
                      <h3 className="eyebrow pt-2 text-ink-soft">Term {term}</h3>
                      <label className="block text-sm">
                        Start date
                        <input
                          type="date"
                          className={inputCls}
                          value={String(form[a] || "")}
                          onChange={(e) => update(a, e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        End date
                        <input
                          type="date"
                          className={inputCls}
                          value={String(form[b] || "")}
                          onChange={(e) => update(b, e.target.value)}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-ink-soft">
                Term changes are protected against duplicate fee obligations. Existing ledger rows
                and outstanding balances are preserved.
              </p>
            </section>
          </>
        )}
        <button className={btn()} disabled={busy || saving}>
          {saving ? "Saving..." : "Save school settings"}
        </button>
      </form>
    </PortalShell>
  );
}
