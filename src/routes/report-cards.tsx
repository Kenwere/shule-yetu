import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { PortalShell } from "@/components/PortalShell";
import { Label, Panel, PrintButton, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { classes, className, learnerName, learners, seedMarks, termTotals } from "@/lib/mock-school";

export const Route = createFileRoute("/report-cards")({
  head: () => ({
    meta: [
      { title: "Report cards — St John's Academy" },
      { name: "description", content: "Printable learner report cards with term performance charts." },
      { property: "og:title", content: "Report cards — St John's Academy" },
      { property: "og:description", content: "Printable learner report cards with term performance charts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportCards,
});

const marks = seedMarks();
const grade = (s: number) => (s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : s >= 40 ? "D" : "E");

function ReportCards() {
  const active = learners.filter((l) => l.status === "Active");
  const [adm, setAdm] = useState(active[0].adm);
  const l = learners.find((x) => x.adm === adm)!;
  const cls = classes.find((c) => c.id === l.classId)!;
  const mine = marks.filter((m) => m.adm === adm && m.status === "Approved");

  return (
    <PortalShell eyebrow="Academics" title="Report cards" actions={<PrintButton label="Print card" />}>
      <div className="mb-4 max-w-xs print:hidden">
        <Label text="Learner"><select className={inputCls} value={adm} onChange={(e) => setAdm(e.target.value)}>{active.map((x) => <option key={x.adm} value={x.adm}>{learnerName(x)} · {x.adm}</option>)}</select></Label>
      </div>
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/10 pb-4">
          <div><div className="font-display text-3xl uppercase">St John's Academy</div><div className="eyebrow text-ink-soft">Learner report card · 2026</div></div>
          <div className="text-right text-sm"><b>{learnerName(l)}</b><br />{l.adm} · {className(l.classId)} {l.stream}</div>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <table className="w-full text-sm">
            <thead><tr>{["Subject", "Score", "Grade"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {cls.subjects.map((s) => {
                const sc = mine.filter((m) => m.subject === s).at(-1)?.score;
                return <tr key={s}><td className={tdCls}>{s}</td><td className={tdCls}>{sc ?? "—"}</td><td className={`${tdCls} font-semibold`}>{sc != null ? grade(sc) : "—"}</td></tr>;
              })}
            </tbody>
          </table>
          <div>
            <div className="eyebrow mb-2 text-ink-soft">Total marks by term</div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={termTotals[adm]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="term" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Bar dataKey="total" fill="var(--color-ink)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div className="border border-ink/10 p-3"><div className="eyebrow text-[10px] text-ink-soft">Class teacher's remarks</div><div className="mt-6 border-b border-ink/30" /></div>
          <div className="border border-ink/10 p-3"><div className="eyebrow text-[10px] text-ink-soft">Principal's remarks</div><div className="mt-6 border-b border-ink/30" /></div>
        </div>
      </Panel>
    </PortalShell>
  );
}
