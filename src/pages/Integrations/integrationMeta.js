// Shared constants + API helper for project third-party integrations.
// Category / status values must match backend src/models/Integration.js.

export const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("nnc_token");
  const res = await fetch(`${API}/api/integrations${path}`, {
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

// Mirrors the backend requireModule("integrations", "edit") check, to hide buttons.
// The backend still enforces it.
export function canEditIntegrations() {
  try {
    const u = JSON.parse(localStorage.getItem("nnc_user") || "null");
    if (!u || u.modules == null) return u?.role !== "viewer";
    return u.modules.includes("integrations") || u.modules.includes("integrations:edit");
  } catch {
    return false;
  }
}

// Each category: emoji, suggested services, and the secret fields usually needed
export const CATEGORY_META = {
  "Payment":          { icon: "💳", services: ["Razorpay", "PhonePe", "Paytm", "Stripe", "CCAvenue", "Cashfree"], secrets: ["Key ID", "Key Secret", "Webhook Secret"] },
  "SMS / OTP":        { icon: "📱", services: ["MSG91", "Twilio", "Fast2SMS", "2Factor", "Textlocal"],          secrets: ["Auth Key", "Sender ID", "Template ID"] },
  "WhatsApp":         { icon: "💬", services: ["Meta Cloud API", "Interakt", "Wati", "AiSensy", "Gupshup"],      secrets: ["Access Token", "Phone Number ID", "Business Account ID"] },
  "Email":            { icon: "✉️", services: ["Hostinger Mail", "Gmail SMTP", "SendGrid", "Brevo", "Zoho Mail"], secrets: ["Password / App Password", "SMTP Host", "API Key"] },
  "Maps":             { icon: "🗺️", services: ["Google Maps API", "Mapbox"],                                     secrets: ["API Key"] },
  "Login / Auth":     { icon: "🔐", services: ["Firebase", "Google Login", "Facebook Login", "Apple Sign-In"],   secrets: ["API Key", "Client ID", "Client Secret"] },
  "Hosting / Server": { icon: "🖥️", services: ["Hostinger", "GoDaddy", "AWS", "Render", "Vercel", "DigitalOcean"], secrets: ["Password", "cPanel / SSH Password"] },
  "Domain":           { icon: "🌐", services: ["GoDaddy", "Hostinger", "Namecheap", "BigRock"],                  secrets: ["Password"] },
  "Database":         { icon: "🗄️", services: ["MongoDB Atlas", "MySQL", "PostgreSQL", "Firebase Firestore"],    secrets: ["Connection String", "Password"] },
  "Analytics / Ads":  { icon: "📊", services: ["Google Analytics", "Search Console", "Meta Pixel", "Google Ads", "Google Tag Manager"], secrets: ["Measurement / Pixel ID"] },
  "Shipping":         { icon: "📦", services: ["Shiprocket", "Delhivery", "Blue Dart"],                          secrets: ["API Email", "API Password / Token"] },
  "App Store":        { icon: "📲", services: ["Google Play Console", "Apple App Store Connect"],               secrets: ["Password"] },
  "Other":            { icon: "🔌", services: [],                                                                secrets: ["API Key"] },
};
export const CATEGORIES = Object.keys(CATEGORY_META);

export const STATUS_META = {
  pending:     { label: "Pending",     cls: "intg-st-pending" },
  in_progress: { label: "In Progress", cls: "intg-st-progress" },
  live:        { label: "Live",        cls: "intg-st-live" },
  issue:       { label: "Issue",       cls: "intg-st-issue" },
  inactive:    { label: "Inactive",    cls: "intg-st-inactive" },
};

export const BILLING_LABEL = { "": "—", one_time: "One-time", monthly: "/ month", yearly: "/ year" };

export const RENEWAL_WINDOW_DAYS = 30;

// "overdue" | "soon" | "ok" | "" — based on days until renewal
export function renewalState(date) {
  if (!date) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return "overdue";
  if (days <= RENEWAL_WINDOW_DAYS) return "soon";
  return "ok";
}

export function daysLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  if (days === 0) return "today";
  if (days < 0) return `${-days}d overdue`;
  return `in ${days}d`;
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
