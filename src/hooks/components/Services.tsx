import { useState } from "react";
import { SERVICES, type Service } from "../data/services";
import Modal from "./Modal";
import Reveal from "./Reveal";

interface Props { onEnquire: (serviceTitle: string, projectType: string) => void }

export default function Services({ onEnquire }: Props) {
  const [active, setActive] = useState<Service | null>(null);

  return (
    <section id="services" className="bg-mist py-20 sm:py-28" aria-labelledby="services-title">
      <div className="container-x">
        <Reveal>
          <h2 id="services-title" className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">What we make</h2>
          <p className="mt-4 max-w-xl text-lg text-ink/75">Select a service to see what it includes and start an enquiry for it.</p>
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <li key={s.id}>
              <Reveal delay={(i % 3) * 70} className="h-full">
                <button type="button" onClick={() => setActive(s)} aria-haspopup="dialog"
                  className="group flex h-full min-h-[11rem] w-full flex-col rounded-md border border-line bg-white p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-blue">
                  <span className="text-sm font-semibold text-blue-dark">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-1 font-display text-xl font-semibold">{s.title}</span>
                  <span className="mt-2 text-ink/75">{s.summary}</span>
                  <span className="mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-blue-dark">
                    <span>{s.items.length ? `${s.items.length} options` : "View details"}</span>
                    <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </span>
                </button>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
      <Modal open={!!active} onClose={() => setActive(null)} label={active ? `${active.title} details` : "Service details"}>
        {active && (
          <div>
            <h3 className="text-3xl font-semibold tracking-tight">{active.title}</h3>
            <p className="mt-3 text-ink/80">{active.detail}</p>
            {active.items.length > 0 ? (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {active.items.map((it) => (
                  <li key={it} className="flex items-center justify-between gap-3 py-3">
                    <span className="font-medium">{it}</span>
                    <button type="button" className="btn btn-ghost-light !min-h-[44px] !px-4 whitespace-nowrap"
                      onClick={() => { onEnquire(active.title, it); setActive(null); }}>Enquire</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-ink/70">Tell us what you have in mind and we will take it from there.</p>
            )}
            <button type="button" className="btn btn-primary mt-8 w-full"
              onClick={() => { onEnquire(active.title, active.items.length ? "" : "General enquiry"); setActive(null); }}>
              Start a {active.title} project
            </button>
          </div>
        )}
      </Modal>
    </section>
  );
}
