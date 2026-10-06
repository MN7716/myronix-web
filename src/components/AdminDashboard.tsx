import { useEffect, useState } from "react";

type Enquiry = {
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
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function AdminDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (!token) return;

    async function loadEnquiries() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/project_enquiries?select=*&order=created_at.desc`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY || "",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Could not load enquiries (${res.status}).`);
        }

        setEnquiries(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load enquiries.");
      } finally {
        setLoading(false);
      }
    }

    loadEnquiries();
  }, [token]);

  async function updateStatus(id: string, status: Enquiry["status"]) {
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
      setError("Could not update enquiry.");
      return;
    }

    setEnquiries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );
  }

  if (!token) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b0d10",
          color: "#fff",
          fontFamily: "Arial, sans-serif",
          padding: 24,
        }}
      >
        <section style={{ width: "100%", maxWidth: 420 }}>
          <h1>MYRONIX ADMIN</h1>
          <p>Secure admin access</p>

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

          <button onClick={login} disabled={loading} style={buttonStyle}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {error && <p style={{ color: "#ff7777" }}>{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0d10",
        color: "#fff",
        fontFamily: "Arial, sans-serif",
        padding: 24,
      }}
    >
      <h1>MYRONIX ADMIN</h1>
      <p>Project enquiries</p>

      {loading && <p>Loading enquiries...</p>}
      {error && <p style={{ color: "#ff7777" }}>{error}</p>}

      {!loading && enquiries.length === 0 && (
        <p>No enquiries yet.</p>
      )}

      <div style={{ display: "grid", gap: 18 }}>
        {enquiries.map((item) => (
          <article
            key={item.id}
            style={{
              border: "1px solid #292d33",
              borderRadius: 14,
              padding: 20,
              background: "#121519",
            }}
          >
            <h2>{item.service}</h2>

            <p>
              <strong>Client:</strong> {item.full_name || "Not provided"}
            </p>

            <p>
              <strong>Email:</strong> {item.contact_email}
            </p>

            <p>
              <strong>Project:</strong> {item.project_type}
            </p>

            <p>
              <strong>Budget:</strong> {item.budget_range}
            </p>

            <p>
              <strong>Deadline:</strong> {item.deadline || "Flexible"}
            </p>

            <p>
              <strong>Requirements:</strong>
              <br />
              {item.requirements}
            </p>

            <select
              value={item.status}
              onChange={(e) =>
                updateStatus(
                  item.id,
                  e.target.value as Enquiry["status"]
                )
              }
              style={inputStyle}
            >
              <option value="new">New</option>
              <option value="in progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>
          </article>
        ))}
      </div>
    </main>
  );
}

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