import { SITE } from "../data/site";

export interface Enquiry {
  name: string; email: string; service: string; projectType: string;
  requirements: string; budget: string; deadline: string;
}
export const EMPTY_ENQUIRY: Enquiry = { name: "", email: "", service: "", projectType: "", requirements: "", budget: "", deadline: "" };
export const BUDGETS = ["Not decided yet", "Starter budget", "Mid-range budget", "Premium budget", "Prefer to discuss"];
export type Errors = Partial<Record<keyof Enquiry, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(e: Enquiry): Errors {
  const err: Errors = {};
  if (e.name.length > 100) err.name = "Name must be 100 characters or fewer.";
  if (!e.email.trim()) err.email = "Enter an email address so we can reply.";
  else if (!EMAIL_RE.test(e.email.trim()) || e.email.length > 254) err.email = "Enter a valid email address.";
  if (!e.service) err.service = "Choose a service.";
  if (!e.projectType) err.projectType = "Choose a project type.";
  const r = e.requirements.trim();
  if (r.length < 20) err.requirements = "Describe your requirements in at least 20 characters.";
  else if (r.length > 2000) err.requirements = "Requirements must be 2000 characters or fewer.";
  if (!e.budget) err.budget = "Choose a budget range.";
  if (e.deadline) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (Number.isNaN(Date.parse(e.deadline)) || new Date(e.deadline) < today) err.deadline = "Choose a date that is today or later.";
  }
  return err;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const onlineSubmissionConfigured = Boolean(url && anon);

/** Sends to Supabase REST (insert-only via RLS). Throws on any failure; resolves only on a real 2xx. */
export async function submitOnline(e: Enquiry): Promise<void> {
  if (!url || !anon) throw new Error("not-configured");
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/project_enquiries`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}`, Prefer: "return=minimal" },
      body: JSON.stringify({
        full_name: e.name.trim() || null,
        contact_email: e.email.trim(),
        service: e.service,
        project_type: e.projectType,
        requirements: e.requirements.trim(),
        budget_range: e.budget,
        deadline: e.deadline || null,
      }),
    });
    if (!res.ok) throw new Error(`status-${res.status}`);
  } finally {
    window.clearTimeout(t);
  }
}

export function mailtoHref(e: Enquiry): string {
  const body = [
    `Service: ${e.service}`, `Project type: ${e.projectType}`, `Budget range: ${e.budget}`,
    `Deadline: ${e.deadline || "Flexible"}`, `Reply-to email: ${e.email}`,
    ...(e.name ? [`Name: ${e.name}`] : []), "", "Requirements:", e.requirements.trim(),
  ].join("\n");
  return `mailto:${SITE.email}?subject=${encodeURIComponent(`Project enquiry: ${e.service}`)}&body=${encodeURIComponent(body)}`;
}
