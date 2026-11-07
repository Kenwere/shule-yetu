import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SealedLiveQuery } from "@neon/realtime/client";
import { neonApi } from "@/lib/neon-api";
import { neonRealtime } from "@/lib/neon-realtime";

type SchoolNote = { id: string; user_id: string; text: string; created_at: string };

export function NeonBackendTools() {
  const [notes, setNotes] = useState<SchoolNote[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("Connecting to Neon...");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    async function connect() {
      try {
        const response = await neonApi("/api/notes/live", { method: "POST" });
        const sealed = (await response.json()) as SealedLiveQuery<SchoolNote>;
        if (cancelled) return;
        const subscription = neonRealtime.subscribe(sealed);
        const update = (snapshot: ReturnType<typeof subscription.getSnapshot>) => {
          if (snapshot.data) setNotes([...snapshot.data]);
          setStatus(
            snapshot.status === "live"
              ? "Live updates connected"
              : (snapshot.error?.message ?? "Connecting to live updates..."),
          );
        };
        update(subscription.getSnapshot());
        const unsubscribe = subscription.onChange(update);
        cleanup = () => {
          unsubscribe();
          subscription.unsubscribe();
        };
      } catch (error) {
        if (!cancelled)
          setStatus(error instanceof Error ? error.message : "Neon connection failed.");
      }
    }
    void connect();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const saveNote = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!note.trim() || busy) return;
      setBusy(true);
      setMessage("");
      try {
        await neonApi("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: note }),
        });
        setNote("");
        setMessage("Note saved to Postgres.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save note.");
      } finally {
        setBusy(false);
      }
    },
    [busy, note],
  );

  async function uploadFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setFileUrl("");
    try {
      const response = await neonApi("/api/files", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = (await response.json()) as { filename: string; url: string };
      setFileUrl(result.url);
      setMessage(result.filename + " uploaded to private Object Storage.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload the file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-ink/10 bg-paper p-6">
      <h2 className="eyebrow mb-2 text-ink-soft">Neon backend</h2>
      <p className="mb-5 text-xs text-ink-soft">{status}</p>
      <form onSubmit={saveNote} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          required
          placeholder="Add a private staff note"
          aria-label="Staff note"
          className="min-w-0 flex-1 border border-input bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-ink px-4 py-2 text-xs font-bold uppercase text-paper disabled:opacity-50"
        >
          Save note
        </button>
      </form>
      <label className="mt-4 block text-sm">
        <span className="eyebrow text-[10px] text-ink-soft">Upload a private file (max 10 MB)</span>
        <input
          type="file"
          disabled={busy}
          onChange={(event) => void uploadFile(event.currentTarget.files?.[0])}
          className="mt-1 block w-full text-sm"
        />
      </label>
      {fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-semibold underline"
        >
          Open uploaded file
        </a>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          {message}
        </p>
      )}
      <ul aria-label="Live staff notes" className="mt-5 space-y-2">
        {notes.map((item) => (
          <li key={item.id} className="border-l-2 border-gold bg-secondary px-3 py-2 text-sm">
            <span>{item.text}</span>
            <time className="ml-2 text-xs text-ink-soft">
              {new Date(item.created_at).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
