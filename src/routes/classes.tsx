import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Flash, Panel, btn, inputCls, tdCls, thCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";
type StreamFees = {
  term1Fee: number | null;
  term2Fee: number | null;
  term3Fee: number | null;
  extraFee: number | null;
};
type ClassRow = {
  id: string;
  name: string;
  streams: string[];
  subjects: string[];
  term1Fee: number;
  term2Fee: number;
  term3Fee: number;
  extraFee: number;
  streamFees: Record<string, StreamFees>;
};
type Draft = Omit<ClassRow, "id" | "streamFees"> & { streamsText: string; subjectsText: string };
export const Route = createFileRoute("/classes")({
  head: () => ({
    meta: [{ title: "Classes and fees - Shule Yetu" }, { name: "robots", content: "noindex" }],
  }),
  component: ClassesPage,
});
const split = (value: string) =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const blankDraft = (): Draft => ({
  name: "",
  streams: [],
  subjects: [],
  streamsText: "",
  subjectsText: "",
  term1Fee: 0,
  term2Fee: 0,
  term3Fee: 0,
  extraFee: 0,
});
function ClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [term, setTerm] = useState("");
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await neonApi("/api/classes");
      const data = await r.json();
      setRows(data.map((x: ClassRow) => ({ ...x, streamFees: x.streamFees || {} })));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load classes.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function update(id: string, patch: Partial<ClassRow>) {
    setRows((old) => old.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function updateOverride(row: ClassRow, stream: string, key: keyof StreamFees, raw: string) {
    const value = raw === "" ? null : Math.max(0, Number(raw));
    update(row.id, {
      streamFees: {
        ...row.streamFees,
        [stream]: {
          term1Fee: null,
          term2Fee: null,
          term3Fee: null,
          extraFee: null,
          ...row.streamFees[stream],
          [key]: value,
        },
      },
    });
  }
  async function save(row: ClassRow) {
    setError("");
    try {
      await neonApi(`/api/classes/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      setFlash(`${row.name} saved.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save class.");
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await neonApi("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          streams: split(draft.streamsText),
          subjects: split(draft.subjectsText),
          term1Fee: draft.term1Fee,
          term2Fee: draft.term2Fee,
          term3Fee: draft.term3Fee,
          extraFee: draft.extraFee,
          streamFees: {},
        }),
      });
      setDraft(blankDraft());
      setFlash("Class saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add class.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this class?")) return;
    setError("");
    try {
      await neonApi(`/api/classes/${id}`, { method: "DELETE" });
      setFlash("Class deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete class.");
    }
  }
  async function generate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFlash("");
    try {
      const r = await neonApi("/api/classes/generate-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term }),
      });
      const d = await r.json();
      setFlash(
        `${d.created} fee obligations created for ${d.term}. Existing obligations were left unchanged.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate fees.");
    }
  }
  return (
    <PortalShell eyebrow="Setup" title="Classes and fees">
      <Flash message={flash || null} />
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}
      <Panel title="Classes, streams, subjects and term fees">
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="border border-ink/10 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-sm">
                  Class name
                  <input className={inputCls} value={row.name} readOnly />
                </label>
                <label className="block text-sm">
                  Streams (comma separated)
                  <input
                    className={inputCls}
                    value={row.streams.join(", ")}
                    onChange={(e) => {
                      const streams = split(e.target.value);
                      update(row.id, {
                        streams,
                        streamFees: Object.fromEntries(
                          streams.map((s) => [
                            s,
                            row.streamFees[s] || {
                              term1Fee: null,
                              term2Fee: null,
                              term3Fee: null,
                              extraFee: null,
                            },
                          ]),
                        ),
                      });
                    }}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  Subjects (comma separated)
                  <input
                    className={inputCls}
                    value={row.subjects.join(", ")}
                    onChange={(e) => update(row.id, { subjects: split(e.target.value) })}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(["term1Fee", "term2Fee", "term3Fee", "extraFee"] as const).map((key, i) => (
                  <label key={key} className="block text-sm">
                    {["Term 1 fee", "Term 2 fee", "Term 3 fee", "Extra fee"][i]}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputCls}
                      value={row[key]}
                      onChange={(e) => update(row.id, { [key]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              {!!row.streams.length && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Optional fee overrides by stream
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={thCls}>Stream</th>
                          {["Term 1", "Term 2", "Term 3", "Extra fee"].map((h) => (
                            <th key={h} className={thCls}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {row.streams.map((stream) => (
                          <tr key={stream}>
                            <td className={tdCls}>{stream}</td>
                            {(["term1Fee", "term2Fee", "term3Fee", "extraFee"] as const).map(
                              (key) => (
                                <td key={key} className={tdCls}>
                                  <input
                                    aria-label={`${stream} ${key}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Use class fee"
                                    className="w-32 border border-input bg-paper px-2 py-1"
                                    value={row.streamFees[stream]?.[key] ?? ""}
                                    onChange={(e) =>
                                      updateOverride(row, stream, key, e.target.value)
                                    }
                                  />
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              <div className="mt-4 flex gap-2">
                <button className={btn()} onClick={() => void save(row)}>
                  Save class
                </button>
                <button className={btn("bad")} onClick={() => void remove(row.id)}>
                  Delete class
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <p className="py-6 text-center text-sm text-ink-soft">
              No classes yet. Add the school's classes below.
            </p>
          )}
        </div>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Add class">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={add}>
            <label className="block text-sm">
              Class name
              <input
                required
                maxLength={100}
                className={inputCls}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Streams
              <input
                required
                className={inputCls}
                placeholder="e.g. East, West"
                value={draft.streamsText}
                onChange={(e) => setDraft({ ...draft, streamsText: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              Subjects
              <input
                className={inputCls}
                placeholder="e.g. English, Mathematics"
                value={draft.subjectsText}
                onChange={(e) => setDraft({ ...draft, subjectsText: e.target.value })}
              />
            </label>
            {(["term1Fee", "term2Fee", "term3Fee", "extraFee"] as const).map((key, i) => (
              <label key={key} className="block text-sm">
                {["Term 1 fee", "Term 2 fee", "Term 3 fee", "Extra fee"][i]}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <button className={btn()} disabled={busy}>
              {busy ? "Saving..." : "Add class"}
            </button>
          </form>
        </Panel>
        <Panel title="Generate fee obligations">
          <p className="mb-3 text-sm text-ink-soft">
            Create one new fee ledger row for each active student using their class and stream fee.
            Previous balances remain in the ledger and are carried forward automatically.
          </p>
          <form onSubmit={generate} className="flex flex-wrap gap-2">
            <input
              required
              className={`${inputCls} min-w-48 flex-1`}
              placeholder="Term 1 2027"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button className={btn()}>Generate term fees</button>
          </form>
        </Panel>
      </div>
    </PortalShell>
  );
}
