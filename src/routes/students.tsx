import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { students } from "@/lib/mock-data";

export const Route = createFileRoute("/students")({
  head: () => ({
    meta: [
      { title: "Students — St John's Academy" },
      { name: "description", content: "Student register for St John's Academy." },
      { property: "og:title", content: "Students — St John's Academy" },
      { property: "og:description", content: "Student register for St John's Academy." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentsPage,
});

const FILTERS = ["All", "Active", "Inactive", "Completed"] as const;

const chipClass: Record<string, string> = {
  Active: "bg-collected-soft text-collected",
  Inactive: "bg-owed-soft text-owed",
  Completed: "bg-ink/10 text-ink-soft",
};

function StudentsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesFilter = filter === "All" || s.status === filter;
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [query, filter]);

  const counts = useMemo(
    () => ({
      active: students.filter((s) => s.status === "Active").length,
      inactive: students.filter((s) => s.status === "Inactive").length,
      completed: students.filter((s) => s.status === "Completed").length,
    }),
    [],
  );

  return (
    <PortalShell eyebrow="Register" title="Students">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, class or admission number"
          className="w-full max-w-sm border border-input bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "border px-3 py-2 text-xs font-bold uppercase tracking-wide " +
                (filter === f
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/20 text-ink-soft hover:border-ink hover:text-ink")
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="border border-ink/10 bg-collected-soft p-5">
          <div className="eyebrow text-[10px] text-collected">Active</div>
          <div className="mt-2 font-display text-3xl text-collected">{counts.active}</div>
        </div>
        <div className="border border-ink/10 bg-owed-soft p-5">
          <div className="eyebrow text-[10px] text-owed">Inactive</div>
          <div className="mt-2 font-display text-3xl text-owed">{counts.inactive}</div>
        </div>
        <div className="border border-ink/10 bg-paper p-5">
          <div className="eyebrow text-[10px] text-ink-soft">Completed</div>
          <div className="mt-2 font-display text-3xl">{counts.completed}</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto border border-ink/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink text-paper">
            <tr>
              <th className="px-4 py-3 font-semibold">Adm no.</th>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Class</th>
              <th className="px-4 py-3 font-semibold">Guardian</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-ink/10">
                <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                <td className="px-4 py-3 font-semibold">{s.name}</td>
                <td className="px-4 py-3">{s.class}</td>
                <td className="px-4 py-3 text-ink-soft">{s.guardian}</td>
                <td className="px-4 py-3">
                  <span className={"px-2 py-1 text-xs font-bold uppercase " + chipClass[s.status]}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {s.balance > 0 ? (
                    <span className="font-semibold text-owed">
                      KES {s.balance.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-collected">Cleared</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="border-t border-ink/10">
                <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                  No learners match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Sample register · {rows.length} of {students.length} learners
      </p>
    </PortalShell>
  );
}
