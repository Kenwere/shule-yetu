import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Flash, Label, Panel, PrintButton, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { classes, className, exams as seedExams, learnerName, learners, seedMarks, type Exam, type Mark } from "@/lib/mock-school";

export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [
      { title: "Exams & marks — St John's Academy" },
      { name: "description", content: "Create exams, approve marks and print ranked exam reports." },
      { property: "og:title", content: "Exams & marks — St John's Academy" },
      { property: "og:description", content: "Create exams, approve marks and print ranked exam reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamsPage,
});

const statusCls = { Pending: "bg-gold/20", Approved: "bg-collected-soft text-collected", Denied: "bg-owed-soft text-owed" };

function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>(seedExams);
  const [marks, setMarks] = useState<Mark[]>(seedMarks);
  const [examId, setExamId] = useState("e1");
  const [flash, setFlash] = useState<string | null>(null);
  const [ne, setNe] = useState({ name: "", classId: "g7", stream: "East", term: "Term 3", start: "", end: "" });
  const exam = exams.find((e) => e.id === examId)!;
  const cls = classes.find((c) => c.id === exam.classId)!;
  const em = marks.filter((m) => m.examId === examId);

  const update = (pred: (m: Mark) => boolean, patch: Partial<Mark>) => setMarks((ms) => ms.map((m) => (pred(m) ? { ...m, ...patch } : m)));

  const ranked = useMemo(() => {
    const roster = learners.filter((l) => l.classId === exam.classId && l.stream === exam.stream && l.status === "Active");
    return roster
      .map((l) => {
        const scores = Object.fromEntries(cls.subjects.map((s) => [s, em.find((m) => m.adm === l.adm && m.subject === s && m.status === "Approved")?.score]));
        const total = Object.values(scores).reduce<number>((a, b) => a + (b ?? 0), 0);
        return { l, scores, total, mean: total / cls.subjects.length };
      })
      .sort((a, b) => b.total - a.total);
  }, [em, exam, cls]);

  return (
    <PortalShell eyebrow="Academics" title="Exams & marks">
      <Flash message={flash} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Exams" className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead><tr>{["Exam", "Class", "Term", "Dates", "Pending", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id} className={e.id === examId ? "bg-gold/10" : ""}>
                  <td className={`${tdCls} font-semibold`}>{e.name}</td><td className={tdCls}>{className(e.classId)} {e.stream}</td><td className={tdCls}>{e.term} {e.year}</td><td className={tdCls}>{e.start} → {e.end}</td>
                  <td className={tdCls}>{marks.filter((m) => m.examId === e.id && m.status === "Pending").length}</td>
                  <td className={tdCls}><button className={btn("ghost")} onClick={() => setExamId(e.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Create exam">
          <form className="space-y-2" onSubmit={(e) => {
            e.preventDefault();
            if (!ne.name || !ne.start || !ne.end || ne.end < ne.start) return setFlash("Give a name and valid start/end dates.");
            const id = `e${Date.now()}`;
            setExams([...exams, { id, ...ne, year: 2026 }]);
            const c = classes.find((x) => x.id === ne.classId)!;
            const roster = learners.filter((l) => l.classId === ne.classId && l.stream === ne.stream && l.status === "Active");
            setMarks([...marks, ...roster.flatMap((l) => c.subjects.map((s) => ({ examId: id, adm: l.adm, subject: s, score: 0, status: "Pending" as const, locked: false, teacher: "—" })))]);
            setExamId(id); setFlash(`${ne.name} created.`);
          }}>
            <Label text="Name"><input className={inputCls} value={ne.name} onChange={(e) => setNe({ ...ne, name: e.target.value })} /></Label>
            <div className="grid grid-cols-2 gap-2">
              <Label text="Class"><select className={inputCls} value={ne.classId} onChange={(e) => { const c = classes.find((x) => x.id === e.target.value)!; setNe({ ...ne, classId: c.id, stream: c.streams[0] }); }}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label>
              <Label text="Stream"><select className={inputCls} value={ne.stream} onChange={(e) => setNe({ ...ne, stream: e.target.value })}>{classes.find((c) => c.id === ne.classId)!.streams.map((s) => <option key={s}>{s}</option>)}</select></Label>
              <Label text="Start"><input type="date" className={inputCls} value={ne.start} onChange={(e) => setNe({ ...ne, start: e.target.value })} /></Label>
              <Label text="End"><input type="date" className={inputCls} value={ne.end} onChange={(e) => setNe({ ...ne, end: e.target.value })} /></Label>
            </div>
            <Label text="Term"><select className={inputCls} value={ne.term} onChange={(e) => setNe({ ...ne, term: e.target.value })}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></Label>
            <button className={btn()}>Create</button>
          </form>
        </Panel>
      </div>

      <Panel title={`Marks · ${exam.name} · ${cls.name} ${exam.stream}`} className="mt-6" action={
        <button className={btn("good")} onClick={() => { update((m) => m.examId === examId && m.status === "Pending", { status: "Approved", locked: true }); setFlash("All pending marks approved and locked."); }}>Approve all</button>
      }>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Learner", "Subject", "Score", "Teacher", "Status", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {em.map((m) => {
                const key = (x: Mark) => x.examId === m.examId && x.adm === m.adm && x.subject === m.subject;
                const l = learners.find((x) => x.adm === m.adm)!;
                return (
                  <tr key={m.adm + m.subject}>
                    <td className={tdCls}>{learnerName(l)}</td><td className={tdCls}>{m.subject}</td>
                    <td className={tdCls}><input type="number" min={0} max={100} disabled={m.locked} value={m.score} className={`${inputCls} w-20 py-1`} onChange={(e) => update(key, { score: Math.max(0, Math.min(100, Number(e.target.value))), status: "Pending" })} /></td>
                    <td className={tdCls}>{m.teacher}</td>
                    <td className={tdCls}><span className={`px-2 py-0.5 text-xs ${statusCls[m.status]}`}>{m.status}{m.locked ? " · locked" : ""}</span></td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      <button className={btn("good")} onClick={() => update(key, { status: "Approved", locked: true })}>✓</button>{" "}
                      <button className={btn("bad")} onClick={() => update(key, { status: "Denied", locked: false })}>✕</button>{" "}
                      <button className={btn("ghost")} onClick={() => update(key, { locked: !m.locked })}>{m.locked ? "Unlock" : "Lock"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Ranked report · ${exam.name}`} className="mt-6" action={<PrintButton label="Print report" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={thCls}>Pos</th><th className={thCls}>Learner</th>{cls.subjects.map((s) => <th key={s} className={thCls}>{s.slice(0, 4)}</th>)}<th className={thCls}>Total</th><th className={thCls}>Mean</th></tr></thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.l.adm}><td className={`${tdCls} font-display text-lg`}>{i + 1}</td><td className={`${tdCls} font-semibold`}>{learnerName(r.l)}</td>
                  {cls.subjects.map((s) => <td key={s} className={tdCls}>{r.scores[s] ?? "—"}</td>)}
                  <td className={`${tdCls} font-semibold`}>{r.total}</td><td className={tdCls}>{r.mean.toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Only approved marks count towards the ranking.</p>
      </Panel>
    </PortalShell>
  );
}
