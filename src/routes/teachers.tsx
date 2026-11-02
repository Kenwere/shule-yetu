import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Flash, Label, Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { classes, className, teacherAssignments, teachers as seed, type Assignment } from "@/lib/mock-school";

export const Route = createFileRoute("/teachers")({
  head: () => ({
    meta: [
      { title: "Teachers — St John's Academy" },
      { name: "description", content: "Teachers and their class, stream and subject assignments." },
      { property: "og:title", content: "Teachers — St John's Academy" },
      { property: "og:description", content: "Teachers and their class, stream and subject assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeachersPage,
});

function TeachersPage() {
  const [list, setList] = useState(seed);
  const [assign, setAssign] = useState<Record<string, Assignment[]>>(teacherAssignments);
  const [sel, setSel] = useState("t1");
  const [flash, setFlash] = useState<string | null>(null);
  const [nt, setNt] = useState({ name: "", email: "", phone: "" });
  const [classId, setClassId] = useState(classes[0]!.id);
  const [stream, setStream] = useState(classes[0].streams[0] ?? "");
  const [subjects, setSubjects] = useState<string[]>([]);
  const cls = classes.find((c) => c.id === classId)!;
  const teacher = list.find((t) => t.id === sel);

  return (
    <PortalShell eyebrow="Staff" title="Teachers">
      <Flash message={flash} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="All teachers" className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead><tr>{["Name", "Email", "Phone", "Classes", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={sel === t.id ? "bg-gold/10" : ""}>
                  <td className={`${tdCls} font-semibold`}>{t.name}</td><td className={tdCls}>{t.email}</td><td className={tdCls}>{t.phone}</td>
                  <td className={tdCls}>{(assign[t.id] ?? []).length}</td>
                  <td className={tdCls}><button className={btn("ghost")} onClick={() => setSel(t.id)}>Assign</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Add teacher">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!nt.name || !nt.email.includes("@")) return setFlash("Name and a valid email are required."); const id = `t${Date.now()}`; setList([...list, { id, ...nt }]); setNt({ name: "", email: "", phone: "" }); setFlash(`${nt.name} added.`); }}>
            <Label text="Full name"><input className={inputCls} value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} /></Label>
            <Label text="Email"><input type="email" className={inputCls} value={nt.email} onChange={(e) => setNt({ ...nt, email: e.target.value })} /></Label>
            <Label text="Phone"><input className={inputCls} value={nt.phone} onChange={(e) => setNt({ ...nt, phone: e.target.value })} /></Label>
            <button className={btn()}>Add</button>
          </form>
        </Panel>
      </div>

      {teacher && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title={`Assignments · ${teacher.name}`} className="lg:col-span-2">
            {(assign[teacher.id] ?? []).length === 0 && <p className="text-sm text-ink-soft">No classes assigned yet.</p>}
            <div className="space-y-2">
              {(assign[teacher.id] ?? []).map((a, i) => (
                <div key={i} className="flex items-center justify-between border border-ink/10 p-3 text-sm">
                  <div><b>{className(a.classId)} {a.stream}</b> · {a.subjects.join(", ")}</div>
                  <button className={btn("bad")} onClick={() => setAssign({ ...assign, [teacher.id]: (assign[teacher.id] ?? []).filter((_, j) => j !== i) })}>Remove</button>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Assign class & subjects">
            <div className="space-y-3">
              <Label text="Class"><select className={inputCls} value={classId} onChange={(e) => { const c = classes.find((x) => x.id === e.target.value)!; setClassId(c.id); setStream(c.streams[0] ?? ""); setSubjects([]); }}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label>
              <Label text="Stream"><select className={inputCls} value={stream} onChange={(e) => setStream(e.target.value)}>{cls.streams.map((s) => <option key={s}>{s}</option>)}</select></Label>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {cls.subjects.map((s) => (
                  <label key={s} className="flex items-center gap-2"><input type="checkbox" checked={subjects.includes(s)} onChange={(e) => setSubjects(e.target.checked ? [...subjects, s] : subjects.filter((x) => x !== s))} />{s}</label>
                ))}
              </div>
              <button className={btn()} disabled={!subjects.length} onClick={() => { setAssign({ ...assign, [teacher.id]: [...(assign[teacher.id] ?? []), { classId, stream, subjects }] }); setSubjects([]); setFlash(`${teacher.name} assigned to ${cls.name} ${stream}.`); }}>Assign</button>
            </div>
          </Panel>
        </div>
      )}
    </PortalShell>
  );
}
