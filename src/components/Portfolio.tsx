import { useMemo, useState } from "react";
import { CATEGORIES, PROJECTS, type Project } from "../data/portfolio";
import Concept from "./Concept";
import Modal from "./Modal";
import Reveal from "./Reveal";

const badge = (p: Project) => (p.type === "concept" ? "MYRONIX CONCEPT" : "CLIENT PROJECT");

export default function Portfolio({ onEnquire }: { onEnquire: () => void }) {
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>("All");
  const [open, setOpen] = useState<Project | null>(null);
  const list = useMemo(() => (filter === "All" ? PROJECTS : PROJECTS.filter((p) => p.category === filter)), [filter]);

  return (
    <section id="portfolio" className="bg-white py-20 sm:py-28" aria-labelledby="portfolio-title">
      <div className="container-x">
        <Reveal>
          <h2 id="portfolio-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Portfolio</h2>
          <p className="mt-4 max-w-xl text-lg text-ink/75">Self-initiated MYRONIX concepts. Each one is labelled; none is presented as client work.</p>
        </Reveal>
        <div role="group" aria-label="Filter projects by category" className="mt-8 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={filter === c} onClick={() => setFilter(c)}
              className={`min-h-[44px] rounded-md border px-5 text-sm font-semibold transition ${filter === c ? "border-navy bg-navy text-white" : "border-ink/25 hover:border-ink"}`}>{c}</button>
          ))}
        </div>
        <p className="sr-only" role="status" aria-live="polite">{list.length} {list.length === 1 ? "project" : "projects"} shown</p>
        {list.length === 0 ? (
          <p className="mt-12 rounded-md border border-dashed border-ink/25 p-8 text-ink/75">No projects in this category yet.</p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.id}>
                <article className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-white">
                  <div className="relative aspect-[4/3] overflow-hidden bg-mist">
                    <Concept kind={p.kind} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute left-3 top-3 rounded-md bg-navy px-3 py-1 text-xs font-semibold text-white">{badge(p)}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-sm font-medium text-blue-dark">{p.category}</p>
                    <h3 className="mt-1 text-xl font-semibold">{p.title}</h3>
                    <p className="mt-2 text-ink/75">{p.description}</p>
                    <button type="button" onClick={() => setOpen(p)} aria-haspopup="dialog" aria-label={`View project: ${p.title}`}
                      className="mt-auto self-start pt-5 text-sm font-semibold text-ink underline decoration-blue decoration-2 underline-offset-4 hover:text-blue-dark">View Project</button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal variant="center" open={!!open} onClose={() => setOpen(null)} label={open ? `${open.title} project` : "Project"}>
        {open && (
          <div>
            <div className="overflow-hidden rounded-md"><Concept kind={open.kind} className="block h-auto w-full" /></div>
            <p className="mt-5 text-sm font-semibold text-blue-dark">{open.category} · {badge(open)}</p>
            <h3 className="mt-1 text-2xl font-semibold">{open.title}</h3>
            <p className="mt-3 text-ink/80">{open.detail}</p>
            {open.type === "concept" && <p className="mt-3 text-sm text-ink/70">This is a MYRONIX concept created to explore an approach. It was not made for a client.</p>}
            <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => { setOpen(null); onEnquire(); }}>Start a similar project</button>
          </div>
        )}
      </Modal>
    </section>
  );
}
