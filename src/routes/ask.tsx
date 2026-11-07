import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask Admissions — Shule Yetu" },
      {
        name: "description",
        content:
          "Ask our AI-powered admissions assistant about Shule Yetu's vision, classes and contacts.",
      },
      { property: "og:title", content: "Ask Admissions — Shule Yetu" },
      { property: "og:description", content: "Instant answers for prospective families." },
    ],
  }),
  component: Ask,
});

const suggestions = [
  "What classes do you offer?",
  "What is the school's vision?",
  "How do I contact admissions?",
];

function Ask() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ask" }),
  });
  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <section className="relative overflow-hidden bg-ink text-paper">
        <div className="stripes absolute inset-0 opacity-10" />
        <div className="relative mx-auto max-w-3xl px-6 py-12">
          <div className="eyebrow mb-3 text-gold">AI-powered · Admissions</div>
          <h1 className="font-display text-5xl uppercase tracking-tight">Ask us anything.</h1>
          <p className="mt-3 text-paper/70">
            Answers come from our published vision, classes and contact details.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="border border-ink/20 px-4 py-2 text-sm font-semibold hover:border-gold hover:text-ink-soft"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] bg-ink p-4 text-paper"
                  : "max-w-[90%] border-l-4 border-gold bg-secondary p-4"
              }
            >
              <div className="eyebrow mb-1 text-[10px] opacity-60">
                {m.role === "user" ? "You" : "Shule Yetu"}
              </div>
              <div className="prose-sm space-y-2 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">
                {m.parts.map((p, i) =>
                  p.type === "text" ? <ReactMarkdown key={i}>{p.text}</ReactMarkdown> : null,
                )}
              </div>
            </div>
          ))}
          {status === "submitted" && <div className="eyebrow text-ink-soft">Thinking…</div>}
          {error && (
            <div className="bg-owed-soft p-3 text-sm text-owed">
              {error.message || "Something went wrong."}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 border-t border-ink/10 bg-paper"
      >
        <div className="mx-auto flex max-w-3xl gap-2 px-6 py-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            maxLength={500}
            className="flex-1 border border-input bg-paper px-3 py-3 text-sm outline-none focus:border-gold"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="border border-ink px-5 font-bold uppercase"
            >
              Stop
            </button>
          ) : (
            <button className="bg-ink px-6 font-bold uppercase tracking-wide text-paper hover:bg-ink-soft">
              Ask
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
