import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import crest from "@/assets/crest.jpg";

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    void authClient
      .getSession()
      .then(({ data }) => setSignedIn(!!data?.user))
      .catch(() => setSignedIn(false));
  }, []);
  return (
    <>
      <div className="hidden bg-ink text-paper md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 text-xs">
          <span>✉ info@shuleyetu.school · ☎ School community portal</span>
          <div className="flex items-center gap-5">
            <Link to="/" hash="campus">
              News & events
            </Link>
            <Link to="/parent-login">Parent login</Link>
            <Link to="/register" className="bg-gold px-3 py-2 font-bold text-ink">
              Admissions open
            </Link>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-6xl items-center justify-between gap-4 px-5 md:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <img src={crest} alt="" className="h-11 w-11 rounded-full object-contain" />
            <div className="leading-tight">
              <div className="font-display text-xl font-bold uppercase tracking-tight">
                Shule Yetu
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                School community
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-semibold uppercase md:gap-6">
            <Link to="/" className="hidden hover:text-gold sm:inline">
              Home
            </Link>
            <Link to="/" hash="campus" className="hidden hover:text-gold sm:inline">
              About us
            </Link>
            <Link to="/" hash="academics" className="hidden hover:text-gold sm:inline">
              Academics
            </Link>
            <Link to="/" hash="facilities" className="hidden hover:text-gold md:inline">
              Facilities
            </Link>
            <Link to="/" hash="campus" className="hidden hover:text-gold md:inline">
              Gallery
            </Link>
            {signedIn && (
              <Link to="/dashboard" className="hover:text-gold">
                Dashboard
              </Link>
            )}
            <Link to="/login" className="hover:text-gold">
              Staff login
            </Link>
            <Link to="/parent-login" className="hidden hover:text-gold lg:inline">
              Parent login
            </Link>
            <Link to="/register" className="bg-gold px-3 py-2 font-bold text-ink md:px-4">
              Register
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
