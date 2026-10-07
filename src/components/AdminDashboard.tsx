import { useEffect, useState } from "react";

type Enquiry = {
  id: string;
  created_at: string;
  user_id: string;
  full_name: string | null;
  contact_email: string;
  service: string;
  project_type: string;
  requirements: string;
  budget_range: string;
  deadline: string | null;
  status: "new" | "in progress" | "review" | "completed";
  payment_status: string | null;
  payment_method: string | null;
  paid_at: string | null;
};

type ProjectFile = {
  id: string;
  order_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

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

type ProjectDeliverable = {
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REFERENCE_BUCKET = "project-references";
const DELIVERABLE_BUCKET = "project-deliverables";

export default function AdminDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [messageText, setMessageText] = useState<Record<string, string>>({});
  const [messageSendingOrderId, setMessageSendingOrderId] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [deliverablesLoading, setDeliverablesLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");

  const [uploadingOrderId, setUploadingOrderId] = useState("");
  const [uploadType, setUploadType] = useState<"preview" | "final">("final");

  async function login() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error_description || "Login failed.");
      }

      setToken(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEnquiries(accessToken: string) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/project_enquiries?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Could not load enquiries (${res.status}).`);
    }

    const data = await res.json();
    setEnquiries(Array.isArray(data) ? data : []);
  }

  async function loadProjectFiles(accessToken: string) {
    setFilesLoading(true);
    setFileError("");

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/project_files?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(
          `Could not load reference files (${res.status}).`
        );
      }

      const data = await res.json();
      setProjectFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setFileError(
        err instanceof Error
          ? err.message
          : "Could not load reference files."
      );
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadProjectActivities(accessToken: string) {
    setActivitiesLoading(true);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/project_activities?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Could not load project timeline (${res.status}).`);
      }

      const data = await res.json();
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load project timeline."
      );
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function addProjectActivity(
    orderId: string,
    userId: string,
    activityType: string,
    message: string
  ) {
    if (!token) return;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/project_activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        order_id: orderId,
        user_id: userId,
        actor_role: "admin",
        activity_type: activityType,
        message,
      }),
    });

    if (!res.ok) {
      throw new Error("Activity could not be recorded.");
    }

    const data = await res.json().catch(() => []);
    const created = Array.isArray(data) ? data[0] : data;
    if (created) setActivities((current) => [created, ...current]);
  }

  async function loadProjectMessages(accessToken: string) {
    setMessagesLoading(true);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/project_messages?select=*&order=created_at.asc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Could not load project messages (${res.status}).`);
      }

      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load project messages."
      );
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendAdminMessage(enquiry: Enquiry) {
    const message = (messageText[enquiry.id] || "").trim();
    if (!message) return;

    setMessageSendingOrderId(enquiry.id);
    setError("");

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/project_messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${token}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          order_id: enquiry.id,
          user_id: enquiry.user_id,
          sender_role: "admin",
          message,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.message || data?.details || `Could not send message (${res.status}).`
        );
      }

      const data = await res.json();
      const created = Array.isArray(data) ? data[0] : data;

      if (created) {
        setMessages((current) => [...current, created]);
      } else {
        await loadProjectMessages(token);
      }

      setMessageText((current) => ({ ...current, [enquiry.id]: "" }));

      try {
        await addProjectActivity(
          enquiry.id,
          enquiry.user_id,
          "message_sent",
          "MYRONIX sent a project message."
        );
      } catch {
        // Keep message sending successful even if timeline logging fails.
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send message."
      );
    } finally {
      setMessageSendingOrderId("");
    }
  }

  async function loadDeliverables(accessToken: string) {
    setDeliverablesLoading(true);
    setFileError("");

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/project_deliverables?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(
          `Could not load final work files (${res.status}).`
        );
      }

      const data = await res.json();
      setDeliverables(Array.isArray(data) ? data : []);
    } catch (err) {
      setFileError(
        err instanceof Error
          ? err.message
          : "Could not load final work files."
      );
    } finally {
      setDeliverablesLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        await Promise.all([
          loadEnquiries(token),
          loadProjectFiles(token),
          loadDeliverables(token),
          loadProjectMessages(token),
          loadProjectActivities(token),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [token]);

  async function updateStatus(
    id: string,
    status: Enquiry["status"]
  ) {
    setError("");

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/project_enquiries?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${token}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!res.ok) {
        throw new Error("Could not update enquiry status.");
      }

      setEnquiries((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status } : item
        )
      );

      const enquiry = enquiries.find((item) => item.id === id);
      if (enquiry) {
        try {
          await addProjectActivity(
            id,
            enquiry.user_id,
            "status_changed",
            `Project status changed to ${status === "in progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}.`
          );
        } catch {
          // Keep the status update successful even if timeline logging fails.
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update enquiry."
      );
    }
  }

  async function updatePayment(
    enquiry: Enquiry,
    paymentStatus: string,
    paymentMethod: string
  ) {
    setError("");

    const paidAt =
      paymentStatus === "paid"
        ? enquiry.paid_at || new Date().toISOString()
        : null;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/project_enquiries?id=eq.${enquiry.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${token}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            payment_status: paymentStatus,
            payment_method: paymentMethod || null,
            paid_at: paidAt,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Could not update payment information.");
      }

      setEnquiries((current) =>
        current.map((item) =>
          item.id === enquiry.id
            ? {
                ...item,
                payment_status: paymentStatus,
                payment_method: paymentMethod || null,
                paid_at: paidAt,
              }
            : item
        )
      );

      try {
        await addProjectActivity(
          enquiry.id,
          enquiry.user_id,
          "payment_updated",
          paymentStatus === "paid"
            ? `Payment marked as paid${paymentMethod ? ` via ${paymentMethod}` : ""}.`
            : "Payment status set to pending."
        );
      } catch {
        // Keep the payment update successful even if timeline logging fails.
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update payment information."
      );
    }
  }

  async function getSignedFileUrl(
    bucket: string,
    filePath: string
  ) {
    const encodedPath = filePath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodedPath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expiresIn: 3600,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok || !data?.signedURL) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Could not create file link (${res.status}).`
      );
    }

    return data.signedURL.startsWith("http")
      ? data.signedURL
      : `${SUPABASE_URL}/storage/v1${data.signedURL}`;
  }

  async function openFile(
    bucket: string,
    filePath: string
  ) {
    setFileError("");

    try {
      const signedUrl = await getSignedFileUrl(bucket, filePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setFileError(
        err instanceof Error
          ? err.message
          : "Could not open file."
      );
    }
  }

  async function uploadDeliverable(
    enquiry: Enquiry,
    file: File,
    type: "preview" | "final"
  ) {
    setFileError("");
    setUploadingOrderId(enquiry.id);

    try {
      const safeFileName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const folder = type === "preview" ? "preview" : "final";
      const filePath =
        `${enquiry.user_id}/${enquiry.id}/${folder}/` +
        `${Date.now()}-${safeFileName}`;

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${DELIVERABLE_BUCKET}/${filePath}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${token}`,
            "Content-Type":
              file.type || "application/octet-stream",
            "x-upsert": "false",
          },
          body: file,
        }
      );

      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => null);

        throw new Error(
          uploadData?.message ||
            uploadData?.error ||
            `Could not upload file (${uploadRes.status}).`
        );
      }

      const insertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/project_deliverables`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY || "",
            Authorization: `Bearer ${token}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            order_id: enquiry.id,
            user_id: enquiry.user_id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || null,
            file_size: file.size,
            is_preview: type === "preview",
            payment_required: type === "final",
          }),
        }
      );

      if (!insertRes.ok) {
        const insertData = await insertRes.json().catch(() => null);

        throw new Error(
          insertData?.message ||
            insertData?.details ||
            `File uploaded, but database record failed (${insertRes.status}).`
        );
      }

      await loadDeliverables(token);

      try {
        await addProjectActivity(
          enquiry.id,
          enquiry.user_id,
          type === "preview" ? "preview_uploaded" : "final_uploaded",
          type === "preview"
            ? `Preview uploaded: ${file.name}`
            : `Final work uploaded: ${file.name}`
        );
      } catch {
        // Keep file upload successful even if timeline logging fails.
      }
    } catch (err) {
      setFileError(
        err instanceof Error
          ? err.message
          : "Could not upload final work."
      );
    } finally {
      setUploadingOrderId("");
    }
  }

  function handleDeliverableFileChange(
    enquiry: Enquiry,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    void uploadDeliverable(enquiry, file, uploadType);

    event.target.value = "";
  }

  function formatFileSize(size: number | null) {
    if (!size || size <= 0) return "Unknown size";

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function filesForOrder(orderId: string) {
    return projectFiles.filter(
      (file) => file.order_id === orderId
    );
  }

  function activitiesForOrder(orderId: string) {
    return activities.filter((activity) => activity.order_id === orderId);
  }

  function messagesForOrder(orderId: string) {
    return messages.filter((message) => message.order_id === orderId);
  }

  function deliverablesForOrder(orderId: string) {
    return deliverables.filter(
      (file) => file.order_id === orderId
    );
  }

  function paymentLabel(value: string | null) {
    if (!value) return "Pending";
    return value === "paid" ? "Paid" : value;
  }

  const filteredEnquiries = enquiries.filter((item) => {
    const search = orderSearch.trim().toLowerCase();
    const matchesSearch =
      !search ||
      item.id.toLowerCase().includes(search) ||
      (item.full_name || "").toLowerCase().includes(search) ||
      item.contact_email.toLowerCase().includes(search) ||
      item.service.toLowerCase().includes(search) ||
      item.project_type.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "paid"
        ? item.payment_status === "paid"
        : item.payment_status !== "paid");

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const orderSummary = {
    total: enquiries.length,
    new: enquiries.filter((item) => item.status === "new").length,
    inProgress: enquiries.filter((item) => item.status === "in progress").length,
    review: enquiries.filter((item) => item.status === "review").length,
    completed: enquiries.filter((item) => item.status === "completed").length,
    paid: enquiries.filter((item) => item.payment_status === "paid").length,
  };

  async function refreshAll() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        loadEnquiries(token),
        loadProjectFiles(token),
        loadDeliverables(token),
        loadProjectMessages(token),
        loadProjectActivities(token),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh dashboard.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main style={loginPageStyle}>
        <section style={{ width: "100%", maxWidth: 420 }}>
          <h1>MYRONIX ADMIN</h1>
          <p style={{ color: "#9da4ad" }}>
            Secure admin access
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <button
            onClick={login}
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {error && (
            <p style={{ color: "#ff7777" }}>{error}</p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ marginBottom: 6 }}>
              MYRONIX ADMIN
            </h1>
            <p style={{ margin: 0, color: "#9da4ad" }}>
              Project management dashboard
            </p>
          </div>

          <div style={connectedStyle}>
            Admin connected
          </div>
        </header>

        {loading && (
          <p style={{ color: "#b8bec7" }}>
            Loading dashboard...
          </p>
        )}

        {error && (
          <p style={{ color: "#ff7777" }}>{error}</p>
        )}

        <section style={{ marginBottom: 36 }}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ marginBottom: 6 }}>
                Project Enquiries
              </h2>
              <p style={sectionSubtextStyle}>
                Search, filter and manage customer projects from one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loading}
              style={secondaryButtonStyle}
            >
              {loading ? "Refreshing..." : "Refresh All"}
            </button>
          </div>

          <div style={summaryGridStyle}>
            <div style={summaryCardStyle}>
              <span>Total Orders</span>
              <strong>{orderSummary.total}</strong>
            </div>
            <div style={summaryCardStyle}>
              <span>New</span>
              <strong>{orderSummary.new}</strong>
            </div>
            <div style={summaryCardStyle}>
              <span>In Progress</span>
              <strong>{orderSummary.inProgress}</strong>
            </div>
            <div style={summaryCardStyle}>
              <span>Review</span>
              <strong>{orderSummary.review}</strong>
            </div>
            <div style={summaryCardStyle}>
              <span>Completed</span>
              <strong>{orderSummary.completed}</strong>
            </div>
            <div style={summaryCardStyle}>
              <span>Paid</span>
              <strong>{orderSummary.paid}</strong>
            </div>
          </div>

          <div style={filterBarStyle}>
            <input
              type="search"
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
              placeholder="Search name, email, service or order ID..."
              style={filterInputStyle}
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={filterSelectStyle}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="in progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
              style={filterSelectStyle}
            >
              <option value="all">All Payments</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>

            {(orderSearch || statusFilter !== "all" || paymentFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setOrderSearch("");
                  setStatusFilter("all");
                  setPaymentFilter("all");
                }}
                style={secondaryButtonStyle}
              >
                Clear Filters
              </button>
            )}
          </div>

          {!loading && enquiries.length === 0 && (
            <div style={emptyStyle}>
              No enquiries yet.
            </div>
          )}

          {!loading && enquiries.length > 0 && filteredEnquiries.length === 0 && (
            <div style={emptyStyle}>
              No orders match the current search or filters.
            </div>
          )}

          <div style={{ display: "grid", gap: 18 }}>
            {filteredEnquiries.map((item) => {
              const files = filesForOrder(item.id);
              const orderDeliverables =
                deliverablesForOrder(item.id);
              const isUploading =
                uploadingOrderId === item.id;

              return (
                <article
                  key={item.id}
                  style={cardStyle}
                >
                  <div style={topRowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <p style={labelStyle}>
                        Order ID
                      </p>

                      <code style={orderIdStyle}>
                        {item.id}
                      </code>
                    </div>

                    <select
                      value={item.status}
                      onChange={(e) =>
                        updateStatus(
                          item.id,
                          e.target.value as Enquiry["status"]
                        )
                      }
                      style={selectStyle}
                    >
                      <option value="new">New</option>
                      <option value="in progress">
                        In Progress
                      </option>
                      <option value="review">Review</option>
                      <option value="completed">
                        Completed
                      </option>
                    </select>
                  </div>

                  <hr style={dividerStyle} />

                  <h3 style={{ marginTop: 0 }}>
                    {item.service}
                  </h3>

                  <p>
                    <strong>Client:</strong>{" "}
                    {item.full_name || "Not provided"}
                  </p>

                  <p>
                    <strong>Email:</strong>{" "}
                    {item.contact_email}
                  </p>

                  <p>
                    <strong>Project:</strong>{" "}
                    {item.project_type}
                  </p>

                  <p>
                    <strong>Budget:</strong>{" "}
                    {item.budget_range}
                  </p>

                  <p>
                    <strong>Deadline:</strong>{" "}
                    {item.deadline || "Flexible"}
                  </p>

                  <p>
                    <strong>Requirements:</strong>
                    <br />
                    <span
                      style={{
                        color: "#c5cad1",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {item.requirements}
                    </span>
                  </p>

                  <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                      <h4 style={{ margin: 0 }}>
                        Payment
                      </h4>

                      <span
                        style={{
                          ...paymentBadgeStyle,
                          ...(item.payment_status === "paid"
                            ? paidBadgeStyle
                            : pendingBadgeStyle),
                        }}
                      >
                        {paymentLabel(
                          item.payment_status
                        )}
                      </span>
                    </div>

                    <div style={responsiveGridStyle}>
                      <div>
                        <label style={fieldLabelStyle}>
                          Payment Status
                        </label>

                        <select
                          value={
                            item.payment_status || "pending"
                          }
                          onChange={(e) =>
                            updatePayment(
                              item,
                              e.target.value,
                              item.payment_method || ""
                            )
                          }
                          style={inputStyle}
                        >
                          <option value="pending">
                            Pending
                          </option>
                          <option value="paid">
                            Paid
                          </option>
                        </select>
                      </div>

                      <div>
                        <label style={fieldLabelStyle}>
                          Payment Method
                        </label>

                        <select
                          value={
                            item.payment_method || ""
                          }
                          onChange={(e) =>
                            updatePayment(
                              item,
                              item.payment_status || "pending",
                              e.target.value
                            )
                          }
                          style={inputStyle}
                        >
                          <option value="">
                            Not set
                          </option>
                          <option value="UPI">
                            UPI
                          </option>
                          <option value="Bank Transfer">
                            Bank Transfer
                          </option>
                          <option value="Other">
                            Other
                          </option>
                        </select>
                      </div>
                    </div>

                    <p
                      style={{
                        marginBottom: 0,
                        color: "#8f98a3",
                        fontSize: 13,
                      }}
                    >
                      Paid at:{" "}
                      {item.paid_at
                        ? new Date(
                            item.paid_at
                          ).toLocaleString()
                        : "Not paid"}
                    </p>
                  </div>

                  <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                      <div>
                        <h4 style={{ margin: 0 }}>Project Messages</h4>
                        <p style={{ margin: "5px 0 0", color: "#8f98a3", fontSize: 12 }}>
                          Chat directly with this client about the project.
                        </p>
                      </div>
                      <button
                        onClick={() => void loadProjectMessages(token)}
                        style={smallButtonStyle}
                        disabled={messagesLoading}
                      >
                        {messagesLoading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    <div style={messageListStyle}>
                      {messagesForOrder(item.id).length === 0 ? (
                        <p style={{ color: "#777f89", margin: 0 }}>No messages yet.</p>
                      ) : (
                        messagesForOrder(item.id).map((message) => (
                          <div key={message.id} style={messageBubbleStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                              <strong>{message.sender_role === "admin" ? "MYRONIX" : "Client"}</strong>
                              <span style={mutedSmallStyle}>{new Date(message.created_at).toLocaleString()}</span>
                            </div>
                            <div style={{ whiteSpace: "pre-wrap", color: "#dfe4ea" }}>{message.message}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <textarea
                      value={messageText[item.id] || ""}
                      onChange={(e) =>
                        setMessageText((current) => ({
                          ...current,
                          [item.id]: e.target.value.slice(0, 2000),
                        }))
                      }
                      placeholder="Write a message to the client..."
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical", marginTop: 12 }}
                    />

                    <button
                      onClick={() => void sendAdminMessage(item)}
                      disabled={messageSendingOrderId === item.id || !(messageText[item.id] || "").trim()}
                      style={{ ...smallButtonStyle, marginTop: 4, opacity: messageSendingOrderId === item.id ? 0.6 : 1 }}
                    >
                      {messageSendingOrderId === item.id ? "Sending..." : "Send Message"}
                    </button>
                  </div>

                  <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                      <div>
                        <h4 style={{ margin: 0 }}>Project Timeline</h4>
                        <p style={{ margin: "5px 0 0", color: "#8f98a3", fontSize: 12 }}>
                          Recent project activity, payment, files and messages.
                        </p>
                      </div>
                      <button
                        onClick={() => void loadProjectActivities(token)}
                        style={smallButtonStyle}
                        disabled={activitiesLoading}
                      >
                        {activitiesLoading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    {activitiesForOrder(item.id).length === 0 ? (
                      <p style={{ color: "#777f89", marginBottom: 0 }}>No timeline activity yet.</p>
                    ) : (
                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        {activitiesForOrder(item.id).map((activity) => (
                          <div key={activity.id} style={{ borderLeft: "2px solid #3a414a", paddingLeft: 12 }}>
                            <strong style={{ display: "block" }}>{activity.message}</strong>
                            <span style={mutedSmallStyle}>
                              {activity.actor_role === "admin" ? "MYRONIX" : "Customer"} · {new Date(activity.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                      <h4 style={{ margin: 0 }}>
                        Reference Files
                      </h4>

                      <span style={mutedTextStyle}>
                        {files.length} file
                        {files.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {files.length === 0 ? (
                      <p
                        style={{
                          color: "#777f89",
                          marginBottom: 0,
                        }}
                      >
                        No reference files uploaded.
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          marginTop: 12,
                        }}
                      >
                        {files.map((file) => (
                          <div
                            key={file.id}
                            style={fileRowStyle}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              <strong
                                style={{
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {file.file_name}
                              </strong>

                              <span style={mutedSmallStyle}>
                                {file.file_type ||
                                  "Unknown type"}{" "}
                                ·{" "}
                                {formatFileSize(
                                  file.file_size
                                )}
                              </span>
                            </div>

                            <button
                              onClick={() =>
                                openFile(
                                  REFERENCE_BUCKET,
                                  file.file_path
                                )
                              }
                              style={smallButtonStyle}
                            >
                              View / Download
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                      <div>
                        <h4 style={{ margin: 0 }}>
                          Final Work
                        </h4>
                        <p
                          style={{
                            margin: "5px 0 0",
                            color: "#8f98a3",
                            fontSize: 12,
                          }}
                        >
                          Preview can be shared before
                          payment. Final files require
                          payment.
                        </p>
                      </div>

                      <span style={mutedTextStyle}>
                        {orderDeliverables.length} file
                        {orderDeliverables.length === 1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    <div style={uploadControlsStyle}>
                      <select
                        value={uploadType}
                        onChange={(e) =>
                          setUploadType(
                            e.target.value as
                              | "preview"
                              | "final"
                          )
                        }
                        style={selectStyle}
                      >
                        <option value="preview">
                          Upload Preview
                        </option>
                        <option value="final">
                          Upload Final
                        </option>
                      </select>

                      <label
                        style={{
                          ...smallButtonStyle,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: isUploading
                            ? "not-allowed"
                            : "pointer",
                          opacity: isUploading ? 0.6 : 1,
                        }}
                      >
                        {isUploading
                          ? "Uploading..."
                          : "Choose File"}

                        <input
                          type="file"
                          disabled={isUploading}
                          onChange={(e) =>
                            handleDeliverableFileChange(
                              item,
                              e
                            )
                          }
                          style={{
                            display: "none",
                          }}
                        />
                      </label>
                    </div>

                    {orderDeliverables.length === 0 ? (
                      <p
                        style={{
                          color: "#777f89",
                          marginBottom: 0,
                        }}
                      >
                        No final work uploaded yet.
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          marginTop: 12,
                        }}
                      >
                        {orderDeliverables.map(
                          (file) => (
                            <div
                              key={file.id}
                              style={fileRowStyle}
                            >
                              <div
                                style={{
                                  minWidth: 0,
                                  flex: 1,
                                }}
                              >
                                <strong
                                  style={{
                                    display: "block",
                                    overflow: "hidden",
                                    textOverflow:
                                      "ellipsis",
                                    whiteSpace:
                                      "nowrap",
                                  }}
                                >
                                  {file.file_name}
                                </strong>

                                <span
                                  style={
                                    mutedSmallStyle
                                  }
                                >
                                  {file.is_preview
                                    ? "Preview"
                                    : "Final"}{" "}
                                  ·{" "}
                                  {file.payment_required
                                    ? "Payment required"
                                    : "No payment required"}{" "}
                                  ·{" "}
                                  {formatFileSize(
                                    file.file_size
                                  )}
                                </span>
                              </div>

                              <button
                                onClick={() =>
                                  openFile(
                                    DELIVERABLE_BUCKET,
                                    file.file_path
                                  )
                                }
                                style={
                                  smallButtonStyle
                                }
                              >
                                View / Download
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {(filesLoading || deliverablesLoading) && (
          <p style={{ color: "#b8bec7" }}>
            Loading project files...
          </p>
        )}

        {fileError && (
          <p style={{ color: "#ff7777" }}>
            File error: {fileError}
          </p>
        )}
      </div>
    </main>
  );
}

const sectionSubtextStyle = {
  margin: 0,
  color: "#9da4ad",
  lineHeight: 1.5,
};

const secondaryButtonStyle = {
  border: "1px solid #2c323a",
  background: "#15191f",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryCardStyle = {
  border: "1px solid #242a32",
  background: "#11151a",
  borderRadius: 12,
  padding: 16,
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const filterBarStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap" as const,
  alignItems: "center",
  marginBottom: 18,
};

const filterInputStyle = {
  flex: "1 1 280px",
  minWidth: 220,
  border: "1px solid #2c323a",
  background: "#11151a",
  color: "#fff",
  borderRadius: 10,
  padding: "11px 12px",
  outline: "none",
};

const filterSelectStyle = {
  flex: "0 1 170px",
  minWidth: 150,
  border: "1px solid #2c323a",
  background: "#11151a",
  color: "#fff",
  borderRadius: 10,
  padding: "11px 12px",
  outline: "none",
};

const loginPageStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#0b0d10",
  color: "#fff",
  fontFamily: "Arial, sans-serif",
  padding: 24,
};

const pageStyle = {
  minHeight: "100vh",
  background: "#0b0d10",
  color: "#fff",
  fontFamily: "Arial, sans-serif",
  padding: 24,
};

const containerStyle = {
  maxWidth: 1100,
  margin: "0 auto",
};

const headerStyle = {
  marginBottom: 28,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap" as const,
};

const connectedStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#18231b",
  color: "#8de1a0",
  fontSize: 13,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  marginTop: 10,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #343941",
  background: "#181c21",
  color: "#fff",
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  marginTop: 10,
  border: 0,
  borderRadius: 8,
  background: "#fff",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
};

const smallButtonStyle = {
  padding: "10px 12px",
  border: "1px solid #3a414a",
  borderRadius: 8,
  background: "#1b2026",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const selectStyle = {
  ...inputStyle,
  width: 190,
  margin: 0,
};

const cardStyle = {
  border: "1px solid #292d33",
  borderRadius: 14,
  padding: 20,
  background: "#121519",
};

const emptyStyle = {
  border: "1px solid #292d33",
  borderRadius: 12,
  padding: 20,
  color: "#8f98a3",
};

const dividerStyle = {
  border: 0,
  borderTop: "1px solid #292d33",
  margin: "18px 0",
};

const topRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap" as const,
};

const labelStyle = {
  margin: "0 0 6px",
  color: "#8f98a3",
  fontSize: 13,
};

const orderIdStyle = {
  color: "#dfe4ea",
  fontSize: 12,
  wordBreak: "break-all" as const,
};

const sectionStyle = {
  marginTop: 20,
  padding: 16,
  borderRadius: 12,
  background: "#0e1115",
  border: "1px solid #252a30",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const mutedTextStyle = {
  color: "#8f98a3",
  fontSize: 13,
};

const mutedSmallStyle = {
  color: "#8f98a3",
  fontSize: 12,
};

const fileRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  borderRadius: 10,
  background: "#15191e",
  border: "1px solid #292d33",
  flexWrap: "wrap" as const,
};

const responsiveGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const fieldLabelStyle = {
  display: "block",
  color: "#aeb5be",
  fontSize: 12,
  marginBottom: 4,
};

const paymentBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const paidBadgeStyle = {
  background: "#18321f",
  color: "#8de1a0",
};

const pendingBadgeStyle = {
  background: "#302816",
  color: "#e9c878",
};

const uploadControlsStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap" as const,
  marginTop: 14,
};

const messageListStyle = {
  display: "grid",
  gap: 8,
  maxHeight: 280,
  overflowY: "auto" as const,
  marginTop: 12,
  padding: 4,
};

const messageBubbleStyle = {
  padding: 12,
  borderRadius: 10,
  background: "#15191e",
  border: "1px solid #292d33",
};
