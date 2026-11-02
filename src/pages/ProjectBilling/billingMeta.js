// Shared helpers for billing after the original deal:
// additional work (one-time extras) and monthly services (recurring).
// Values must match backend src/models/ProjectExtra.js and RecurringService.js.

export const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function billingApi(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("nnc_token");
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const err = new Error(json.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// Mirrors the backend requireModule("all-leads", "edit") check, to hide buttons
export function canEditBilling() {
  try {
    const u = JSON.parse(localStorage.getItem("nnc_user") || "null");
    if (!u || u.modules == null) return u?.role !== "viewer";
    return u.modules.includes("all-leads") || u.modules.includes("all-leads:edit");
  } catch {
    return false;
  }
}

// All projects for a "pick a project" dropdown
export async function fetchProjects() {
  const json = await billingApi("/leads?limit=200");
  return (json.data || [])
    .map(l => ({ _id: l._id || l.id, name: l.name, business: l.business || l.company || "" }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export const PAYMENT_MODES = ["UPI", "NEFT", "RTGS", "IMPS", "Cash", "Cheque", "Card", "Other"];

export const EXTRA_STATUS = {
  quoted:      { label: "Quoted",      cls: "intg-st-pending" },
  approved:    { label: "Approved",    cls: "intg-st-progress" },
  in_progress: { label: "In Progress", cls: "intg-st-test" },
  done:        { label: "Done",        cls: "intg-st-live" },
  cancelled:   { label: "Cancelled",   cls: "intg-st-inactive" },
};

export const SERVICE_TYPES = [
  "Google Ads", "Meta Ads", "SEO", "Social Media", "AMC / Maintenance",
  "Hosting", "Content / Blogs", "Other",
];

export const SERVICE_ICON = {
  "Google Ads": "📢", "Meta Ads": "📣", "SEO": "🔎", "Social Media": "📱",
  "AMC / Maintenance": "🛠️", "Hosting": "🖥️", "Content / Blogs": "✍️", "Other": "🔁",
};

export const MONTH_STATUS = {
  paid:    { label: "Paid",    cls: "intg-st-live" },
  partial: { label: "Partly paid", cls: "intg-st-test" },
  due:     { label: "Due",     cls: "intg-st-progress" },
  overdue: { label: "Overdue", cls: "intg-st-issue" },
  waived:  { label: "Skipped", cls: "intg-st-inactive" },
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const toDateInput = (d) => (d ? String(d).slice(0, 10) : "");

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// "2026-11" → "Nov 2026"
export const monthLabel = (period) => {
  const [y, m] = String(period).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
