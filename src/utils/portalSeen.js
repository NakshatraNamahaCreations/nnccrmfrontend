// When this admin last opened each Employee Portal tab (kept in this browser), so the
// sidebar and the tabs can show how many new things came in since then.
import { billingApi } from "../pages/ProjectBilling/billingMeta";

const KEY = "nnc_portal_seen";
const SEEN_TABS = ["work", "meetings", "docs", "tasks"];

export function getSeen() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
export function markSeen(tab) {
  if (!SEEN_TABS.includes(tab)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...getSeen(), [tab]: new Date().toISOString() })); } catch { /* private mode */ }
  window.dispatchEvent(new Event("nnc-portal-seen"));
}
export async function fetchPortalCounts() {
  const s = getSeen();
  const q = new URLSearchParams(SEEN_TABS.filter(k => s[k]).map(k => [k, s[k]])).toString();
  const j = await billingApi(`/portal/admin/counts${q ? `?${q}` : ""}`);
  return { data: j.data || {}, total: j.total || 0 };
}
