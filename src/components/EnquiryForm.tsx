import { useEffect, useRef, useState, type FormEvent } from "react";

import { SERVICES } from "../data/services";

import {
  BUDGETS,
  EMPTY_ENQUIRY,
  getSavedOrder,
  mailtoHref,
  onlineSubmissionConfigured,
  submitOnline,
  validate,
  type Enquiry,
  type Errors,
  type SavedOrder,
} from "../lib/enquiry";

import Reveal from "./Reveal";

export interface Prefill {
  service: string;
  projectType: string;
  nonce: number;
}

type Status =
  | "idle"
  | "submitting"
  | "success"
  | "error"
  | "offline";

type OrderLoadStatus = "loading" | "loaded" | "empty" | "error";
type AuthMode = "signin" | "signup";
type AuthState = "checking" | "signedout" | "signedin";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ACCESS_TOKEN_KEY = "myronix_access_token";
const STORAGE_BUCKET = "project-references";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const typesFor = (service: string): string[] => {
  const s = SERVICES.find((x) => x.title === service);

  if (!s) return [];

  return s.items.length
    ? [...s.items, "Other"]
    : ["General enquiry"];
};

const statusLabel = (status: SavedOrder["status"]) => {
  switch (status) {
    case "in progress":
      return "In Progress";
    case "review":
      return "Review";
    case "completed":
      return "Completed";
    default:
      return "New";
  }
};

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function safeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
}

async function getCurrentUser() {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("session-expired");
  }

  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("session-expired");
  }

  const user = await res.json();

  if (!user?.id) {
    throw new Error("missing-user-id");
  }

  return {
    id: String(user.id),
    accessToken,
  };
}

async function uploadReferenceFiles(
  files: File[],
  orderId: string
): Promise<void> {
  if (!files.length) return;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("not-configured");
  }

  const { id: userId, accessToken } = await getCurrentUser();

  for (const file of files) {
    const safeName = safeFileName(file.name);
    const uniqueName = `${crypto.randomUUID()}-${safeName}`;
    const filePath = `${userId}/${orderId}/${uniqueName}`;

    const uploadRes = await fetch(
      `${SUPABASE_URL.replace(
        /\/$/,
        ""
      )}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false",
        },
        body: file,
      }
    );

    if (!uploadRes.ok) {
      let message = "Reference file upload failed.";

      try {
        const result = await uploadRes.json();
        message =
          result.message ||
          result.error ||
          result.error_description ||
          message;
      } catch {
        // Keep the default message.
      }

      throw new Error(message);
    }

    const recordRes = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/project_files`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          order_id: orderId,
          user_id: userId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type || null,
          file_size: file.size,
        }),
      }
    );

    if (!recordRes.ok) {
      throw new Error("Reference file record could not be saved.");
    }
  }
}

