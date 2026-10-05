import { useEffect, useState } from "react";
import { NAV } from "../data/site";
import { asset } from "../lib/asset";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("home");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    NAV.forEach((n) => { const el = document.getElementById(n.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const link = (id: string, label: string, cls: string) => (
    <a key={id} href={`#${id}`} onClick={() => setOpen(false)} aria-current={active === id ? "true" : undefined} className={cls}>{label}</a>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="container-x flex h-16 items-center justify-between gap-4 sm:h-[72px]">
        <a href="#home" aria-label="MYRONIX INDUSTRIES, home" className="shrink-0">
          <img src={asset("logo-light-640.png")} srcSet={`${asset("logo-light-640.png")} 640w, ${asset("logo-light.png")} 1892w`} sizes="(min-width: 640px) 190px, 150px"
            width={640} height={161} alt="MYRONIX INDUSTRIES" className="h-10 w-auto sm:h-12" />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => link(n.id, n.label,
            `relative py-2 text-sm font-medium text-ink/80 transition hover:text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-blue after:transition-transform hover:after:scale-x-100 aria-[current=true]:text-ink aria-[current=true]:after:scale-x-100`))}
          <a href="#enquiry" className="btn btn-primary !min-h-[44px]">START A PROJECT</a>
        </nav>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-line md:hidden"
          aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
          <span className="relative block h-3.5 w-5" aria-hidden="true">
            <span className={`absolute left-0 h-0.5 w-5 bg-ink transition-all duration-300 ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-1.5 h-0.5 w-5 bg-ink transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 h-0.5 w-5 bg-ink transition-all duration-300 ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
      </div>
      <div id="mobile-menu" className={`menu-panel grid md:hidden ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!open}>
        <div className="overflow-hidden">
          <nav aria-label="Mobile" className="container-x flex flex-col pb-5">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}
                className="border-t border-line py-4 font-display text-xl font-semibold aria-[current=true]:text-blue" aria-current={active === n.id ? "true" : undefined}>{n.label}</a>
            ))}
            <a href="#enquiry" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} className="btn btn-primary mt-3">START A PROJECT</a>
          </nav>
        </div>
      </div>
    </header>
  );
}
