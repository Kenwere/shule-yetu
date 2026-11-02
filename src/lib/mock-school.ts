// Mock academic data — classes, teachers, exams, marks, ledgers. Sample only.
export type ClassDef = {
  id: string;
  name: string;
  streams: string[];
  subjects: string[];
  termFee: number;
  extraFee: number;
};

export const classes: ClassDef[] = [
  { id: "g1", name: "Grade 1", streams: ["North", "South"], subjects: ["English", "Kiswahili", "Mathematics", "Environmental"], termFee: 32000, extraFee: 3000 },
  { id: "g4", name: "Grade 4", streams: ["North", "South"], subjects: ["English", "Kiswahili", "Mathematics", "Science", "Social Studies"], termFee: 38000, extraFee: 3500 },
  { id: "g7", name: "Grade 7", streams: ["East", "West"], subjects: ["English", "Kiswahili", "Mathematics", "Integrated Science", "Social Studies", "CRE"], termFee: 45000, extraFee: 4000 },
  { id: "g10", name: "Grade 10", streams: ["East", "West"], subjects: ["English", "Kiswahili", "Mathematics", "Biology", "Chemistry", "Physics", "History"], termFee: 52500, extraFee: 5000 },
  { id: "g12", name: "Grade 12", streams: ["East", "West"], subjects: ["English", "Kiswahili", "Mathematics", "Biology", "Chemistry", "Physics", "Geography"], termFee: 55000, extraFee: 5000 },
];

export type Learner = {
  adm: string;
  first: string;
  last: string;
  gender: "F" | "M";
  dob: string;
  classId: string;
  stream: string;
  guardian: string;
  phone: string;
  address: string;
  admitted: string;
  status: "Active" | "Inactive" | "Completed";
};

export const learners: Learner[] = [
  { adm: "SY-2041", first: "Amina", last: "Otieno", gender: "F", dob: "2013-03-14", classId: "g7", stream: "East", guardian: "J. Otieno", phone: "0712 000 101", address: "Kisumu", admitted: "2020-01-08", status: "Active" },
  { adm: "SY-2046", first: "Kevin", last: "Barasa", gender: "M", dob: "2013-07-02", classId: "g7", stream: "East", guardian: "T. Barasa", phone: "0712 000 102", address: "Kakamega", admitted: "2020-01-08", status: "Active" },
  { adm: "SY-2047", first: "Lilian", last: "Chebet", gender: "F", dob: "2013-11-21", classId: "g7", stream: "East", guardian: "E. Chebet", phone: "0712 000 103", address: "Eldoret", admitted: "2021-01-05", status: "Active" },
  { adm: "SY-2048", first: "Moses", last: "Kiprono", gender: "M", dob: "2013-05-30", classId: "g7", stream: "West", guardian: "J. Kiprono", phone: "0712 000 104", address: "Nakuru", admitted: "2020-01-08", status: "Active" },
  { adm: "SY-2049", first: "Naomi", last: "Wairimu", gender: "F", dob: "2013-09-09", classId: "g7", stream: "West", guardian: "G. Wairimu", phone: "0712 000 105", address: "Nyeri", admitted: "2020-01-08", status: "Active" },
  { adm: "SY-2042", first: "Brian", last: "Mwangi", gender: "M", dob: "2010-02-11", classId: "g10", stream: "West", guardian: "P. Mwangi", phone: "0712 000 106", address: "Nairobi", admitted: "2017-01-09", status: "Active" },
  { adm: "SY-2044", first: "David", last: "Kamau", gender: "M", dob: "2008-06-18", classId: "g12", stream: "East", guardian: "M. Kamau", phone: "0712 000 107", address: "Thika", admitted: "2015-01-06", status: "Active" },
  { adm: "SY-1988", first: "Felix", last: "Kiptoo", gender: "M", dob: "2011-01-27", classId: "g10", stream: "East", guardian: "L. Kiptoo", phone: "0712 000 108", address: "Kericho", admitted: "2018-01-08", status: "Inactive" },
];

export const learnerName = (l: Learner) => `${l.first} ${l.last}`;
export const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id;

export type LedgerRow = {
  date: string;
  term: string;
  entry: "Fee obligation" | "Payment" | "Debt added" | "Credit added" | "Balance set";
  debit: number;
  credit: number;
  comment: string;
};

export function seedLedger(adm: string): LedgerRow[] {
  const l = learners.find((x) => x.adm === adm);
  const fee = classes.find((c) => c.id === l?.classId)?.termFee ?? 40000;
  return [
    { date: "2026-01-06", term: "Term 1 · 2026", entry: "Fee obligation", debit: fee, credit: 0, comment: "Opening term fee" },
    { date: "2026-01-15", term: "Term 1 · 2026", entry: "Payment", debit: 0, credit: fee - 5000, comment: "M-Pesa · QFT7H2K1" },
    { date: "2026-05-04", term: "Term 2 · 2026", entry: "Fee obligation", debit: fee, credit: 0, comment: "Term fee — carried forward KES 5,000" },
    { date: "2026-05-20", term: "Term 2 · 2026", entry: "Payment", debit: 0, credit: fee, comment: "Bank · EQ-889201" },
    { date: "2026-09-01", term: "Term 3 · 2026", entry: "Fee obligation", debit: fee, credit: 0, comment: "Term fee — carried forward KES 5,000" },
  ];
}

