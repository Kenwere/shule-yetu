type Student = {
  id: string; adm: string; first: string; last: string; class: string; stream: string;
  gender?: string; dob?: string; guardian?: string; phone?: string;
};
type Mark = {
  exam: string; term: string; academicYear: string; subject: string; score: number;
  position: number; total: number; classSize: number; schoolName: string;
};
type CardStudent = Student & {
  schoolName: string; motto?: string; schoolEmail?: string; schoolPhone?: string;
  schoolAddress?: string; photoUrl?: string; logoUrl?: string;
};

export function StudentReportCard({
  student, schoolName, logoUrl, detail, marks, attendance, remarks, onRemark,
}: {
  student: Student; schoolName: string; logoUrl: string; detail: CardStudent | null;
  marks: Mark[]; attendance: { present: number; absent: number; late: number };
  remarks: Record<string, string>;
  onRemark: (key: string, value: string) => void;
}) {
  const terms = [...new Set(marks.map((mark) => `${mark.term} ${mark.academicYear}`))];
  const selectedTerm = terms.at(-1) || "No approved results";
  const rows = marks.filter((mark) => `${mark.term} ${mark.academicYear}` === selectedTerm);
  const examNames = [...new Set(rows.map((mark) => mark.exam))];
  const subjects = [...new Set(rows.map((mark) => mark.subject))];
  const scoreFor = (exam: string, subject: string) => rows.find((mark) => mark.exam === exam && mark.subject === subject)?.score;
  const examAverages = examNames.map((exam) => {
    const scores = rows.filter((mark) => mark.exam === exam).map((mark) => Number(mark.score));
    return { name: exam, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 };
  });
  const average = examAverages.length ? examAverages.reduce((sum, exam) => sum + exam.average, 0) / examAverages.length : 0;
  const total = rows.reduce((sum, mark) => sum + Number(mark.score), 0);
  const current = rows[0];
  const grade = (score: number) => score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 40 ? "D" : "E";
  const remark = remarks[student.id] || (average >= 80 ? "Excellent work. Keep it up." : average >= 65 ? "Good progress. Continue working hard." : average >= 50 ? "Satisfactory progress. Aim higher." : "Please work consistently and seek support when needed.");
  const border = "border border-black";

  return (
    <>
      <style>{`@page{size:A4 portrait;margin:8mm}@media print{body{background:#fff!important}.report-card{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;font-size:8pt!important;box-shadow:none!important}.report-card table{font-size:7pt!important}.report-card th,.report-card td{padding:2px 3px!important}.report-card .rc-band{background:#d1d1d1!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-card .rc-input{display:none!important}.report-card .rc-remark{display:block!important}}`}</style>
      <article className="report-card mx-auto max-w-[900px] border border-black/30 bg-white p-5 text-black shadow-sm">
        <header className="grid grid-cols-[90px_1fr_90px] items-center gap-3 border-b-2 border-black pb-2 text-center">
          <div className="flex h-[78px] items-center justify-center">{(detail?.logoUrl || logoUrl) && <img src={detail?.logoUrl || logoUrl} alt="School crest" className="max-h-full max-w-full object-contain" />}</div>
          <div>
            <h2 className="text-xl font-bold uppercase leading-tight">{detail?.schoolName || schoolName || "Shule Yetu"}</h2>
            {detail?.motto && <p className="text-[10px] font-semibold">Motto: {detail.motto}</p>}
            <p className="text-[9px]">{detail?.schoolAddress}{detail?.schoolPhone ? ` · Tel: ${detail.schoolPhone}` : ""}</p>
            {detail?.schoolEmail && <p className="text-[9px]">{detail.schoolEmail}</p>}
          </div>
          <div className="flex h-[78px] items-center justify-center border border-black/40 bg-stone-100">{detail?.photoUrl ? <img src={detail.photoUrl} alt={`${student.first} ${student.last}`} className="h-full w-full object-cover" /> : <span className="text-[8px]">Student photo</span>}</div>
        </header>
        <h3 className="rc-band my-2 border border-black bg-stone-300 py-1 text-center text-[12px] font-bold uppercase">{selectedTerm} academic report form</h3>
        <section className={`${border} grid grid-cols-3 text-[9px]`}>
          <div className="col-span-3 grid grid-cols-[auto_1fr_auto_1fr_auto_1fr] gap-x-2 border-b border-black p-1"><b>NAME:</b><span>{student.first} {student.last}</span><b>ADM. NO:</b><span>{student.adm}</span><b>CLASS:</b><span>{student.class} {student.stream}</span></div>
          <div className="col-span-3 grid grid-cols-[auto_1fr_auto_1fr_auto_1fr] gap-x-2 border-b border-black p-1"><b>GENDER:</b><span>{detail?.gender || student.gender || "—"}</span><b>TERM:</b><span>{selectedTerm}</span><b>ATTENDANCE:</b><span>{attendance.present} present / {attendance.absent} absent</span></div>
          <div className="col-span-3 grid grid-cols-[auto_1fr_auto_1fr_auto_1fr] gap-x-2 p-1"><b>T. MARKS:</b><span>{total.toFixed(1)}</span><b>MEAN MARK:</b><span>{average.toFixed(1)}%</span><b>MEAN GRADE:</b><span>{rows.length ? grade(average) : "—"}</span></div>
        </section>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-[9px]">
            <thead><tr className="rc-band bg-stone-300">{["SUBJECT", ...examNames, "TOTAL %", "GRADE", "POS."].map((heading) => <th key={heading} className="border border-black px-1 py-1 text-left">{heading}</th>)}</tr></thead>
            <tbody>{subjects.map((subject) => {
              const scores = examNames.map((exam) => scoreFor(exam, subject)).filter((score): score is number => score !== undefined);
              const subjectAverage = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
              return <tr key={subject}><td className="border border-black px-1 py-1">{subject}</td>{examNames.map((exam) => <td key={exam} className="border border-black px-1 py-1 text-center">{scoreFor(exam, subject)?.toFixed(0) ?? "—"}</td>)}<td className="border border-black px-1 py-1 text-center">{subjectAverage.toFixed(0)}</td><td className="border border-black px-1 py-1 text-center">{grade(subjectAverage)}</td><td className="border border-black px-1 py-1 text-center">—</td></tr>;
            })}</tbody>
            {!subjects.length && <tbody><tr><td colSpan={examNames.length + 4} className="border border-black p-4 text-center">No approved exam results are available for this term.</td></tr></tbody>}
            {subjects.length > 0 && <tfoot><tr className="font-bold"><td className="border border-black px-1 py-1">EXAM MEAN</td>{examAverages.map((exam) => <td key={exam.name} className="border border-black px-1 py-1 text-center">{exam.average.toFixed(1)}</td>)}<td className="border border-black px-1 py-1 text-center">{average.toFixed(1)}%</td><td className="border border-black px-1 py-1 text-center">{grade(average)}</td><td className="border border-black px-1 py-1 text-center">{current?.position || "—"}</td></tr></tfoot>}
          </table>
        </div>
        <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-3 text-[9px]">
          <section className={`${border} p-2`}>
            <h4 className="mb-1 text-center font-bold">STUDENT PERFORMANCE BY EXAM</h4>
            <svg viewBox="0 0 520 190" role="img" aria-label="Bar graph of average marks by exam" className="h-44 w-full">
              {[0, 25, 50, 75, 100].map((value) => { const y = 155 - value * 1.25; return <g key={value}><line x1="46" x2="510" y1={y} y2={y} stroke="#777" strokeWidth=".7"/><text x="38" y={y + 3} textAnchor="end" fontSize="9">{value}</text></g>; })}
              {examAverages.map((exam, i) => { const width = Math.min(48, 350 / Math.max(examAverages.length, 1)); const gap = 420 / Math.max(examAverages.length, 1); const x = 55 + i * gap + (gap - width) / 2; const height = exam.average * 1.25; return <g key={exam.name}><rect x={x} y={155 - height} width={width} height={height} fill="#9a9389" stroke="#222"/><text x={x + width / 2} y={149 - height} textAnchor="middle" fontSize="9">{exam.average.toFixed(0)}%</text><text transform={`translate(${x + width / 2},166) rotate(-35)`} textAnchor="end" fontSize="8">{exam.name}</text></g>; })}
              <line x1="46" x2="510" y1="155" y2="155" stroke="#222"/><text x="270" y="187" textAnchor="middle" fontSize="9">Exam</text>
            </svg>
          </section>
          <section className="space-y-2">
            <div className={`${border} p-2`}><b>PERFORMANCE SUMMARY</b><div className="mt-1 grid grid-cols-2 gap-y-1"><span>Exams included</span><b>{examNames.length}</b><span>Class position</span><b>{current?.position || "—"}</b><span>Out of</span><b>{current?.classSize || "—"}</b><span>Grade</span><b>{rows.length ? grade(average) : "—"}</b></div></div>
            <div className={`${border} p-2`}><b>Grade scale</b><p>A 80–100 · B 65–79</p><p>C 50–64 · D 40–49 · E below 40</p></div>
            <div className={`${border} p-2`}><b>Class teacher’s remarks</b><textarea className="rc-input mt-1 min-h-16 w-full border border-black/30 p-1" value={remarks[student.id] || ""} onChange={(event) => onRemark(student.id, event.target.value)} placeholder="Add teacher remarks"/><p className="rc-remark hidden mt-1 min-h-12">{remark}</p></div>
          </section>
        </div>
        <footer className="mt-3 flex justify-between border-t border-black pt-2 text-[8px]"><span>Parent/Guardian signature: ____________________</span><span>Teacher’s signature: ____________________</span></footer>
      </article>
    </>
  );
}
