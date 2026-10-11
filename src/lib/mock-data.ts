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
