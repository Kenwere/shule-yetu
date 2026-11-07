import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import campus from "@/assets/campus.jpg";
import crest from "@/assets/crest.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shule Yetu" },
      { name: "description", content: "Discover Shule Yetu, the school community portal." },
      { property: "og:title", content: "Shule Yetu" },
      { property: "og:description", content: "Learning, community, and school life." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});
const features = [
  ["▣", "Smart classrooms", "Technology-enabled learning for all"],
  ["♧", "Experienced faculty", "Qualified mentors who inspire"],
  ["▤", "Safe transport", "GPS-enabled buses for secure travel"],
  ["❋", "Holistic development", "Mind · Body · Values"],
  ["⚗", "Modern labs", "Well-equipped labs for practical learning"],
];
const academics = [
  ["▣", "Strong foundations", "A thoughtful curriculum for every stage of growth."],
  ["♙", "Experienced faculty", "Dedicated teachers bring out the best in every child."],
  ["✳", "Innovative learning", "Activity-based learning for curious minds."],
  ["🏆", "Excellence driven", "A balance of academics, sports, and life skills."],
];
const facilities = [
  ["Smart classrooms", "Digital classrooms with modern learning tools."],
  ["Science laboratories", "Hands-on learning that encourages discovery."],
  ["Library", "A welcoming space for reading and research."],
  ["Transport", "Safe, reliable transport for school routes."],
];
function Index() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main>
        <section className="relative min-h-[560px] overflow-hidden md:min-h-[640px]">
          <img
            src={campus}
            alt="Students at their school campus"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071c19]/90 via-[#071c19]/55 to-transparent" />
          <div className="relative mx-auto flex min-h-[560px] max-w-6xl items-center px-6 py-20 md:min-h-[640px]">
            <div className="max-w-2xl text-paper">
              <p className="eyebrow mb-5 text-gold">Welcome to Shule Yetu</p>
              <h1 className="font-display text-5xl font-bold leading-[1.04] md:text-7xl">
                Inspiring excellence,
                <br />
                building <span className="text-gold">futures.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-paper/85 md:text-lg">
                A vibrant school community where every learner is encouraged to grow, discover their
                strengths, and prepare for a bright future.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="bg-gold px-5 py-3 text-sm font-bold uppercase text-ink hover:bg-gold/90"
                >
                  Admissions open →
                </Link>
                <a
                  href="#campus"
                  className="border border-paper/80 px-5 py-3 text-sm font-bold uppercase hover:bg-paper hover:text-ink"
                >
                  Explore campus →
                </a>
              </div>
            </div>
          </div>
        </section>
        <section className="relative z-10 mx-auto -mt-8 grid max-w-6xl gap-3 rounded-xl border border-ink/10 bg-white px-5 py-5 shadow-lg sm:grid-cols-2 lg:grid-cols-5">
          {features.map(([icon, title, body]) => (
            <article
              key={title}
              className="flex items-center gap-3 border-ink/10 px-2 py-2 lg:border-r last:border-0"
            >
              <span className="text-3xl text-ink">{icon}</span>
              <div>
                <h2 className="text-sm font-bold text-ink">{title}</h2>
                <p className="mt-1 text-xs leading-snug text-ink-soft">{body}</p>
              </div>
            </article>
          ))}
        </section>
        <section
          id="campus"
          className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2 md:items-center"
        >
          <div className="relative">
            <img
              src={campus}
              alt="School grounds and students"
              className="h-[320px] w-full rounded-lg object-cover shadow-md"
            />
            <img
              src={crest}
              alt=""
              className="absolute -bottom-5 -right-4 h-20 w-20 rounded-full border-4 border-paper bg-white object-contain shadow"
            />
          </div>
          <div>
            <p className="eyebrow text-gold">Welcome to</p>
            <h2 className="mt-2 font-display text-4xl font-bold text-ink">Shule Yetu</h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              We are a learning community committed to helping students become confident,
              compassionate, and curious citizens. We bring academic learning together with strong
              values and opportunities to grow.
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3 text-center">
              <div>
                <strong className="font-display text-2xl text-ink">Every</strong>
                <p className="text-xs text-ink-soft">learner matters</p>
              </div>
              <div>
                <strong className="font-display text-2xl text-ink">One</strong>
                <p className="text-xs text-ink-soft">school community</p>
              </div>
              <div>
                <strong className="font-display text-2xl text-ink">Bright</strong>
                <p className="text-xs text-ink-soft">futures ahead</p>
              </div>
            </div>
            <Link
              to="/register"
              className="mt-6 inline-block bg-ink px-5 py-3 text-sm font-bold uppercase text-paper hover:bg-ink-soft"
            >
              Register your school →
            </Link>
          </div>
        </section>
        <section id="academics" className="mx-auto max-w-6xl px-6 pb-14">
          <p className="eyebrow text-gold">Academics</p>
          <h2 className="mt-1 font-display text-3xl font-bold">Explore. Learn. Excel.</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {academics.map(([icon, title, body]) => (
              <article
                key={title}
                className="rounded-lg border border-ink/10 bg-white p-5 text-center shadow-sm"
              >
                <span className="text-3xl text-ink">{icon}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="facilities" className="mx-auto max-w-6xl px-6 pb-14">
          <p className="eyebrow text-gold">Facilities</p>
          <h2 className="mt-1 font-display text-3xl font-bold">A place to grow</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {facilities.map(([title, body], i) => (
              <article
                key={title}
                className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-sm"
              >
                <img
                  src={campus}
                  alt=""
                  className="h-40 w-full object-cover"
                  style={{ objectPosition: ["20%", "40%", "70%", "90%"][i] }}
                />
                <div className="p-4">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-6 pb-14">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow text-gold">Student life</p>
              <h2 className="mt-1 font-display text-3xl font-bold">
                Learning beyond the classroom
              </h2>
            </div>
            <Link
              to="/register"
              className="hidden border border-ink px-4 py-2 text-xs font-bold uppercase sm:block"
            >
              Join our community →
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <img
                key={i}
                src={campus}
                alt="School life"
                className="h-32 w-full rounded object-cover md:h-40"
                style={{ objectPosition: ["0%", "20%", "40%", "60%", "80%"][i] }}
              />
            ))}
          </div>
        </section>
        <section className="mx-auto mb-8 flex max-w-6xl flex-wrap items-center justify-between gap-5 rounded-lg bg-ink px-7 py-7 text-paper">
          <div>
            <p className="font-display text-2xl font-bold text-gold">Admissions are open</p>
            <p className="mt-1 text-sm text-paper/80">
              Give your learner a bright start with Shule Yetu.
            </p>
          </div>
          <Link to="/register" className="bg-gold px-5 py-3 text-sm font-bold uppercase text-ink">
            Enquire now →
          </Link>
        </section>
      </main>
      <footer className="bg-ink py-10 text-paper">
        <div className="mx-auto grid max-w-6xl gap-7 px-6 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex items-center gap-3">
            <img src={crest} alt="" className="h-12 w-12 rounded-full bg-white object-contain" />
            <div>
              <div className="font-display text-xl font-bold">Shule Yetu</div>
              <p className="text-xs text-paper/60">Learning together, growing together.</p>
            </div>
          </div>
          <div>
            <h2 className="eyebrow text-gold">Quick links</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm text-paper/75">
              <Link to="/">Home</Link>
              <Link to="/register">Admissions</Link>
              <Link to="/login">Login</Link>
            </div>
          </div>
          <div>
            <h2 className="eyebrow text-gold">School portal</h2>
            <p className="mt-3 text-sm text-paper/75">
              Manage students, fees, teachers, and school updates.
            </p>
          </div>
          <div>
            <h2 className="eyebrow text-gold">Contact</h2>
            <Link to="/ask" className="mt-3 inline-block text-sm text-paper/75">
              Contact Shule Yetu
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-paper/15 px-6 pt-4 text-xs text-paper/60">
          © {new Date().getFullYear()} Shule Yetu. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
