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

type Deliverable = {
  id: string;
  order_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  is_preview: boolean;
  payment_required: boolean;
  created_at: string;
};

type DeliverableLoadStatus = "idle" | "loading" | "loaded" | "empty" | "error";

type ProjectActivity = {
  id: string;
  order_id: string;
  user_id: string;
  actor_role: string;
  activity_type: string;
  message: string;
  created_at: string;
};

type ProjectMessage = {
  id: string;
  order_id: string;
  user_id: string;
  sender_role: string;
  message: string;
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ACCESS_TOKEN_KEY = "myronix_access_token";
const STORAGE_BUCKET = "project-references";
const DELIVERABLE_BUCKET = "project-deliverables";

const UPI_ID = "manowar000007@oksbi";
const UPI_NAME = "MYRONIX INDUSTRIES";
const UPI_LINK = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&cu=INR`;
const UPI_QR_PATH = "/GooglePay_QR.png";

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


type PaymentInfo = {
  status: string | null;
  submittedAt: string | null;
};

async function loadPaymentStatus(orderId: string): Promise<PaymentInfo> {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { status: null, submittedAt: null };
  }

  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/project_enquiries?id=eq.${encodeURIComponent(
      orderId
    )}&select=payment_status,payment_submitted_at`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Payment status could not be loaded.");
  }

  const rows = await res.json();
  return {
    status: rows?.[0]?.payment_status ?? null,
    submittedAt: rows?.[0]?.payment_submitted_at ?? null,
  };
}

async function submitPaymentConfirmation(orderId: string): Promise<void> {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/submit_payment_confirmation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ p_order_id: orderId }),
    }
  );

  if (!res.ok) {
    const result = await res.json().catch(() => ({}));
    throw new Error(
      result?.message ||
        result?.details ||
        result?.hint ||
        "Payment confirmation could not be submitted."
    );
  }
}

