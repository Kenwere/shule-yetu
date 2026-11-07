import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { Panel, btn, inputCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";
type Announcement = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
  expiresAt: string;
};
type SchoolEvent = {
  id: string;
  title: string;
  details: string;
  location: string;
  startsAt: string;
  authorName: string;
};
export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements and events - Shule Yetu" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnnouncementsPage,
});
const futureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => futureDate(7));
  const [eventTitle, setEventTitle] = useState("");
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState(() => futureDate(1));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [a, e] = await Promise.all([neonApi("/api/announcements"), neonApi("/api/events")]);
      setItems(await a.json());
      setEvents(await e.json());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load school updates.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function createAnnouncement(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await neonApi("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, expiresAt: new Date(expiresAt).toISOString() }),
      });
      setTitle("");
      setBody("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish announcement.");
    } finally {
      setBusy(false);
    }
  }
  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await neonApi("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventTitle,
          details,
          location,
          startsAt: new Date(startsAt).toISOString(),
        }),
      });
      setEventTitle("");
      setDetails("");
      setLocation("");
      setStartsAt(futureDate(1));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not schedule event.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(path: string) {
    try {
      await neonApi(path, { method: "DELETE" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete item.");
    }
  }
  return (
    <PortalShell eyebrow="School communications" title="Announcements and events">
      <p className="mb-6 max-w-2xl text-sm text-ink-soft">
        Publish announcements and schedule upcoming school events. Expired announcements are
        automatically removed hourly.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Upcoming events">
          <div className="space-y-3">
            {events.map((e) => (
              <article key={e.id} className="border border-ink/10 border-l-2 border-l-gold p-4">
                <div className="flex justify-between gap-2">
                  <h2 className="font-semibold">{e.title}</h2>
                  <button className={btn("bad")} onClick={() => void remove(`/api/events/${e.id}`)}>
                    Delete
                  </button>
                </div>
                {e.details && <p className="mt-2 whitespace-pre-wrap text-sm">{e.details}</p>}
                <p className="mt-2 text-xs text-ink-soft">
                  {new Date(e.startsAt).toLocaleString()}
                  {e.location ? ` - ${e.location}` : ""} - By {e.authorName}
                </p>
              </article>
            ))}
            {!events.length && <p className="py-5 text-sm text-ink-soft">No upcoming events.</p>}
          </div>
        </Panel>
        <Panel title="Schedule an event">
          <form onSubmit={createEvent} className="space-y-3">
            <label className="block text-sm">
              Event name
              <input
                required
                maxLength={180}
                className={inputCls}
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Details
              <textarea
                maxLength={3000}
                rows={3}
                className={inputCls}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Location
              <input
                maxLength={250}
                className={inputCls}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Date and time
              <input
                required
                type="datetime-local"
                className={inputCls}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <button className={btn()} disabled={busy}>
              Schedule event
            </button>
          </form>
        </Panel>
        <Panel title="Active announcements">
          <div className="space-y-3">
            {items.map((a) => (
              <article key={a.id} className="border border-ink/10 border-l-2 border-l-gold p-4">
                <div className="flex justify-between gap-2">
                  <h2 className="font-semibold">{a.title}</h2>
                  <button
                    className={btn("bad")}
                    onClick={() => void remove(`/api/announcements/${a.id}`)}
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>
                <p className="mt-3 text-xs text-ink-soft">
                  By {a.authorName} - expires {new Date(a.expiresAt).toLocaleString()}
                </p>
              </article>
            ))}
            {!items.length && (
              <p className="py-5 text-sm text-ink-soft">No active announcements.</p>
            )}
          </div>
        </Panel>
        <Panel title="Create announcement">
          <form onSubmit={createAnnouncement} className="space-y-3">
            <label className="block text-sm">
              Title
              <input
                required
                maxLength={180}
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Announcement
              <textarea
                required
                maxLength={5000}
                rows={5}
                className={inputCls}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Delete after
              <input
                required
                type="datetime-local"
                className={inputCls}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <button className={btn()} disabled={busy}>
              Publish announcement
            </button>
          </form>
        </Panel>
      </div>
    </PortalShell>
  );
}
