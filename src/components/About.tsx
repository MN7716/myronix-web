import Reveal from "./Reveal";

const AREAS = ["Digital creativity", "Graphic design", "Websites", "Applications", "Programming", "AI", "Digital media", "Technology", "Innovation"];

export default function About() {
  return (
    <section id="about" className="bg-white py-20 sm:py-28" aria-labelledby="about-title">
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <Reveal><h2 id="about-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">A technology, digital and creative studio.</h2></Reveal>
        <Reveal delay={100}>
          <p className="text-lg leading-relaxed text-ink/80">
            MYRONIX INDUSTRIES brings design and engineering together. The same studio that shapes a brand's visuals can build its website, its app and the content around it, so the result feels like one considered system.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink/80">Our work is guided by modern design, clear communication and practical technology.</p>
          <ul className="mt-8 grid grid-cols-2 border-t border-line sm:grid-cols-3" aria-label="Areas of work">
            {AREAS.map((a) => <li key={a} className="border-b border-line py-3 pr-3 font-display text-base font-semibold">{a}</li>)}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
