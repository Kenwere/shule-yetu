import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Flash, Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { classes as seed, kes, learners, type ClassDef } from "@/lib/mock-school";

export const Route = createFileRoute("/classes")({
  head: () => ({
    meta: [
      { title: "Classes & fees — St John's Academy" },
      { name: "description", content: "Set up classes, streams, subjects and term fees." },
      { property: "og:title", content: "Classes & fees — St John's Academy" },
      { property: "og:description", content: "Set up classes, streams, subjects and term fees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClassesPage,
});

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function ClassesPage() {
  const [list, setList] = useState<ClassDef[]>(seed);
  const [flash, setFlash] = useState<string | null>(null);
  const [nc, setNc] = useState({ name: "", streams: "", subjects: "", termFee: "", extraFee: "" });
  const [term, setTerm] = useState("Term 3");

  const patch = (id: string, p: Partial<ClassDef>) => setList((ls) => ls.map((c) => (c.id === id ? { ...c, ...p } : c)));

  function generate() {
    const active = learners.filter((l) => l.status === "Active");
    const total = active.reduce((s, l) => { const c = list.find((x) => x.id === l.classId); return s + (c ? c.termFee + c.extraFee : 0); }, 0);
    setFlash(`${term} fee obligations generated for ${active.length} active learners — ${kes(total)} in total.`);
  }

  return (
    <PortalShell eyebrow="Setup" title="Classes & fees">
      <Flash message={flash} />
      <Panel title="Classes, streams, subjects and fees">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Class", "Streams", "Subjects", "Term fee", "Extra fee", "Learners", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className={`${tdCls} font-semibold`}>{c.name}</td>
                  <td className={tdCls}><input className={inputCls} defaultValue={c.streams.join(", ")} onBlur={(e) => patch(c.id, { streams: csv(e.target.value) })} /></td>
                  <td className={tdCls}><input className={inputCls} defaultValue={c.subjects.join(", ")} onBlur={(e) => patch(c.id, { subjects: csv(e.target.value) })} /></td>
                  <td className={tdCls}><input type="number" min={0} className={`${inputCls} w-28`} value={c.termFee} onChange={(e) => patch(c.id, { termFee: Number(e.target.value) })} /></td>
                  <td className={tdCls}><input type="number" min={0} className={`${inputCls} w-24`} value={c.extraFee} onChange={(e) => patch(c.id, { extraFee: Number(e.target.value) })} /></td>
                  <td className={tdCls}>{learners.filter((l) => l.classId === c.id).length}</td>
                  <td className={tdCls}><button className={btn("bad")} onClick={() => { setList(list.filter((x) => x.id !== c.id)); setFlash(`${c.name} removed.`); }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Separate streams and subjects with commas.</p>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Add class">
          <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            if (!nc.name.trim()) return setFlash("Class name is required.");
            setList([...list, { id: `c${Date.now()}`, name: nc.name.trim(), streams: csv(nc.streams), subjects: csv(nc.subjects), termFee: Number(nc.termFee) || 0, extraFee: Number(nc.extraFee) || 0 }]);
            setFlash(`${nc.name} added.`); setNc({ name: "", streams: "", subjects: "", termFee: "", extraFee: "" });
          }}>
            <input className={inputCls} placeholder="Class name" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
            <input className={inputCls} placeholder="Streams (North, South)" value={nc.streams} onChange={(e) => setNc({ ...nc, streams: e.target.value })} />
            <input className={`${inputCls} sm:col-span-2`} placeholder="Subjects (English, Maths…)" value={nc.subjects} onChange={(e) => setNc({ ...nc, subjects: e.target.value })} />
            <input type="number" className={inputCls} placeholder="Term fee (KES)" value={nc.termFee} onChange={(e) => setNc({ ...nc, termFee: e.target.value })} />
            <input type="number" className={inputCls} placeholder="Extra fee (KES)" value={nc.extraFee} onChange={(e) => setNc({ ...nc, extraFee: e.target.value })} />
            <button className={btn()}>Add class</button>
          </form>
        </Panel>
        <Panel title="Generate term fee obligations">
          <p className="mb-3 text-sm text-ink-soft">Adds one fee row (term fee + extra fee for their class) to every active learner's ledger.</p>
          <div className="flex gap-2">
            <select className={`${inputCls} max-w-[10rem]`} value={term} onChange={(e) => setTerm(e.target.value)}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select>
            <button className={btn()} onClick={generate}>Generate</button>
          </div>
        </Panel>
      </div>
    </PortalShell>
  );
}
