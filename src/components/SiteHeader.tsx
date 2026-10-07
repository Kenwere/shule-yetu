import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center bg-ink font-display text-lg text-gold">SJA</div>
          <div className="leading-none">
            <div className="font-display text-xl uppercase tracking-tight">St John's Academy</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">Est. 1964 · Nairobi</div>
          </div>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-semibold md:gap-7">
          <a href="/#vision" className="hidden hover:text-gold md:inline">Vision</a>
          <a href="/#classes" className="hidden hover:text-gold md:inline">Classes</a>
          <a href="/#contact" className="hidden hover:text-gold md:inline">Contact</a>
          <Link to="/ask" className="hover:text-gold">Ask us</Link>
          <Link to="/login" className="hover:text-gold">Login</Link>
          <Link to="/register" className="bg-ink px-4 py-2 font-bold uppercase tracking-wide text-paper hover:bg-ink-soft">Register</Link>
        </nav>
      </div>
    </header>
  );
}
