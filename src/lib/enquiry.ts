import { SITE } from "../data/site";

export interface Enquiry {
  name: string;
  email: string;
  service: string;
  projectType: string;
  requirements: string;
  budget: string;
  deadline: string;
}

export interface SavedOrder {
  id: string;
  created_at: string;
  full_name: string | null;
  contact_email: string;
  service: string;
  project_type: string;
  requirements: string;
  budget_range: string;
  deadline: string | null;
  status: "new" | "in progress" | "review" | "completed";
}

export const EMPTY_ENQUIRY: Enquiry = {
  name: "",
  email: "",
  service: "",
  projectType: "",
  requirements: "",
  budget: "",
  deadline: "",
};

export const BUDGETS = [
  "Not decided yet",
  "Starter budget",
  "Mid-range budget",
  "Premium budget",
  "Prefer to discuss",
];

export type Errors = Partial<Record<keyof Enquiry, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(e: Enquiry): Errors {
  const err: Errors = {};

  if (e.name.length > 100) {
    err.name = "Name must be 100 characters or fewer.";
  }

  if (!e.email.trim()) {
    err.email = "Enter an email address so we can reply.";
  } else if (!EMAIL_RE.test(e.email.trim()) || e.email.length > 254) {
    err.email = "Enter a valid email address.";
  }

  if (!e.service) {
    err.service = "Choose a service.";
  }

  if (!e.projectType) {
    err.projectType = "Choose a project type.";
  }

  const r = e.requirements.trim();

  if (r.length < 20) {
    err.requirements =
      "Describe your requirements in at least 20 characters.";
  } else if (r.length > 2000) {
    err.requirements =
      "Requirements must be 2000 characters or fewer.";
  }

  if (!e.budget) {
    err.budget = "Choose a budget range.";
  }

  if (e.deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (
      Number.isNaN(Date.parse(e.deadline)) ||
      new Date(e.deadline) < today
    ) {
      err.deadline = "Choose a date that is today or later.";
    }
  }

  return err;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const onlineSubmissionConfigured = Boolean(url && anon);

const ORDER_ID_KEY = "myronix_order_id";
const ACCESS_TOKEN_KEY = "myronix_access_token";

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function submitOnline(e: Enquiry): Promise<string> {
  if (!url || !anon) {
    throw new Error("not-configured");
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error("not-authenticated");
  }

  const userRes = await fetch(
    `${url.replace(/\/$/, "")}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!userRes.ok) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    throw new Error("session-expired");
  }

  const user = await userRes.json();

  if (!user?.id) {
    throw new Error("missing-user-id");
  }

  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/project_enquiries`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: user.id,
          full_name: e.name.trim() || null,
          contact_email: e.email.trim(),
          service: e.service,
          project_type: e.projectType,
          requirements: e.requirements.trim(),
          budget_range: e.budget,
          deadline: e.deadline || null,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`status-${res.status}`);
    }

    const created = await res.json();

    if (!Array.isArray(created) || !created[0]?.id) {
      throw new Error("missing-order-id");
    }

    const orderId = String(created[0].id);

    localStorage.setItem(ORDER_ID_KEY, orderId);

    return orderId;
  } finally {
    window.clearTimeout(t);
  }
}

export function getSavedOrderId(): string | null {
  return localStorage.getItem(ORDER_ID_KEY);
}

export async function getSavedOrder(): Promise<SavedOrder | null> {
  const orderId = getSavedOrderId();

  if (!orderId) {
    return null;
  }

  if (!url || !anon) {
    throw new Error("not-configured");
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error("not-authenticated");
  }

  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 15000);

  try {
    const endpoint =
      `${url.replace(/\/$/, "")}/rest/v1/project_enquiries` +
      `?select=id,created_at,full_name,contact_email,service,project_type,requirements,budget_range,deadline,status` +
      `&id=eq.${encodeURIComponent(orderId)}` +
      `&limit=1`;

    const res = await fetch(endpoint, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`status-${res.status}`);
    }

    const orders = await res.json();

    if (!Array.isArray(orders) || !orders[0]) {
      return null;
    }

    return orders[0] as SavedOrder;
  } finally {
    window.clearTimeout(t);
  }
}

export function clearSavedOrderId(): void {
  localStorage.removeItem(ORDER_ID_KEY);
}

export function mailtoHref(e: Enquiry): string {
  const body = [
    `Service: ${e.service}`,
    `Project type: ${e.projectType}`,
    `Budget range: ${e.budget}`,
    `Deadline: ${e.deadline || "Flexible"}`,
    `Reply-to email: ${e.email}`,
    ...(e.name ? [`Name: ${e.name}`] : []),
    "",
    "Requirements:",
    e.requirements.trim(),
  ].join("\n");

  return `mailto:${SITE.email}?subject=${encodeURIComponent(
    `Project enquiry: ${e.service}`
  )}&body=${encodeURIComponent(body)}`;
}