export default function EnquiryForm({
  prefill,
}: {
  prefill: Prefill | null;
}) {
  const [data, setData] = useState<Enquiry>(EMPTY_ENQUIRY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);

  const [savedOrder, setSavedOrder] =
    useState<SavedOrder | null>(null);

  const [orderLoadStatus, setOrderLoadStatus] =
    useState<OrderLoadStatus>("loading");

  const [authState, setAuthState] =
    useState<AuthState>("checking");

  const [authMode, setAuthMode] =
    useState<AuthMode>("signin");

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [fileError, setFileError] = useState("");
  const [uploadWarning, setUploadWarning] = useState("");

  const honeypot = useRef<HTMLInputElement>(null);
  const lastSent = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        if (!cancelled) setAuthState("signedout");
        return;
      }

      try {
        const accessToken = localStorage.getItem(
          ACCESS_TOKEN_KEY
        );

        if (!accessToken) {
          if (!cancelled) setAuthState("signedout");
          return;
        }

        const res = await fetch(
          `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!res.ok) {
          localStorage.removeItem(ACCESS_TOKEN_KEY);

          if (!cancelled) setAuthState("signedout");

          return;
        }

        const user = await res.json();

        if (!cancelled) {
          setAuthEmail(user.email || "");
          setAuthState("signedin");
        }
      } catch {
        if (!cancelled) setAuthState("signedout");
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== "signedin") {
      setOrderLoadStatus("empty");
      return;
    }

    let cancelled = false;

    async function loadSavedOrder() {
      setOrderLoadStatus("loading");

      try {
        const order = await getSavedOrder();

        if (cancelled) return;

        if (order) {
          setSavedOrder(order);
          setOrderLoadStatus("loaded");
        } else {
          setSavedOrder(null);
          setOrderLoadStatus("empty");
        }
      } catch {
        if (cancelled) return;

        setSavedOrder(null);
        setOrderLoadStatus("error");
      }
    }

    loadSavedOrder();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  useEffect(() => {
    if (!prefill) return;

    setData((d) => ({
      ...d,
      service: prefill.service,
      projectType: prefill.projectType,
    }));

    setErrors({});
    setStatus("idle");
  }, [prefill]);

  const set = <K extends keyof Enquiry>(
    k: K,
    v: Enquiry[K]
  ) => {
    setData((d) => ({
      ...d,
      [k]: v,
      ...(k === "service" ? { projectType: "" } : {}),
    }));

    setErrors((e) => ({
      ...e,
      [k]: undefined,
    }));
  };

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const incoming = Array.from(e.target.files || []);

    setFileError("");

    if (!incoming.length) {
      setSelectedFiles([]);
      return;
    }

    if (incoming.length > MAX_FILES) {
      setFileError(
        `You can upload up to ${MAX_FILES} reference files.`
      );

      e.target.value = "";
      setSelectedFiles([]);

      return;
    }

    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE) {
        setFileError(
          `"${file.name}" is larger than 10 MB.`
        );

        e.target.value = "";
        setSelectedFiles([]);

        return;
      }

      if (
        file.type &&
        !ALLOWED_FILE_TYPES.includes(file.type)
      ) {
        setFileError(
          `"${file.name}" is not a supported file type.`
        );

        e.target.value = "";
        setSelectedFiles([]);

        return;
      }
    }

    setSelectedFiles(incoming);
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) =>
      current.filter((_, i) => i !== index)
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setFileError("");
  }

  async function handleAuth() {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error(
          "Supabase authentication is not configured."
        );
      }

      if (!authEmail.trim()) {
        throw new Error("Enter your email address.");
      }

      if (authPassword.length < 6) {
        throw new Error(
          "Password must be at least 6 characters."
        );
      }

      if (authMode === "signup") {
        const res = await fetch(
          `${SUPABASE_URL.replace(
            /\/$/,
            ""
          )}/auth/v1/signup`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              email: authEmail.trim(),
              password: authPassword,
            }),
          }
        );

        const result = await res.json();

        if (!res.ok) {
          throw new Error(
            result.msg ||
              result.message ||
              result.error_description ||
              "Could not create your account."
          );
        }

        if (result.access_token) {
          localStorage.setItem(
            ACCESS_TOKEN_KEY,
            result.access_token
          );

          setAuthState("signedin");
          setAuthMessage("Account created successfully.");
        } else {
          setAuthMessage(
            "Account created. Please confirm your email, then sign in."
          );

          setAuthMode("signin");
        }
      } else {
        const res = await fetch(
          `${SUPABASE_URL.replace(
            /\/$/,
            ""
          )}/auth/v1/token?grant_type=password`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              email: authEmail.trim(),
              password: authPassword,
            }),
          }
        );

        const result = await res.json();

        if (!res.ok) {
          throw new Error(
            result.error_description ||
              result.msg ||
              result.message ||
              "Could not sign in."
          );
        }

        if (!result.access_token) {
          throw new Error(
            "No login session was returned."
          );
        }

        localStorage.setItem(
          ACCESS_TOKEN_KEY,
          result.access_token
        );

        setAuthState("signedin");
        setAuthMessage("Signed in successfully.");
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : "Authentication failed."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);

    setSavedOrder(null);
    setOrderLoadStatus("empty");
    setSelectedFiles([]);
    setAuthState("signedout");
    setAuthMessage("");
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const types = typesFor(data.service);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (honeypot.current?.value) return;

    if (authState !== "signedin") {
      setAuthError(
        "Please sign in before sending an enquiry."
      );
      return;
    }

    const errs = validate(data);

    setErrors(errs);

    const first = Object.keys(errs)[0];

    if (first) {
      formRef.current
        ?.querySelector<HTMLElement>(
          `[name="${first}"]`
        )
        ?.focus();

      return;
    }

    if (Date.now() - lastSent.current < 30000) {
      setStatus("error");
      return;
    }

    if (!onlineSubmissionConfigured) {
      setStatus("offline");
      return;
    }

    setStatus("submitting");
    setUploadWarning("");

    try {
      const orderId = await submitOnline(data);

      lastSent.current = Date.now();

      let referenceUploadFailed = false;
      let referenceUploadMessage = "";

      if (selectedFiles.length > 0) {
        try {
          await uploadReferenceFiles(
            selectedFiles,
            orderId
          );
        } catch (err) {
          referenceUploadFailed = true;

          referenceUploadMessage =
            err instanceof Error
              ? err.message
              : "Reference files could not be uploaded.";
        }
      }

      const order = await getSavedOrder();

      setSavedOrder(order);
      setOrderLoadStatus(order ? "loaded" : "empty");

      if (referenceUploadFailed) {
        setUploadWarning(
          `Your enquiry and order were saved, but the reference files could not be uploaded. ${referenceUploadMessage}`
        );
      }

      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const err = (k: keyof Enquiry) => errors[k];

  const aria = (k: keyof Enquiry) =>
    ({
      "aria-invalid": err(k) ? true : undefined,
      "aria-describedby": err(k)
        ? `${k}-err`
        : undefined,
    } as const);

  const Msg = ({ k }: { k: keyof Enquiry }) =>
    err(k) ? (
      <p
        id={`${k}-err`}
        className="mt-1.5 text-sm font-medium text-red-700"
      >
        {err(k)}
      </p>
    ) : null;

  const label = "mb-1.5 block text-sm font-semibold";

  return (
    <section
      id="enquiry"
      className="bg-mist py-20 sm:py-28"
      aria-labelledby="enquiry-title"
    >
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <Reveal>
          <h2
            id="enquiry-title"
            className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl"
          >
            Start a project
          </h2>

          <p className="mt-4 max-w-md text-lg text-ink/75">
            Tell us what you need. Create an account so your
            project order and status can stay connected to you.
          </p>

          {authState === "signedin" && (
            <div className="mt-8 rounded-lg border border-line bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                Signed in
              </p>

              <p className="mt-2 break-all text-sm font-medium">
                {authEmail}
              </p>

              <button
                type="button"
                className="btn btn-ghost-light mt-4"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          )}

          {authState === "signedin" &&
            orderLoadStatus === "loaded" &&
            savedOrder && (
              <div className="mt-6 rounded-lg border border-line bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                  Your MYRONIX order
                </p>

                <h3 className="mt-2 text-xl font-semibold">
                  {savedOrder.service}
                </h3>

                <p className="mt-1 text-sm text-ink/70">
                  {savedOrder.project_type}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold">
                    {statusLabel(savedOrder.status)}
                  </span>

                  <span className="text-sm text-ink/60">
                    Order ID: {savedOrder.id}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-sm">
                  <p>
                    <span className="font-semibold">
                      Budget:
                    </span>{" "}
                    {savedOrder.budget_range}
                  </p>

                  <p>
                    <span className="font-semibold">
                      Deadline:
                    </span>{" "}
                    {savedOrder.deadline || "Flexible"}
                  </p>
                </div>
              </div>
            )}

          {orderLoadStatus === "error" && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-medium text-red-800">
                We could not load your saved order right now.
              </p>
            </div>
          )}
        </Reveal>

        <div>
          {authState === "checking" ? (
            <div className="rounded-lg border border-line bg-white p-8">
              <p className="font-medium">
                Checking your MYRONIX account…
              </p>
            </div>
          ) : authState === "signedout" ? (
            <div className="rounded-lg border border-line bg-white p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                MYRONIX ACCOUNT
              </p>

              <h3 className="mt-2 text-2xl font-semibold">
                {authMode === "signin"
                  ? "Sign in to continue"
                  : "Create your account"}
              </h3>

              <p className="mt-2 text-sm text-ink/70">
                Your account connects your project enquiry
                with its order status.
              </p>

              <div className="mt-6 grid gap-4">
                <div>
                  <label
                    htmlFor="auth-email"
                    className={label}
                  >
                    Email
                  </label>

                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    className="field"
                    value={authEmail}
                    onChange={(e) =>
                      setAuthEmail(e.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className={label}
                  >
                    Password
                  </label>

                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={
                      authMode === "signin"
                        ? "current-password"
                        : "new-password"
                    }
                    className="field"
                    value={authPassword}
                    onChange={(e) =>
                      setAuthPassword(e.target.value)
                    }
                  />
                </div>

                {authError && (
                  <p
                    role="alert"
                    className="rounded-md border border-red-700 bg-red-50 p-4 text-sm font-medium text-red-800"
                  >
                    {authError}
                  </p>
                )}

                {authMessage && (
                  <p
                    role="status"
                    className="rounded-md border border-blue bg-mist p-4 text-sm font-medium"
                  >
                    {authMessage}
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={authLoading}
                  onClick={handleAuth}
                >
                  {authLoading
                    ? "Please wait…"
                    : authMode === "signin"
                    ? "SIGN IN"
                    : "CREATE ACCOUNT"}
                </button>

                <button
                  type="button"
                  className="text-sm font-semibold underline"
                  onClick={() => {
                    setAuthMode((current) =>
                      current === "signin"
                        ? "signup"
                        : "signin"
                    );

                    setAuthError("");
                    setAuthMessage("");
                  }}
                >
                  {authMode === "signin"
                    ? "New customer? Create an account"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </div>
          ) : status === "success" ? (
            <div
              role="status"
              className="rounded-lg border border-blue bg-white p-8"
            >
              <h3 className="text-2xl font-semibold">
                Enquiry received
              </h3>

              <p className="mt-2 text-ink/80">
                Your enquiry was saved. We will reply to{" "}
                {data.email}.
              </p>

              {savedOrder && (
                <div className="mt-6 rounded-md border border-line bg-mist p-5">
                  <p className="text-sm font-semibold">
                    Your Order ID
                  </p>

                  <p className="mt-1 break-all font-mono text-sm">
                    {savedOrder.id}
                  </p>

                  <p className="mt-3 text-sm text-ink/70">
                    Your order is now connected to your
                    MYRONIX account.
                  </p>
                </div>
              )}

              {uploadWarning && (
                <div
                  role="alert"
                  className="mt-5 rounded-md border border-yellow-700 bg-yellow-50 p-4 text-sm font-medium text-yellow-900"
                >
                  {uploadWarning}
                </div>
              )}

              <button
                type="button"
                className="btn btn-ghost-light mt-6"
                onClick={() => {
                  setData(EMPTY_ENQUIRY);
                  setSelectedFiles([]);
                  setFileError("");
                  setUploadWarning("");
                  setStatus("idle");

                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Send another enquiry
              </button>
            </div>
          ) : (
            <form
              ref={formRef}
              onSubmit={onSubmit}
              noValidate
              className="grid gap-5 rounded-lg border border-line bg-white p-6 sm:p-8"
              aria-busy={status === "submitting"}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="service"
                    className={label}
                  >
                    Service
                  </label>

                  <select
                    id="service"
                    name="service"
                    className="field"
                    value={data.service}
                    onChange={(e) =>
                      set("service", e.target.value)
                    }
                    {...aria("service")}
                  >
                    <option value="">
                      Choose a service
                    </option>

                    {SERVICES.map((s) => (
                      <option
                        key={s.id}
                        value={s.title}
                      >
                        {s.title}
                      </option>
                    ))}
                  </select>

                  <Msg k="service" />
                </div>

                <div>
                  <label
                    htmlFor="projectType"
                    className={label}
                  >
                    Project type
                  </label>

                  <select
                    id="projectType"
                    name="projectType"
                    className="field"
                    value={data.projectType}
                    disabled={!data.service}
                    onChange={(e) =>
                      set(
                        "projectType",
                        e.target.value
                      )
                    }
                    {...aria("projectType")}
                  >
                    <option value="">
                      {data.service
                        ? "Choose a type"
                        : "Choose a service first"}
                    </option>

                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <Msg k="projectType" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="requirements"
                  className={label}
                >
                  Requirements
                </label>

                <textarea
                  id="requirements"
                  name="requirements"
                  rows={5}
                  maxLength={2000}
                  className="field"
                  placeholder="What are you making, who is it for, and what should it achieve?"
                  value={data.requirements}
                  onChange={(e) =>
                    set(
                      "requirements",
                      e.target.value
                    )
                  }
                  {...aria("requirements")}
                />

                <div className="flex justify-between">
                  <Msg k="requirements" />

                  <span className="ml-auto mt-1.5 text-sm text-ink/60">
                    {data.requirements.length}/2000
                  </span>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="budget"
                    className={label}
                  >
                    Budget range
                  </label>

                  <select
                    id="budget"
                    name="budget"
                    className="field"
                    value={data.budget}
                    onChange={(e) =>
                      set("budget", e.target.value)
                    }
                    {...aria("budget")}
                  >
                    <option value="">
                      Choose a range
                    </option>

                    {BUDGETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <Msg k="budget" />
                </div>

                <div>
                  <label
                    htmlFor="deadline"
                    className={label}
                  >
                    Deadline{" "}
                    <span className="font-normal text-ink/60">
                      (optional)
                    </span>
                  </label>

                  <input
                    id="deadline"
                    name="deadline"
                    type="date"
                    min={today}
                    className="field"
                    value={data.deadline}
                    onChange={(e) =>
                      set(
                        "deadline",
                        e.target.value
                      )
                    }
                    {...aria("deadline")}
                  />

                  <Msg k="deadline" />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="email"
                    className={label}
                  >
                    Contact email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    className="field"
                    value={data.email}
                    onChange={(e) =>
                      set("email", e.target.value)
                    }
                    {...aria("email")}
                  />

                  <Msg k="email" />
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className={label}
                  >
                    Name{" "}
                    <span className="font-normal text-ink/60">
                      (optional)
                    </span>
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    className="field"
                    value={data.name}
                    onChange={(e) =>
                      set("name", e.target.value)
                    }
                    {...aria("name")}
                  />

                  <Msg k="name" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reference-files"
                  className={label}
                >
                  Reference files{" "}
                  <span className="font-normal text-ink/60">
                    (optional)
                  </span>
                </label>

                <input
                  ref={fileInputRef}
                  id="reference-files"
                  name="reference-files"
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  className="block w-full rounded-md border border-line bg-white p-3 text-sm"
                  onChange={handleFileChange}
                />

                <p className="mt-2 text-xs text-ink/60">
                  Upload up to 5 reference files. Maximum
                  10 MB per file.
                </p>

                {fileError && (
                  <p
                    role="alert"
                    className="mt-2 rounded-md border border-red-700 bg-red-50 p-3 text-sm font-medium text-red-800"
                  >
                    {fileError}
                  </p>
                )}

                {selectedFiles.length > 0 && (
                  <div className="mt-3 rounded-md border border-line bg-mist p-4">
                    <p className="text-sm font-semibold">
                      Selected references
                    </p>

                    <div className="mt-3 grid gap-2">
                      {selectedFiles.map(
                        (file, index) => (
                          <div
                            key={`${file.name}-${file.size}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-md bg-white p-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {file.name}
                              </p>

                              <p className="text-xs text-ink/60">
                                {(
                                  file.size /
                                  1024 /
                                  1024
                                ).toFixed(2)}{" "}
                                MB
                              </p>
                            </div>

                            <button
                              type="button"
                              className="shrink-0 text-sm font-semibold underline"
                              onClick={() =>
                                removeSelectedFile(
                                  index
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
              >
                <label>
                  Leave this empty

                  <input
                    ref={honeypot}
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>

              {status === "error" && (
                <p
                  role="alert"
                  className="rounded-md border border-red-700 bg-red-50 p-4 text-sm font-medium text-red-800"
                >
                  Your enquiry was not sent. Please check
                  your connection and try again in a moment,
                  or email{" "}
                  <a
                    className="underline"
                    href={mailtoHref(data)}
                  >
                    myronix.industries@gmail.com
                  </a>
                  .
                </p>
              )}

              {status === "offline" && (
                <div
                  role="status"
                  className="rounded-md border border-blue bg-mist p-4 text-sm"
                >
                  <p className="font-semibold">
                    Not sent yet.
                  </p>

                  <p className="mt-1 text-ink/80">
                    Online submission is not set up on this
                    deployment, so nothing has been sent.
                    Your enquiry is ready to send by email.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <a
                      className="btn btn-primary !min-h-[44px]"
                      href={mailtoHref(data)}
                    >
                      Open in my email app
                    </a>

                    <button
                      type="button"
                      className="btn btn-ghost-light !min-h-[44px]"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            decodeURIComponent(
                              mailtoHref(data).split(
                                "body="
                              )[1] ?? ""
                            )
                          );

                          setCopied(true);
                        } catch {
                          setCopied(false);
                        }
                      }}
                    >
                      {copied
                        ? "Copied"
                        : "Copy details"}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full sm:w-auto sm:justify-self-start"
                disabled={status === "submitting"}
              >
                {status === "submitting"
                  ? "Sending…"
                  : "SEND ENQUIRY"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}