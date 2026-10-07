import { SITE } from "../data/site";
import Reveal from "./Reveal";

export default function Collaboration() {
  return (
    <section id="collaboration" className="on-dark bg-navy py-20 text-white sm:py-24" aria-labelledby="collab-title">
      <div className="container-x grid items-end gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <h2 id="collab-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Open to collaborations.</h2>
          <p className="mt-4 max-w-xl text-lg text-white/80">Designers, developers, creators and brands: if you want to build something together, write to us.</p>
        </Reveal>
        <Reveal delay={100} className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <a className="btn btn-primary" href={`mailto:${SITE.email}?subject=${encodeURIComponent("Collaboration with MYRONIX INDUSTRIES")}`}>CONTACT MYRONIX</a>
          <a className="btn btn-ghost-dark" href="#enquiry">START A PROJECT</a>
        </Reveal>
      </div>
    </section>
  );
}
