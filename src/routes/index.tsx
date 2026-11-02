import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import crest from "@/assets/crest.jpg";
import campus from "@/assets/campus.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shule Yetu — Discipline. Drive. Distinction." },
      { name: "description", content: "Shule Yetu, Nairobi: a co-educational day school building character through sport, scholarship and service since 1964." },
      { property: "og:title", content: "Shule Yetu — Nairobi" },
      { property: "og:description", content: "Character through sport, scholarship and service since 1964." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  ["Scholarship", "Small classes, 1:18 ratio, weekly mentor reviews."],
  ["Athletics", "Track, rugby and swimming with district champions."],
  ["Service", "Community projects in Kibera and Mathare."],
];
const classes = [
  ["Pre-Primary", "Ages 4–5 · 120"],
  ["Lower Primary", "Grade 1–4 · 340"],
  ["Upper Primary", "Grade 5–6 · 180"],
  ["Junior School", "Grade 7–9 · 260"],
  ["Senior School", "Grade 10–12 · 190"],
];

function Index() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="relative overflow-hidden bg-ink text-paper">
        <div className="stripes absolute inset-0 opacity-10" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-16 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="eyebrow mb-4 text-gold">Admissions open · Term 2</div>
            <h1 className="animate-wipe font-display text-6xl uppercase leading-[0.86] tracking-tight md:text-8xl">
              Discipline.<br /><span className="text-gold">Drive.</span><br />Distinction.
            </h1>
            <p className="mt-6 max-w-[46ch] leading-relaxed text-paper/70">
              A co-educational day school in Nairobi building character through sport, scholarship and service. Since 1964.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="bg-gold px-6 py-3 font-bold uppercase tracking-wide text-ink transition-colors hover:bg-gold/85">Register</Link>
              <Link to="/ask" className="border border-paper/30 px-6 py-3 font-bold uppercase tracking-wide transition-colors hover:border-gold hover:text-gold">Ask a question</Link>
            </div>
          </div>
          <img src={crest} alt="Shule Yetu crest" width={1024} height={1024} className="aspect-square w-full rotate-2 object-cover outline outline-1 -outline-offset-1 outline-paper/10" />
        </div>
      </section>

      <section id="vision" className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="eyebrow mb-4 text-ink-soft">01 / Vision</div>
          <p className="mb-10 max-w-3xl font-display text-3xl uppercase leading-tight tracking-tight md:text-4xl">
            To raise principled, curious citizens ready for university and for life.
          </p>
          <div className="grid gap-px bg-ink/10 outline outline-1 outline-ink/10 md:grid-cols-3">
            {features.map(([t, d], i) => (
              <div key={t} className="bg-paper p-6 transition-colors hover:bg-ink hover:text-paper">
                <div className="font-display text-4xl text-gold">0{i + 1}</div>
                <h3 className="mt-3 font-display text-2xl uppercase tracking-tight">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed opacity-80">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="classes" className="bg-ink py-16 text-paper">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 md:grid-cols-2">
          <div>
            <div className="eyebrow mb-4 text-gold">02 / Classes</div>
            <h2 className="font-display text-5xl uppercase tracking-tight">From pre-school to senior school.</h2>
          </div>
          <div className="divide-y divide-paper/15">
            {classes.map(([n, m]) => (
              <div key={n} className="flex justify-between py-4">
                <span className="font-semibold">{n}</span>
                <span className="font-mono text-sm text-gold">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="eyebrow mb-4 text-ink-soft">03 / Contact</div>
            <h2 className="font-display text-4xl uppercase tracking-tight">Come and see us.</h2>
            <p className="mt-3 text-sm opacity-70">
              Office open Mon–Fri, 7am–5pm.<br />+254 700 114 900 · admissions@shuleyetu.ac.ke<br />Nairobi, Kenya
            </p>
          </div>
          <img src={campus} alt="Shule Yetu campus" loading="lazy" width={1200} height={704} className="aspect-[16/9] w-full object-cover" />
        </div>
      </section>

      <footer className="border-t border-paper/10 bg-ink py-8 text-paper/50">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6 px-6 font-mono text-[11px] uppercase tracking-[0.15em]">
          <span>© 2026 Shule Yetu</span><span>Motto: Discipline · Drive · Distinction</span><span>Nairobi, Kenya</span>
        </div>
      </footer>
    </div>
  );
}