async function loadDeliverables(orderId: string): Promise<Deliverable[]> {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return [];
  }

  const res = await fetch(
    `${SUPABASE_URL.replace(
      /\/$/,
      ""
    )}/rest/v1/project_deliverables?order_id=eq.${encodeURIComponent(
      orderId
    )}&select=id,order_id,user_id,file_name,file_path,file_type,file_size,is_preview,payment_required,created_at&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Deliverables could not be loaded.");
  }

  return await res.json();
}

async function getSignedDeliverableUrl(filePath: string): Promise<string> {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/sign/${DELIVERABLE_BUCKET}/${filePath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 * 15 }),
    }
  );

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      result.message ||
        result.error ||
        result.error_description ||
        "The file could not be opened."
    );
  }

  const signedPath = result.signedURL || result.signedUrl || result.path;

  if (!signedPath) {
    throw new Error("No secure file URL was returned.");
  }

  if (/^https?:\/\//i.test(signedPath)) {
    return signedPath;
  }

  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;
}

async function loadProjectActivities(orderId: string): Promise<ProjectActivity[]> {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return [];

  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/project_activities?order_id=eq.${encodeURIComponent(orderId)}&select=id,order_id,user_id,actor_role,activity_type,message,created_at&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) throw new Error("Project timeline could not be loaded.");
  return await res.json();
}

async function loadProjectMessages(orderId: string): Promise<ProjectMessage[]> {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return [];

  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/project_messages?order_id=eq.${encodeURIComponent(orderId)}&select=id,order_id,user_id,sender_role,message,created_at&order=created_at.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) throw new Error("Messages could not be loaded.");
  return await res.json();
}

async function sendProjectMessage(orderId: string, message: string): Promise<ProjectMessage> {
  const accessToken = getAccessToken();

  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const { id: userId } = await getCurrentUser();
  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/project_messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        order_id: orderId,
        user_id: userId,
        sender_role: "customer",
        message: message.trim(),
      }),
    }
  );

  const result = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(result?.message || result?.details || "Message could not be sent.");
  }

  return Array.isArray(result) ? result[0] : result;
}

function formatDeliverableSize(size: number | null): string {
  if (!size || size <= 0) return "Size unavailable";

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [deliverableLoadStatus, setDeliverableLoadStatus] =
    useState<DeliverableLoadStatus>("idle");
  const [deliverableError, setDeliverableError] = useState("");
  const [openingDeliverableId, setOpeningDeliverableId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentSubmittedAt, setPaymentSubmittedAt] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageError, setMessageError] = useState("");

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

  async function refreshCustomerWork(orderId: string) {
    setDeliverableLoadStatus("loading");
    setDeliverableError("");

    try {
      const [statusResult, workResult] = await Promise.all([
        loadPaymentStatus(orderId),
        loadDeliverables(orderId),
      ]);

      setPaymentStatus(statusResult.status);
      setPaymentSubmittedAt(statusResult.submittedAt);
      setDeliverables(workResult);
      setDeliverableLoadStatus(workResult.length ? "loaded" : "empty");
    } catch (err) {
      setDeliverableLoadStatus("error");
      setDeliverableError(
        err instanceof Error
          ? err.message
          : "Your MYRONIX work could not be loaded."
      );
    }
  }

  async function refreshActivities(orderId: string) {
    setActivitiesLoading(true);
    setActivitiesError("");
    try {
      const result = await loadProjectActivities(orderId);
      setActivities(result);
    } catch (err) {
      setActivitiesError(
        err instanceof Error ? err.message : "Project timeline could not be loaded."
      );
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function refreshMessages(orderId: string) {
    setMessagesLoading(true);
    setMessageError("");
    try {
      const result = await loadProjectMessages(orderId);
      setMessages(result);
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Messages could not be loaded.");
    } finally {
      setMessagesLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!savedOrder || !messageText.trim()) return;
    setMessageSending(true);
    setMessageError("");
    try {
      const message = await sendProjectMessage(savedOrder.id, messageText);
      setMessages((current) => [...current, message]);
      setMessageText("");
      await refreshActivities(savedOrder.id);
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setMessageSending(false);
    }
  }

  async function handlePaymentConfirmation() {
    if (!savedOrder || paymentStatus === "paid" || paymentSubmitting) return;

    setPaymentSubmitting(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      await submitPaymentConfirmation(savedOrder.id);
      setPaymentSubmittedAt(new Date().toISOString());
      setPaymentMessage(
        "Payment confirmation submitted. MYRONIX will verify your payment before the final work is unlocked."
      );
      await refreshCustomerWork(savedOrder.id);
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : "Payment confirmation could not be submitted."
      );
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function openDeliverable(file: Deliverable) {
    if (file.payment_required && paymentStatus !== "paid") {
      setDeliverableError(
        "Final work is locked until your payment is marked as paid."
      );
      return;
    }

    setOpeningDeliverableId(file.id);
    setDeliverableError("");

    try {
      const url = await getSignedDeliverableUrl(file.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDeliverableError(
        err instanceof Error
          ? err.message
          : "The file could not be opened."
      );
    } finally {
      setOpeningDeliverableId(null);
    }
  }

  useEffect(() => {
    if (!savedOrder || authState !== "signedin") {
      setDeliverables([]);
      setPaymentStatus(null);
      setPaymentSubmittedAt(null);
      setPaymentMessage("");
      setPaymentError("");
      setDeliverableLoadStatus("empty");
      setActivities([]);
      setActivitiesError("");
      return;
    }

    refreshCustomerWork(savedOrder.id);
    refreshMessages(savedOrder.id);
    refreshActivities(savedOrder.id);
  }, [savedOrder?.id, authState]);

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
    setDeliverables([]);
    setPaymentStatus(null);
    setPaymentSubmittedAt(null);
    setPaymentMessage("");
    setPaymentError("");
    setShowPaymentQr(false);
    setDeliverableError("");
    setDeliverableLoadStatus("empty");
    setMessages([]);
    setMessageText("");
    setMessageError("");
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

      if (order) {
        await refreshCustomerWork(order.id);
      }

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

          {authState === "signedin" &&
            savedOrder &&
            orderLoadStatus === "loaded" && (
              <div className="mt-6 rounded-lg border border-line bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                      Your MYRONIX work
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">
                      Files & deliverables
                    </h3>
                    <p className="mt-1 text-sm text-ink/70">
                      Preview files are available when uploaded. Final files unlock after payment.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost-light"
                    disabled={deliverableLoadStatus === "loading"}
                    onClick={() => refreshCustomerWork(savedOrder.id)}
                  >
                    {deliverableLoadStatus === "loading" ? "Refreshing…" : "Refresh"}
                  </button>
                </div>

                {paymentStatus && (
                  <div className="mt-5 rounded-md border border-line bg-mist p-4">
                    <p className="text-sm">
                      <span className="font-semibold">Payment status:</span>{" "}
                      {paymentStatus === "paid" ? "Paid" : "Pending"}
                    </p>
                  </div>
                )}

                {paymentStatus !== "paid" && (
                  <div className="mt-5 rounded-lg border border-line bg-white p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                          PAYMENT
                        </p>
                        <h4 className="mt-2 text-lg font-semibold">Pay via UPI</h4>
                        <p className="mt-1 max-w-xl text-sm text-ink/70">
                          Pay using a compatible UPI app. If the button does not open your UPI app, use the QR code below.
                        </p>
                      </div>

                      <a
                        href={UPI_LINK}
                        className="btn btn-primary shrink-0 text-center"
                      >
                        PAY VIA UPI
                      </a>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-ghost-light"
                        onClick={() => setShowPaymentQr((current) => !current)}
                      >
                        {showPaymentQr ? "HIDE QR" : "SCAN QR"}
                      </button>

                      <span className="text-xs text-ink/60">UPI: {UPI_ID}</span>
                    </div>

                    {showPaymentQr && (
                      <div className="mt-5 flex justify-center rounded-lg border border-line bg-white p-5">
                        <div className="text-center">
                          <img
                            src={UPI_QR_PATH}
                            alt="Google Pay UPI QR code"
                            className="mx-auto h-64 w-64 max-w-full object-contain"
                          />
                          <p className="mt-3 text-xs text-ink/60">
                            Scan with a UPI app to pay.
                          </p>
                        </div>
                      </div>
                    )}

                    {paymentSubmittedAt && (
                      <div className="mt-5 rounded-md border border-yellow-700 bg-yellow-50 p-4">
                        <p className="text-sm font-semibold text-yellow-900">
                          Payment confirmation already submitted
                        </p>
                        <p className="mt-1 text-sm text-yellow-900/80">
                          MYRONIX still needs to verify the payment. Final work will remain locked until verification.
                        </p>
                      </div>
                    )}

                    {paymentMessage && (
                      <div role="status" className="mt-4 rounded-md border border-blue bg-mist p-4 text-sm font-medium">
                        {paymentMessage}
                      </div>
                    )}

                    {paymentError && (
                      <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                        {paymentError}
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary mt-4 w-full sm:w-auto"
                      disabled={paymentSubmitting || Boolean(paymentSubmittedAt)}
                      onClick={handlePaymentConfirmation}
                    >
                      {paymentSubmitting
                        ? "SUBMITTING…"
                        : paymentSubmittedAt
                        ? "PAYMENT SUBMITTED"
                        : "I HAVE PAID"}
                    </button>
                  </div>
                )}

                {paymentStatus === "paid" && (
                  <div className="mt-5 rounded-lg border border-green-700 bg-green-50 p-5">
                    <p className="text-sm font-semibold text-green-900">
                      Payment verified
                    </p>
                    <p className="mt-1 text-sm text-green-900/80">
                      Your payment has been verified by MYRONIX. Final work is now unlocked.
                    </p>
                  </div>
                )}

                {deliverableError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
                  >
                    {deliverableError}
                  </div>
                )}

                {deliverableLoadStatus === "loading" && (
                  <p className="mt-5 text-sm text-ink/70">
                    Loading your files…
                  </p>
                )}

                {deliverableLoadStatus === "empty" && (
                  <p className="mt-5 text-sm text-ink/70">
                    No deliverable has been uploaded for this order yet.
                  </p>
                )}

                {deliverables.length > 0 && (
                  <div className="mt-5 grid gap-3">
                    {deliverables.map((file) => {
                      const locked =
                        file.payment_required && paymentStatus !== "paid";

                      return (
                        <div
                          key={file.id}
                          className="rounded-md border border-line p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="break-all text-sm font-semibold">
                                {file.file_name}
                              </p>

                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/60">
                                <span>
                                  {file.is_preview ? "Preview" : "Final work"}
                                </span>
                                <span>
                                  {file.payment_required
                                    ? paymentStatus === "paid"
                                      ? "Payment confirmed"
                                      : "Payment required"
                                    : "Available"}
                                </span>
                                <span>{formatDeliverableSize(file.file_size)}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn btn-ghost-light shrink-0"
                              disabled={locked || openingDeliverableId === file.id}
                              onClick={() => openDeliverable(file)}
                            >
                              {openingDeliverableId === file.id
                                ? "Opening…"
                                : locked
                                ? "Locked until payment"
                                : "View / Download"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          {authState === "signedin" && savedOrder && orderLoadStatus === "loaded" && (
            <div className="mt-6 rounded-lg border border-line bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                    Project timeline
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    Activity & Updates
                  </h3>
                  <p className="mt-1 text-sm text-ink/70">
                    Follow important updates to your MYRONIX project.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost-light"
                  disabled={activitiesLoading}
                  onClick={() => refreshActivities(savedOrder.id)}
                >
                  {activitiesLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {activitiesError && (
                <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                  {activitiesError}
                </div>
              )}

              <div className="mt-5 grid gap-4">
                {activities.length === 0 && !activitiesLoading ? (
                  <p className="text-sm text-ink/60">No timeline activity yet.</p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="relative border-l-2 border-line pl-4">
                      <p className="text-sm font-semibold">{activity.message}</p>
                      <p className="mt-1 text-xs text-ink/50">
                        {activity.actor_role === "admin" ? "MYRONIX" : "You"} · {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {authState === "signedin" && savedOrder && orderLoadStatus === "loaded" && (
            <div className="mt-6 rounded-lg border border-line bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
                    Project messages
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    Chat with MYRONIX
                  </h3>
                  <p className="mt-1 text-sm text-ink/70">
                    Send questions or updates about this project.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost-light"
                  disabled={messagesLoading}
                  onClick={() => refreshMessages(savedOrder.id)}
                >
                  {messagesLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {messageError && (
                <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                  {messageError}
                </div>
              )}

              <div className="mt-5 max-h-80 overflow-y-auto rounded-md border border-line bg-mist p-4">
                {messages.length === 0 && !messagesLoading ? (
                  <p className="text-sm text-ink/60">No messages yet.</p>
                ) : (
                  <div className="grid gap-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-md p-3 ${message.sender_role === "customer" ? "ml-6 bg-white" : "mr-6 bg-black text-white"}`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-60">
                          {message.sender_role === "customer" ? "You" : "MYRONIX"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.message}</p>
                        <p className="mt-2 text-[11px] opacity-50">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                <textarea
                  rows={3}
                  maxLength={2000}
                  className="field"
                  placeholder="Write a message to MYRONIX…"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={messageSending}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-ink/50">{messageText.length}/2000</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={messageSending || !messageText.trim()}
                    onClick={handleSendMessage}
                  >
                    {messageSending ? "Sending…" : "SEND MESSAGE"}
                  </button>
                </div>
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
}