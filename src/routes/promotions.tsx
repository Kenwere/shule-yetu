import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { btn, inputCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type SchoolClass = { id: string; name: string };
export const Route = createFileRoute("/promotions")({
  head: () => ({
    meta: [{ title: "Promote students - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: PromotionsPage,
});

function PromotionsPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [currentClass, setCurrentClass] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void neonApi("/api/classes")
      .then((r) => r.json())
      .then(setClasses)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load classes."));
  }, []);

  async function apply(action: "promote" | "suspend" | "resume") {
    if (!currentClass) return setError("Choose the current class first.");
    if (action === "promote" && !targetClass) return setError("Choose the destination class.");
    const prompt =
      action === "promote"
        ? `Promote every active student in ${currentClass} to ${targetClass}? Their existing fee balance will carry forward, and the destination class Term 1 fee will be added.`
        : action === "suspend"
          ? `Suspend every active student in ${currentClass}? Their records and fee ledger will be retained.`
          : `Restore every suspended student in ${currentClass} to active status?`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await neonApi("/api/students/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, currentClass, targetClass }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Class action failed.");
      setMessage(
        `${data.updated} student${data.updated === 1 ? "" : "s"} ${action === "promote" ? `promoted to ${targetClass}; ${data.term} fees added` : action === "suspend" ? "suspended" : "restored to active status"}. Existing fee ledger balances were retained.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Class action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell eyebrow="Student records" title="Promotions & status">
      <section className="max-w-3xl border border-ink/10 bg-paper p-6">
        <p className="text-sm text-ink-soft">
          Promote an entire class together or suspend its active students. Student fee entries are
          retained during either action.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-owed">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 text-sm text-collected">
            {message}
          </p>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Current class
            <select
              className={inputCls}
              value={currentClass}
              onChange={(e) => setCurrentClass(e.target.value)}
            >
              <option value="">Select current class</option>
              {classes.map((x) => (
                <option key={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Promote to
            <select
              className={inputCls}
              value={targetClass}
              onChange={(e) => setTargetClass(e.target.value)}
            >
              <option value="">Select destination class</option>
              {classes
                .filter((x) => x.name !== currentClass)
                .map((x) => (
                  <option key={x.id}>{x.name}</option>
                ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className={btn()}
            disabled={busy || !currentClass || !targetClass}
            onClick={() => void apply("promote")}
          >
            {busy ? "Working…" : "Promote class"}
          </button>
          <button
            className={btn("ghost")}
            disabled={busy || !currentClass}
            onClick={() => void apply("suspend")}
          >
            Suspend class
          </button>
          <button
            className={btn("ghost")}
            disabled={busy || !currentClass}
            onClick={() => void apply("resume")}
          >
            Resume suspended students
          </button>
        </div>
      </section>
    </PortalShell>
  );
}
