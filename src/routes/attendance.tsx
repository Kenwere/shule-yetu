import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/PortalShell";
import { attendanceToday } from "@/lib/mock-data";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — St John's Academy" },
      { name: "description", content: "Daily attendance register for St John's Academy." },
      { property: "og:title", content: "Attendance — St John's Academy" },
      { property: "og:description", content: "Daily attendance register for St John's Academy." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const totals = attendanceToday.reduce(
    (acc, r) => ({
      present: acc.present + r.present,
      absent: acc.absent + r.absent,
      late: acc.late + r.late,
    }),
    { present: 0, absent: 0, late: 0 },
  );
  const roll = totals.present + totals.absent + totals.late;
  const rate = Math.round((totals.present / roll) * 100);

  return (
    <PortalShell eyebrow="Register" title="Attendance">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="border border-ink/10 bg-paper p-5">
          <div className="eyebrow text-[10px] text-ink-soft">In class</div>
          <div className="mt-2 font-display text-3xl">{totals.present}</div>
        </div>
        <div className="border border-ink/10 bg-owed-soft p-5">
          <div className="eyebrow text-[10px] text-owed">Absent</div>
          <div className="mt-2 font-display text-3xl text-owed">{totals.absent}</div>
        </div>
        <div className="border border-ink/10 bg-paper p-5">
          <div className="eyebrow text-[10px] text-ink-soft">Late</div>
          <div className="mt-2 font-display text-3xl">{totals.late}</div>
        </div>
        <div className="border border-ink/10 bg-collected-soft p-5">
          <div className="eyebrow text-[10px] text-collected">Rate</div>
          <div className="mt-2 font-display text-3xl text-collected">{rate}%</div>
        </div>
      </div>

      <h2 className="eyebrow mb-4 mt-10 text-ink-soft">By class · today</h2>
      <div className="space-y-4">
        {attendanceToday.map((r) => {
          const classRoll = r.present + r.absent + r.late;
          const classRate = Math.round((r.present / classRoll) * 100);
          return (
            <div key={r.class} className="border border-ink/10 bg-paper p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold">{r.class}</div>
                <div className="font-mono text-xs text-ink-soft">
                  {r.present} present · {r.absent} absent · {r.late} late
                </div>
              </div>
              <div className="mt-3 h-2 w-full bg-ink/10">
                <div className="h-full bg-ink" style={{ width: `${classRate}%` }} />
              </div>
              <div className="mt-2 text-right font-mono text-xs text-ink-soft">{classRate}%</div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Sample register · figures are illustrative
      </p>
    </PortalShell>
  );
}
