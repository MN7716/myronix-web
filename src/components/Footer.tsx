import { NAV, SITE } from "../data/site";
import { asset } from "../lib/asset";

export default function Footer() {
  return (
    <footer className="on-dark bg-navy text-white">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <img src={asset("logo-dark-640.png")} width={640} height={161} loading="lazy" alt="MYRONIX INDUSTRIES" className="h-14 w-auto -ml-3" />
          <p className="mt-2 text-sm text-white/75">{SITE.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid gap-2">{NAV.map((n) => <li key={n.id}><a className="inline-block py-1 text-white/85 hover:text-white" href={`#${n.id}`}>{n.label}</a></li>)}</ul>
        </nav>
        <ul className="grid content-start gap-2">
          <li><a className="inline-block py-1 text-white/85 hover:text-white" href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
          <li><a className="inline-block py-1 text-white/85 hover:text-white" href={SITE.instagram.url} target="_blank" rel="noopener noreferrer">Instagram {SITE.instagram.handle}</a></li>
          <li><a className="inline-block py-1 text-white/85 hover:text-white" href={SITE.x.url} target="_blank" rel="noopener noreferrer">X {SITE.x.handle}</a></li>
        </ul>
      </div>
      <div className="border-t border-white/15 py-5 text-center text-sm text-white/70">© {new Date().getFullYear()} MYRONIX INDUSTRIES</div>
    </footer>
  );
}
