import {createFileRoute} from "@tanstack/react-router";
import {useEffect,useMemo,useState} from "react";
import {PortalShell} from "@/components/PortalShell";
import {neonApi} from "@/lib/neon-api";
import {btn,inputCls,tdCls,thCls} from "@/components/portal-ui";
type Status="Present"|"Absent"|"Late"|"Excused"|null;
type Row={id:string;adm:string;first:string;last:string;class:string;stream:string;status:Status};
type SchoolClass={id:string;name:string;streams:string[]};
export const Route=createFileRoute("/attendance")({head:()=>({meta:[{title:"Attendance - Shule Yetu"},{name:"robots",content:"noindex"}]}),component:AttendancePage});
function AttendancePage(){
  const [rows,setRows]=useState<Row[]>([]); const [classes,setClasses]=useState<SchoolClass[]>([]); const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [className,setClassName]=useState(""); const [stream,setStream]=useState(""); const [error,setError]=useState(""); const [saving,setSaving]=useState("");
  async function load(){try{const params=new URLSearchParams({date,class:className,stream});const [r,cr]=await Promise.all([neonApi(`/api/attendance?${params}`),neonApi("/api/classes")]);setRows(await r.json());setClasses(await cr.json());setError("")}catch(e){setError(e instanceof Error?e.message:"Could not load attendance.")}}
  useEffect(()=>{void load()},[date,className,stream]);
  const selected=classes.find(c=>c.name===className); const totals=useMemo(()=>rows.reduce((a,r)=>{if(r.status)a[r.status]++;return a},{Present:0,Absent:0,Late:0,Excused:0}),[rows]);
  async function setStatus(row:Row,status:string){setSaving(row.id);setError("");try{await neonApi("/api/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:row.id,status,date})});setRows(old=>old.map(x=>x.id===row.id?{...x,status:status as Status}:x))}catch(e){setError(e instanceof Error?e.message:"Could not save attendance.")}finally{setSaving("")}}
  return <PortalShell eyebrow="Register" title="Attendance" actions={<button className={`${btn("ghost")} print:hidden`} onClick={()=>window.print()}>Print attendance</button>}>
    <div className="mb-5 flex flex-wrap items-end gap-3 print:hidden"><p className="mr-auto max-w-xl text-sm text-ink-soft">Mark and review daily attendance by date, class, and stream.</p><label className="text-sm">Date<input type="date" className={inputCls} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="text-sm">Class<select className={inputCls} value={className} onChange={e=>{setClassName(e.target.value);setStream("")}}><option value="">All classes</option>{classes.map(c=><option key={c.id}>{c.name}</option>)}</select></label><label className="text-sm">Stream<select className={inputCls} disabled={!className} value={stream} onChange={e=>setStream(e.target.value)}><option value="">All streams</option>{(selected?.streams||[]).map(s=><option key={s}>{s}</option>)}</select></label></div>
    {error&&<p role="alert" className="mb-4 text-sm text-owed">{error}</p>}
    <h2 className="mb-4 hidden font-semibold print:block">Attendance for {new Date(`${date}T00:00:00`).toLocaleDateString()} {className&&`- ${className}`} {stream&&`- ${stream}`}</h2>
    <div className="mb-5 grid gap-3 sm:grid-cols-4 print:hidden">{Object.entries(totals).map(([k,v])=><div key={k} className="border border-ink/10 bg-paper p-4"><div className="eyebrow text-[10px] text-ink-soft">{k}</div><div className="font-display text-2xl">{v}</div></div>)}</div>
    <div className="overflow-x-auto border border-ink/10 bg-paper"><table className="w-full text-sm"><thead><tr>{["Admission","Student","Class","Stream","Attendance"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td className={tdCls}>{r.adm}</td><td className={`${tdCls} font-semibold`}>{r.first} {r.last}</td><td className={tdCls}>{r.class||"-"}</td><td className={tdCls}>{r.stream||"-"}</td><td className={tdCls}><select aria-label={`Attendance for ${r.first} ${r.last}`} className="border border-input bg-paper px-2 py-1 print:hidden" disabled={saving===r.id} value={r.status||""} onChange={e=>void setStatus(r,e.target.value)}><option value="">Not marked</option><option>Present</option><option>Absent</option><option>Late</option><option>Excused</option></select><span className="hidden print:inline">{r.status||"Not marked"}</span></td></tr>)}{!rows.length&&<tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-soft">No active students match these filters.</td></tr>}</tbody></table></div>
  </PortalShell>
}
