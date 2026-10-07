import { SITE } from "../data/site";
import Reveal from "./Reveal";

const CARDS = [
  { name: "Email", value: SITE.email, href: `mailto:${SITE.email}`, ext: false },
  { name: "Instagram", value: SITE.instagram.handle, href: SITE.instagram.url, ext: true },
  { name: "X", value: SITE.x.handle, href: SITE.x.url, ext: true },
];

export default function Contact() {
  return (
    <section id="contact" className="bg-white py-20 sm:py-28" aria-labelledby="contact-title">
      <div className="container-x">
        <Reveal>
          <h2 id="contact-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Contact</h2>
          <p className="mt-4 text-lg text-ink/75">Projects • Collaborations • Enquiries</p>
        </Reveal>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <li key={c.name}>
              <Reveal delay={i * 70} className="h-full">
                <a href={c.href} {...(c.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex h-full flex-col rounded-md border border-line p-6 transition duration-200 hover:-translate-y-1 hover:border-blue">
                  <span className="text-sm font-medium text-ink/70">{c.name}{c.ext && <span className="sr-only"> (opens in a new tab)</span>}</span>
                  <span className="mt-2 break-all font-display text-xl font-semibold">{c.value}</span>
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