export const teachers = [
  { id: "t1", name: "Mary Achieng", email: "m.achieng@shuleyetu.example", phone: "0722 100 201" },
  { id: "t2", name: "John Kariuki", email: "j.kariuki@shuleyetu.example", phone: "0722 100 202" },
  { id: "t3", name: "Ruth Nyambura", email: "r.nyambura@shuleyetu.example", phone: "0722 100 203" },
  { id: "t4", name: "Samuel Odhiambo", email: "s.odhiambo@shuleyetu.example", phone: "0722 100 204" },
];

export type Assignment = { classId: string; stream: string; subjects: string[] };

export const teacherAssignments: Record<string, Assignment[]> = {
  t1: [{ classId: "g7", stream: "East", subjects: ["English", "CRE"] }, { classId: "g7", stream: "West", subjects: ["English"] }],
  t2: [{ classId: "g7", stream: "East", subjects: ["Mathematics", "Integrated Science"] }],
  t3: [{ classId: "g10", stream: "West", subjects: ["Biology", "Chemistry"] }],
  t4: [],
};

export type Exam = { id: string; name: string; classId: string; stream: string; term: string; year: number; start: string; end: string };

export const exams: Exam[] = [
  { id: "e1", name: "Term 3 Opener", classId: "g7", stream: "East", term: "Term 3", year: 2026, start: "2026-09-07", end: "2026-09-09" },
  { id: "e2", name: "Term 2 End-Term", classId: "g7", stream: "East", term: "Term 2", year: 2026, start: "2026-07-27", end: "2026-07-31" },
  { id: "e3", name: "Term 3 Opener", classId: "g10", stream: "West", term: "Term 3", year: 2026, start: "2026-09-07", end: "2026-09-10" },
];

export type MarkStatus = "Pending" | "Approved" | "Denied";
export type Mark = { examId: string; adm: string; subject: string; score: number; status: MarkStatus; locked: boolean; teacher: string };

function seededScore(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return 45 + (h % 51);
}

export function seedMarks(): Mark[] {
  const out: Mark[] = [];
  for (const exam of exams) {
    const cls = classes.find((c) => c.id === exam.classId)!;
    const roster = learners.filter((l) => l.classId === exam.classId && l.stream === exam.stream && l.status === "Active");
    for (const l of roster) {
      cls.subjects.forEach((s, i) => {
        const pending = exam.id === "e1" && i >= cls.subjects.length - 2;
        out.push({
          examId: exam.id,
          adm: l.adm,
          subject: s,
          score: seededScore(exam.id + l.adm + s),
          status: pending ? "Pending" : "Approved",
          locked: !pending,
          teacher: s === "Mathematics" ? "John Kariuki" : "Mary Achieng",
        });
      });
    }
  }
  return out;
}

export const termTotals: Record<string, { term: string; total: number }[]> = Object.fromEntries(
  learners.map((l) => [
    l.adm,
    ["Term 1", "Term 2", "Term 3"].map((term, i) => ({ term, total: 300 + (seededScore(l.adm + term) * 3) % 220 + i * 8 })),
  ]),
);

export const weeklyPayments = [
  { week: "W1", amount: 0.92 }, { week: "W2", amount: 1.48 }, { week: "W3", amount: 1.1 },
  { week: "W4", amount: 0.76 }, { week: "W5", amount: 1.35 }, { week: "W6", amount: 1.62 },
  { week: "W7", amount: 0.98 }, { week: "W8", amount: 1.24 },
];

export const attendanceTrend = [
  { day: "Mon", rate: 95 }, { day: "Tue", rate: 93 }, { day: "Wed", rate: 96 },
  { day: "Thu", rate: 92 }, { day: "Fri", rate: 94 },
];

export const recentRegistrations = [
  { name: "Grace Njeri", role: "Teacher", when: "2 days ago", status: "Pending" },
  { name: "Peter Omondi", role: "Accountant", when: "4 days ago", status: "Pending" },
  { name: "Lucy Wambui", role: "Teacher", when: "1 week ago", status: "Approved" },
];

export const notifications = [
  "6 marks from Term 3 Opener (Grade 7 East) are waiting for approval.",
  "Term 3 fee obligations were generated for 1,082 active learners.",
  "3 failed sign-in attempts on admin@shuleyetu.example yesterday.",
];

export const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
