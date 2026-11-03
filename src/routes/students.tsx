import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Flash, Label, Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type Student = { id: string; adm: string; first: string; last: string; gender: string; dob: string | null; class: string; stream: string; guardian: string; phone: string; address: string; admitted: string; status: "Active" | "Inactive" | "Completed" };
const empty: Student = { id:"",adm:"",first:"",last:"",gender:"",dob:"",class:"",stream:"",guardian:"",phone:"",address:"",admitted:"",status:"Active" };
const td="border-t border-ink/10 px-4 py-3";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students — Shule Yetu" }, { name: "description", content: "School student register and individual profiles." }, { name: "robots", content: "noindex" }] }),
  component: StudentsPage,
});

function StudentsPage() {
  const [list,setList]=useState<Student[]>([]); const [q,setQ]=useState(""); const [filter,setFilter]=useState("All");
  const [form,setForm]=useState<Student|null>(null); const [flash,setFlash]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function load(){try{const r=await neonApi("/api/students");setList(await r.json());setError("")}catch(e){setError(e instanceof Error?e.message:"Could not load students.")}}
  useEffect(()=>{void load()},[]);
  const rows=useMemo(()=>list.filter(s=>(filter==="All"||s.status===filter)&&`${s.first} ${s.last} ${s.adm} ${s.class}`.toLowerCase().includes(q.toLowerCase())),[list,filter,q]);
  async function save(e:FormEvent){e.preventDefault();if(!form)return;setBusy(true);setFlash("");try{await neonApi("/api/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});setFlash(`${form.first} ${form.last} saved.`);setForm(null);await load()}catch(err){setError(err instanceof Error?err.message:"Could not save student.")}finally{setBusy(false)}}
  async function remove(student:Student){if(!window.confirm(`Delete ${student.first} ${student.last} and their fee history?`))return;try{await neonApi(`/api/students/${student.id}`,{method:"DELETE"});setFlash(`${student.first} ${student.last} removed.`);await load()}catch(e){setError(e instanceof Error?e.message:"Could not remove student.")}}
  return <PortalShell eyebrow="Register" title="Students" actions={<button className={btn()} onClick={()=>setForm({...empty})}>Add student</button>}>
    <Flash message={flash||null}/>{error&&<p role="alert" className="mb-4 text-sm text-owed">{error}</p>}
    <div className="mb-4 grid gap-4 sm:grid-cols-3">{(["Active","Inactive","Completed"] as const).map(s=><div key={s} className="border border-ink/10 bg-paper p-4"><div className="eyebrow text-[10px]">{s} students</div><div className="mt-1 font-display text-3xl">{list.filter(x=>x.status===s).length}</div></div>)}</div>
    {form&&<Panel title={form.id?`Edit ${form.adm}`:"New student"} className="mb-6"><form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
      <Label text="Admission number"><input className={inputCls} value={form.adm} onChange={e=>setForm({...form,adm:e.target.value})} placeholder="Assigned automatically if blank"/></Label>
      <Label text="First name"><input required className={inputCls} value={form.first} onChange={e=>setForm({...form,first:e.target.value})}/></Label><Label text="Last name"><input required className={inputCls} value={form.last} onChange={e=>setForm({...form,last:e.target.value})}/></Label>
      <Label text="Gender"><input className={inputCls} value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}/></Label><Label text="Date of birth"><input type="date" className={inputCls} value={form.dob||""} onChange={e=>setForm({...form,dob:e.target.value})}/></Label>
      <Label text="Class"><input className={inputCls} value={form.class} onChange={e=>setForm({...form,class:e.target.value})}/></Label><Label text="Stream"><input className={inputCls} value={form.stream} onChange={e=>setForm({...form,stream:e.target.value})}/></Label>
      <Label text="Guardian"><input className={inputCls} value={form.guardian} onChange={e=>setForm({...form,guardian:e.target.value})}/></Label><Label text="Guardian phone"><input className={inputCls} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Label><Label text="Address"><input className={inputCls} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Label>
      <Label text="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value as Student["status"]})}><option>Active</option><option>Inactive</option><option>Completed</option></select></Label>
      <div className="flex gap-2 sm:col-span-3"><button className={btn()} disabled={busy}>{busy?"Saving…":"Save student"}</button><button type="button" className={btn("ghost")} onClick={()=>setForm(null)}>Cancel</button></div>
    </form></Panel>}
    <div className="mb-3 flex flex-wrap gap-2"><input className={`${inputCls} max-w-xs`} placeholder="Search name, admission no. or class" value={q} onChange={e=>setQ(e.target.value)}/>{["All","Active","Inactive","Completed"].map(s=><button key={s} onClick={()=>setFilter(s)} className={btn(filter===s?"primary":"ghost")}>{s}</button>)}</div>
    <div className="overflow-x-auto border border-ink/10 bg-paper"><table className="w-full text-left text-sm"><thead><tr>{["Adm","Name","Class","Guardian","Status","Actions"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead><tbody>
      {rows.map(s=><tr key={s.id}><td className={`${td} font-mono text-xs`}>{s.adm}</td><td className={`${td} font-semibold`}><Link className="underline decoration-gold underline-offset-4" to="/students/$studentId" params={{studentId:s.id}}>{s.first} {s.last}</Link></td><td className={td}>{s.class} {s.stream}</td><td className={td}>{s.guardian}{s.phone?` · ${s.phone}`:""}</td><td className={td}>{s.status}</td><td className={`${td} whitespace-nowrap`}><button className={btn("ghost")} onClick={()=>setForm({...s})}>Edit</button> <button className={btn("bad")} onClick={()=>void remove(s)}>Delete</button></td></tr>)}
      {!rows.length&&<tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-soft">{error?"Students could not be loaded.":"No students yet. Add a student to begin the register."}</td></tr>}
    </tbody></table></div>
  </PortalShell>
}