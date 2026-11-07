import type { ReactNode } from "react";

type Student = {
  id: string;
  adm: string;
  first: string;
  last: string;
  class: string;
  stream: string;
  gender?: string;
  dob?: string;
  guardian?: string;
  phone?: string;
};
type Mark = {
  exam: string;
  term: string;
  academicYear: string;
  subject: string;
  score: number;
  position: number;
  total: number;
  classSize: number;
  schoolName: string;
};
type CardStudent = Student & {
  schoolName: string;
  motto?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  schoolAddress?: string;
  photoUrl?: string;
  logoUrl?: string;
};

export function StudentReportCard({
  student,
  schoolName,
  logoUrl,
  detail,
  marks,
  attendance,
  remarks,
  ratings,
  onRemark,
  onRating,
}: {
  student: Student;
  schoolName: string;
  logoUrl: string;
  detail: CardStudent | null;
  marks: Mark[];
  attendance: { present: number; absent: number; late: number };
  remarks: Record<string, string>;
  ratings: Record<string, string>;
  onRemark: (key: string, value: string) => void;
  onRating: (key: string, value: string) => void;
}) {
  const terms = [...new Map(marks.map((mark) => [`${mark.term} ${mark.academicYear}`, mark])).keys()];
  const selectedTerm = terms.at(-1) || "No approved results";
  const rows = marks.filter((mark) => `${mark.term} ${mark.academicYear}` === selectedTerm);
  const total = rows.reduce((sum, mark) => sum + Number(mark.score), 0);
  const average = rows.length ? total / rows.length : 0;
  const current = rows[0];
  const grade = (score: number) =>
    score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 40 ? "D" : "E";
  const domain = (title: string, items: string[], prefix: string) => (
    <section className="rc-box border border-black">
      <h4 className="rc-band border-b border-black bg-stone-300 px-1 py-1 text-center font-bold uppercase">{title}</h4>
      {items.map((item) => {
        const key = `${prefix}:${item}`;
        return (
          <div key={item} className="flex items-center justify-between border-b border-black/30 px-1 py-1 last:border-0">
            <span>{item}</span>
            <select className="rc-screen max-w-[54px] border border-black/30 bg-white" aria-label={`${item} rating`} value={ratings[key] || ""} onChange={(event) => onRating(key, event.target.value)}>
              <option value="">—</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <b className="rc-print hidden">{ratings[key] || "—"}</b>
          </div>
        );
      })}
    </section>
  );
  const remarkBox = (title: string, key: string, placeholder: string): ReactNode => (
    <section className="rc-box border border-black p-2">
      <b>{title}</b>
      <textarea className="rc-screen mt-1 min-h-12 w-full border border-black/30 p-1" value={remarks[key] || ""} onChange={(event) => onRemark(key, event.target.value)} placeholder={placeholder} />
      <div className="rc-print hidden min-h-8 border-b border-black/50">{remarks[key]}</div>
      <div className="mt-2 flex justify-between"><span>Teacher name/sign:</span><span>________________</span></div>
    </section>
  );

  return (
    <>
      <style>{`@page{size:A4 portrait;margin:7mm}@media print{body{background:white!important}.report-card{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;font-size:8pt!important;box-shadow:none!important}.report-card table{font-size:7pt!important}.report-card th,.report-card td{padding:2px 3px!important}.report-card .rc-box{border:1px solid #333!important}.report-card .rc-band{background:#d1d1d1!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-card .rc-print{display:block!important}.report-card .rc-screen{display:none!important}}`}</style>
      <article className="report-card mx-auto max-w-[900px] border border-black/30 bg-white p-5 text-black shadow-sm">
        <header className="grid grid-cols-[72px_1fr_72px] items-center gap-3 border-b-2 border-black pb-2 text-center">
          <div className="flex h-[68px] items-center justify-center">{(detail?.logoUrl || logoUrl) && <img src={detail?.logoUrl || logoUrl} alt="School crest" className="max-h-full max-w-full object-contain" />}</div>
          <div>
            <h2 className="font-display text-xl font-bold uppercase leading-tight">{detail?.schoolName || schoolName || "Shule Yetu"}</h2>
            {detail?.motto && <p className="text-[10px] font-semibold">Motto: {detail.motto}</p>}
            <p className="text-[9px]">{detail?.schoolAddress}{detail?.schoolAddress && detail?.schoolPhone ? " · " : ""}{detail?.schoolPhone}</p>
            {detail?.schoolEmail && <p className="text-[9px]">{detail.schoolEmail}</p>}
          </div>
          <div className="flex h-[68px] items-center justify-center border border-black/20 bg-stone-100">{detail?.photoUrl ? <img src={detail.photoUrl} alt={`${student.first} ${student.last}`} className="h-full w-full object-cover" /> : <span className="px-1 text-[8px] text-black/60">Student photo</span>}</div>
        </header>
        <h3 className="rc-band my-2 border border-black bg-stone-300 py-1 text-center text-[11px] font-bold uppercase tracking-wide">{selectedTerm} — student performance report</h3>
        <div className="grid grid-cols-[1.25fr_1fr_0.85fr] gap-1.5 text-[9px]">
          <section className="rc-box border border-black">
            <h4 className="rc-band border-b border-black bg-stone-300 px-2 py-1 text-center font-bold uppercase">Personal data</h4>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 p-2"><b>Name:</b><span>{student.first} {student.last}</span><b>Adm no:</b><span>{student.adm}</span><b>Gender:</b><span>{detail?.gender || student.gender || "—"}</span><b>Class:</b><span>{student.class} {student.stream}</span><b>D.O.B:</b><span>{detail?.dob || student.dob || "—"}</span><b>Guardian:</b><span>{detail?.guardian || student.guardian || "—"}</span><b>Contact:</b><span>{detail?.phone || student.phone || "—"}</span></div>
          </section>
          <section className="rc-box border border-black">
            <h4 className="rc-band border-b border-black bg-stone-300 px-2 py-1 text-center font-bold uppercase">Attendance</h4>
            <div className="grid grid-cols-3 text-center">{[["School opened", attendance.present + attendance.absent + attendance.late], ["Present", attendance.present], ["Absent", attendance.absent]].map(([label, value]) => <div key={label} className="border-r border-black/50 p-2 last:border-0"><b className="block">{value}</b>{label}</div>)}</div>
            <div className="grid grid-cols-2 border-t border-black p-2"><b>Term:</b><span>{selectedTerm}</span><b>Late:</b><span>{attendance.late}</span></div>
          </section>
          <section className="rc-box border border-black">
            <h4 className="rc-band border-b border-black bg-stone-300 px-2 py-1 text-center font-bold uppercase">Performance summary</h4>
            <div className="grid grid-cols-[1fr_auto] gap-y-1 p-2"><span>Total obtainable</span><b>{rows.length * 100}</b><span>Total obtained</span><b>{total.toFixed(1)}</b><span>Average</span><b>{average.toFixed(1)}%</b><span>Grade</span><b>{rows.length ? grade(average) : "—"}</b><span>Position</span><b>{current?.position || "—"}</b><span>Class size</span><b>{current?.classSize || "—"}</b></div>
          </section>
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_190px] gap-1.5">
          <section className="rc-box border border-black">
            <h4 className="rc-band border-b border-black bg-stone-300 px-2 py-1 text-center text-[10px] font-bold uppercase">Cognitive domain — approved marks</h4>
            {terms.map((term) => <div key={term} className="mb-1">{terms.length > 1 && <p className="px-2 py-1 text-[9px] font-bold">{term}</p>}<table className="w-full border-collapse text-[9px]"><thead><tr>{["Subject", "Assessment", "Score / 100", "Grade"].map((head) => <th key={head} className="border border-black bg-stone-300 px-1 py-1 text-left">{head}</th>)}</tr></thead><tbody>{marks.filter((mark) => `${mark.term} ${mark.academicYear}` === term).map((mark, index) => <tr key={mark.exam + mark.subject + index}><td className="border border-black/70 px-1 py-1">{mark.subject}</td><td className="border border-black/70 px-1 py-1">{mark.exam}</td><td className="border border-black/70 px-1 py-1 text-center">{Number(mark.score).toFixed(1)}</td><td className="border border-black/70 px-1 py-1 text-center">{grade(Number(mark.score))}</td></tr>)}</tbody></table></div>)}
            {!marks.length && <p className="p-3 text-center text-[9px]">No approved exam marks are available yet.</p>}
          </section>
          <aside className="space-y-1.5 text-[8px]">{domain("Affective domain", ["Attentiveness", "Honesty", "Neatness", "Punctuality", "Self-control", "Confidence", "Obedience", "Responsibility", "Relationships"], "affective")}{domain("Psychomotor skills", ["Handling tools", "Drawing", "Handwriting", "Public speaking", "Speech fluency", "Sports and games"], "psychomotor")}<section className="rc-box border border-black p-1.5"><b>Grade scale</b><p>A 80–100 · B 65–79 · C 50–64</p><p>D 40–49 · E below 40</p></section></aside>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">{remarkBox("Class teacher’s remarks", student.id, "Enter remarks")}{remarkBox("Head teacher’s remarks", `${student.id}:head`, "Enter remarks")}</div>
        <footer className="mt-2 flex justify-between text-[8px] text-black/60"><span>{selectedTerm}</span><span>Shule Yetu · Student performance record</span></footer>
      </article>
    </>
  );
}
