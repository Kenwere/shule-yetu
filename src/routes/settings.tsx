import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { schoolInfo } from "@/lib/school-info";
import { NeonBackendTools } from "@/components/NeonBackendTools";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "School settings — Shule Yetu" },
      { name: "description", content: "School settings for Shule Yetu." },
      { property: "og:title", content: "School settings — Shule Yetu" },
      { property: "og:description", content: "School settings for Shule Yetu." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function Text({
  label,
  value,
  area,
}: {
  label: string;
  value: string;
  area?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-[10px] text-ink-soft">{label}</span>
      {area ? (
        <textarea
          defaultValue={value}
          rows={3}
          className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
        />
      ) : (
        <input
          defaultValue={value}
          className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
        />
      )}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-ink/10 bg-paper p-6">
      <h2 className="eyebrow mb-5 text-ink-soft">{title}</h2>
      {children}
    </section>
  );
}

function SettingsPage() {
  const [saved, setSaved] = useState(false);

  return (
    <PortalShell
      eyebrow="Administration"
      title="School settings"
      actions={
        saved ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-collected">
            Saved (sample data)
          </span>
        ) : undefined
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="space-y-6"
      >
        <Section title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="School name" value={schoolInfo.name} />
            <Text label="Motto" value={schoolInfo.motto} />
          </div>
          <div className="mt-4">
            <Text label="Vision statement" value={schoolInfo.vision} area />
          </div>
          <div className="mt-4 flex items-center gap-4 border border-dashed border-ink/20 p-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center bg-ink font-display text-lg text-gold">
              SY
            </div>
            <div className="text-sm text-ink-soft">
              School logo — upload is not wired up yet, so the crest above stays.
            </div>
          </div>
        </Section>

        <Section title="Contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Email" value={schoolInfo.contact.email} />
            <Text label="Phone" value={schoolInfo.contact.phone} />
            <Text label="Office hours" value={schoolInfo.contact.hours} />
            <Text label="Address" value={schoolInfo.contact.address} />
          </div>
        </Section>

        <Section title="Academic calendar">
          <div className="grid gap-4 sm:grid-cols-3">
            <Text label="Academic year" value="2026" />
            <Text label="Active term" value="Term 2" />
            <Text label="Currency" value="KES" />
          </div>
          <div className="mt-6 overflow-x-auto border border-ink/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink text-paper">
                <tr>
                  <th className="px-4 py-3 font-semibold">Term</th>
                  <th className="px-4 py-3 font-semibold">Starts</th>
                  <th className="px-4 py-3 font-semibold">Ends</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { term: "Term 1", starts: "Jan 6, 2026", ends: "Apr 3, 2026" },
                  { term: "Term 2", starts: "May 4, 2026", ends: "Aug 7, 2026" },
                  { term: "Term 3", starts: "Sep 1, 2026", ends: "Dec 11, 2026" },
                ].map((t) => (
                  <tr key={t.term} className="border-t border-ink/10">
                    <td className="px-4 py-3 font-semibold">{t.term}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.starts}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.ends}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Changing the active term would normally open a fee obligation for every active learner
            at their class fee — that rule lands with the real database.
          </p>
        </Section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="bg-ink px-6 py-3 font-bold uppercase tracking-wide text-paper hover:bg-ink-soft"
          >
            Save settings
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
            Sample data · nothing is stored yet
          </span>
        </div>
      </form>
      <div className="mt-8"><NeonBackendTools /></div>
    </PortalShell>
  );
}
