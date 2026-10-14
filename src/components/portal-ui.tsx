import type { ReactNode } from "react";

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-ink/10 bg-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="eyebrow text-ink-soft">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Flash({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-4 border-l-4 border-collected bg-collected-soft px-4 py-3 text-sm text-collected print:hidden">
      {message}
    </div>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={btn("ghost")}>
      {label}
    </button>
  );
}

export function btn(kind: "primary" | "ghost" | "good" | "bad" = "primary") {
  const base = "px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-40 print:hidden";
  return {
    primary: `${base} bg-ink text-paper hover:bg-ink-soft`,
    ghost: `${base} border border-ink/20 hover:bg-ink/5`,
    good: `${base} bg-collected text-paper hover:opacity-90`,
    bad: `${base} bg-owed text-paper hover:opacity-90`,
  }[kind];
}

export const inputCls = "w-full border border-ink/20 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none";
export const thCls = "border-b border-ink/10 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft";
export const tdCls = "border-b border-ink/5 px-3 py-2";

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{text}</span>
      {children}
    </label>
  );
}
