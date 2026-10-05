import { useEffect, useRef, useState, type FormEvent } from "react";
import { SERVICES } from "../data/services";
import { BUDGETS, EMPTY_ENQUIRY, mailtoHref, onlineSubmissionConfigured, submitOnline, validate, type Enquiry, type Errors } from "../lib/enquiry";
import Reveal from "./Reveal";

export interface Prefill { service: string; projectType: string; nonce: number }
type Status = "idle" | "submitting" | "success" | "error" | "offline";

const typesFor = (service: string): string[] => {
  const s = SERVICES.find((x) => x.title === service);
  if (!s) return [];
  return s.items.length ? [...s.items, "Other"] : ["General enquiry"];
};

export default function EnquiryForm({ prefill }: { prefill: Prefill | null }) {
  const [data, setData] = useState<Enquiry>(EMPTY_ENQUIRY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const lastSent = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!prefill) return;
    setData((d) => ({ ...d, service: prefill.service, projectType: prefill.projectType }));
    setErrors({}); setStatus("idle");
  }, [prefill]);

  const set = <K extends keyof Enquiry>(k: K, v: Enquiry[K]) => {
    setData((d) => ({ ...d, [k]: v, ...(k === "service" ? { projectType: "" } : {}) }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const today = new Date().toISOString().slice(0, 10);
  const types = typesFor(data.service);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (honeypot.current?.value) return; // bot trap: no UI, no submission
    const errs = validate(data);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) { formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    if (Date.now() - lastSent.current < 30000) { setStatus("error"); return; }
    if (!onlineSubmissionConfigured) { setStatus("offline"); return; }
    setStatus("submitting");
    try {
      await submitOnline(data);
      lastSent.current = Date.now();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const err = (k: keyof Enquiry) => errors[k];
  const aria = (k: keyof Enquiry) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `${k}-err` : undefined } as const);
  const Msg = ({ k }: { k: keyof Enquiry }) => (err(k) ? <p id={`${k}-err`} className="mt-1.5 text-sm font-medium text-red-700">{err(k)}</p> : null);
  const label = "mb-1.5 block text-sm font-semibold";

  return (
    <section id="enquiry" className="bg-mist py-20 sm:py-28" aria-labelledby="enquiry-title">
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <Reveal>
          <h2 id="enquiry-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Start a project</h2>
          <p className="mt-4 max-w-md text-lg text-ink/75">Tell us what you need. The more specific you are, the more useful our reply will be.</p>
        </Reveal>

        <div>
          {status === "success" ? (
            <div role="status" className="rounded-lg border border-blue bg-white p-8">
              <h3 className="text-2xl font-semibold">Enquiry received</h3>
              <p className="mt-2 text-ink/80">Your enquiry was saved. We will reply to {data.email}.</p>
              <button type="button" className="btn btn-ghost-light mt-6" onClick={() => { setData(EMPTY_ENQUIRY); setStatus("idle"); }}>Send another enquiry</button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-5 rounded-lg border border-line bg-white p-6 sm:p-8" aria-busy={status === "submitting"}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="service" className={label}>Service</label>
                  <select id="service" name="service" className="field" value={data.service} onChange={(e) => set("service", e.target.value)} {...aria("service")}>
                    <option value="">Choose a service</option>
                    {SERVICES.map((s) => <option key={s.id} value={s.title}>{s.title}</option>)}
                  </select><Msg k="service" />
                </div>
                <div>
                  <label htmlFor="projectType" className={label}>Project type</label>
                  <select id="projectType" name="projectType" className="field" value={data.projectType} disabled={!data.service} onChange={(e) => set("projectType", e.target.value)} {...aria("projectType")}>
                    <option value="">{data.service ? "Choose a type" : "Choose a service first"}</option>
                    {types.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select><Msg k="projectType" />
                </div>
              </div>
              <div>
                <label htmlFor="requirements" className={label}>Requirements</label>
                <textarea id="requirements" name="requirements" rows={5} maxLength={2000} className="field" placeholder="What are you making, who is it for, and what should it achieve?"
                  value={data.requirements} onChange={(e) => set("requirements", e.target.value)} {...aria("requirements")} />
                <div className="flex justify-between"><Msg k="requirements" /><span className="ml-auto mt-1.5 text-sm text-ink/60">{data.requirements.length}/2000</span></div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="budget" className={label}>Budget range</label>
                  <select id="budget" name="budget" className="field" value={data.budget} onChange={(e) => set("budget", e.target.value)} {...aria("budget")}>
                    <option value="">Choose a range</option>
                    {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select><Msg k="budget" />
                </div>
                <div>
                  <label htmlFor="deadline" className={label}>Deadline <span className="font-normal text-ink/60">(optional)</span></label>
                  <input id="deadline" name="deadline" type="date" min={today} className="field" value={data.deadline} onChange={(e) => set("deadline", e.target.value)} {...aria("deadline")} />
                  <Msg k="deadline" />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className={label}>Contact email</label>
                  <input id="email" name="email" type="email" autoComplete="email" maxLength={254} className="field" value={data.email} onChange={(e) => set("email", e.target.value)} {...aria("email")} />
                  <Msg k="email" />
                </div>
                <div>
                  <label htmlFor="name" className={label}>Name <span className="font-normal text-ink/60">(optional)</span></label>
                  <input id="name" name="name" type="text" autoComplete="name" maxLength={100} className="field" value={data.name} onChange={(e) => set("name", e.target.value)} {...aria("name")} />
                  <Msg k="name" />
                </div>
              </div>
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Leave this empty<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <p className="text-sm text-ink/70">File uploads are not available on this site. Share reference links in the requirements box.</p>

              {status === "error" && (
                <p role="alert" className="rounded-md border border-red-700 bg-red-50 p-4 text-sm font-medium text-red-800">
                  Your enquiry was not sent. Please check your connection and try again in a moment, or email {" "}
                  <a className="underline" href={mailtoHref(data)}>myronix.industries@gmail.com</a>.
                </p>
              )}
              {status === "offline" && (
                <div role="status" className="rounded-md border border-blue bg-mist p-4 text-sm">
                  <p className="font-semibold">Not sent yet.</p>
                  <p className="mt-1 text-ink/80">Online submission is not set up on this deployment, so nothing has been sent. Your enquiry is ready to send by email.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <a className="btn btn-primary !min-h-[44px]" href={mailtoHref(data)}>Open in my email app</a>
                    <button type="button" className="btn btn-ghost-light !min-h-[44px]" onClick={async () => {
                      try { await navigator.clipboard.writeText(decodeURIComponent(mailtoHref(data).split("body=")[1] ?? "")); setCopied(true); } catch { setCopied(false); }
                    }}>{copied ? "Copied" : "Copy details"}</button>
                  </div>
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full sm:w-auto sm:justify-self-start" disabled={status === "submitting"}>
                {status === "submitting" ? "Sending…" : "SEND ENQUIRY"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
