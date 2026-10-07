import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";

export function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="relative overflow-hidden bg-ink">
        <div className="stripes absolute inset-0 opacity-10" />
        <div className="relative mx-auto max-w-md px-6 py-16">
          <div className="eyebrow mb-3 text-gold">{eyebrow}</div>
          <h1 className="mb-8 font-display text-5xl uppercase tracking-tight text-paper">{title}</h1>
          <div className="bg-paper p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-4 block">
      <span className="eyebrow text-[10px] text-ink-soft">{label}</span>
      <input {...props} className="mt-1 w-full border border-input bg-paper px-3 py-2 text-sm outline-none focus:border-gold" />
    </label>
  );
}

export const submitClass = "w-full bg-ink py-3 font-bold uppercase tracking-wide text-paper hover:bg-ink-soft";
