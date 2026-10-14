// Mock dashboard data for the staff portal.
export const dashboardStats = [
  { label: "Learners", value: "1,090", note: "+12 this term" },
  { label: "Teachers", value: "58", note: "4 on leave" },
  { label: "Fees collected", value: "KES 18.4M", note: "82% of billed" },
  { label: "Attendance today", value: "94%", note: "Whole school" },
];

export const recentPayments = [
  { id: "RCP-1042", student: "Amina Otieno", class: "Grade 7 East", amount: "KES 45,000", method: "M-Pesa", date: "Today, 09:12" },
  { id: "RCP-1041", student: "Brian Mwangi", class: "Grade 10 West", amount: "KES 52,500", method: "Bank", date: "Today, 08:47" },
  { id: "RCP-1040", student: "Cynthia Achieng", class: "Grade 4 North", amount: "KES 38,000", method: "M-Pesa", date: "Yesterday" },
  { id: "RCP-1039", student: "David Kamau", class: "Grade 12 East", amount: "KES 55,000", method: "Card", date: "Yesterday" },
  { id: "RCP-1038", student: "Esther Wanjiru", class: "Grade 1 South", amount: "KES 32,000", method: "M-Pesa", date: "Fri, 9 Oct" },
];

export const pendingApprovals = [
  { name: "Grace Njeri", role: "Teacher", requested: "2 days ago" },
  { name: "Peter Omondi", role: "Accountant", requested: "4 days ago" },
];

export const upcomingEvents = [
  { title: "Term 2 mid-term break", date: "23–27 Oct" },
  { title: "Inter-house athletics", date: "6 Nov" },
  { title: "Parents' day — Junior School", date: "13 Nov" },
];

// Mock student register.
export const students = [
  { id: "SJA-2041", name: "Amina Otieno", class: "Grade 7 East", status: "Active", guardian: "J. Otieno", balance: 0 },
  { id: "SJA-2042", name: "Brian Mwangi", class: "Grade 10 West", status: "Active", guardian: "P. Mwangi", balance: 12500 },
  { id: "SJA-2043", name: "Cynthia Achieng", class: "Grade 4 North", status: "Active", guardian: "R. Achieng", balance: 0 },
  { id: "SJA-2044", name: "David Kamau", class: "Grade 12 East", status: "Active", guardian: "M. Kamau", balance: 35000 },
  { id: "SJA-2045", name: "Esther Wanjiru", class: "Grade 1 South", status: "Active", guardian: "S. Wanjiru", balance: 0 },
  { id: "SJA-1988", name: "Felix Kiptoo", class: "Grade 9 North", status: "Inactive", guardian: "L. Kiptoo", balance: 35000 },
  { id: "SJA-1712", name: "Grace Auma", class: "Grade 12 West", status: "Completed", guardian: "D. Auma", balance: 0 },
  { id: "SJA-1713", name: "Hassan Ali", class: "Grade 12 East", status: "Completed", guardian: "A. Ali", balance: 0 },
];

// Mock fee ledger for the current term.
export const feeLedger = [
  { student: "Amina Otieno", class: "Grade 7 East", billed: 45000, paid: 45000 },
  { student: "Brian Mwangi", class: "Grade 10 West", billed: 52500, paid: 40000 },
  { student: "Cynthia Achieng", class: "Grade 4 North", billed: 38000, paid: 38000 },
  { student: "David Kamau", class: "Grade 12 East", billed: 55000, paid: 20000 },
  { student: "Esther Wanjiru", class: "Grade 1 South", billed: 32000, paid: 32000 },
  { student: "Felix Kiptoo", class: "Grade 9 North", billed: 47000, paid: 12000 },
];

export const feeSummary = {
  collected: [
    { label: "This week", value: "KES 1.24M" },
    { label: "This month", value: "KES 4.86M" },
    { label: "This year", value: "KES 18.4M" },
  ],
  balance: [
    { label: "This term", value: "KES 4.02M" },
    { label: "This year", value: "KES 6.71M" },
  ],
};

// Mock attendance register for today.
export const attendanceToday = [
  { class: "Grade 1 South", present: 38, absent: 2, late: 1 },
  { class: "Grade 4 North", present: 41, absent: 3, late: 0 },
  { class: "Grade 7 East", present: 44, absent: 1, late: 2 },
  { class: "Grade 9 North", present: 39, absent: 5, late: 1 },
  { class: "Grade 10 West", present: 36, absent: 4, late: 0 },
  { class: "Grade 12 East", present: 33, absent: 2, late: 1 },
];
