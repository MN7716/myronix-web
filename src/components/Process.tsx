import Reveal from "./Reveal";

const STEPS = [
  { t: "Brief", d: "You tell us the goal, the audience and the deadline. We ask what is missing." },
  { t: "Plan", d: "We agree scope, structure and direction before any design or code is produced." },
  { t: "Create", d: "Design and build happen together, so visuals and technology stay consistent." },
  { t: "Review", d: "You review the work. We refine it with your feedback." },
  { t: "Deliver", d: "Final files or a live product, with what you need to use and maintain it." },
];

export default function Process() {
  return (
    <section id="process" className="bg-white py-20 sm:py-28" aria-labelledby="process-title">
      <div className="container-x">
        <Reveal><h2 id="process-title" className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">How we work</h2></Reveal>
        <ol className="mt-12 grid border-t border-ink md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="border-b border-line py-6 md:border-b-0 md:border-r md:px-5 md:first:pl-0 md:last:border-r-0">
              <Reveal delay={i * 60}>
                <span className="text-sm font-semibold text-blue-dark">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-ink/75">{s.d}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
