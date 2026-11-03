// SEO and Ads team: dates, periods, Google Ads maths, keyword position stats
import { billingApi } from "../ProjectBilling/billingMeta";

export const seoApi = (path, opts) => billingApi(`/seo${path}`, opts);

export const DAY = 864e5;
export const iso = (d) => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const T = (n) => iso(Date.now() + n * DAY);
export const addD = (s, n) => iso(parse(s).getTime() + n * DAY);
export const ds = (v) => String(v || "").slice(0, 10); // stored dates are UTC midnight
export const fd = (s) => parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const fds = (s) => parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const fdw = (s) => parse(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
export const inr2 = (n) => `₹${(Math.round((n || 0) * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const num = (n) => Math.round(n || 0).toLocaleString("en-IN");
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
export const initials = (n) => String(n || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
export const waPhone = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };

export const TYPES = { backlink: "Backlink", blog: "Blog", gmb: "GMB post", poster: "Poster", other: "Other task" };
export const ROLE = { seo: ["SEO analyst", "#059669"], ads: ["Google Ads expert", "#D97706"], design: ["Designer", "#DB2777"] };
export const BACKLINK_KINDS = ["Profile", "Guest post", "Business listing", "Article", "Social bookmark", "Classified", "PDF submission", "Image share"];

/* periods */
export function weekOf(s) { const d = parse(s); const off = (d.getDay() + 6) % 7; const a = iso(d.getTime() - off * DAY); return [a, addD(a, 6)]; }
export function monthOf(s) { const d = parse(s); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; }
export function period(k) {
  if (k === "today") return [T(0), T(0)];
  if (k === "week") return weekOf(T(0));
  if (k === "lweek") return weekOf(T(-7));
  if (k === "month") return monthOf(T(0));
  if (k === "lmonth") { const d = parse(T(0)); return monthOf(iso(new Date(d.getFullYear(), d.getMonth() - 1, 1))); }
  if (k === "all") return ["2000-01-01", T(0)];
  return [T(-30), T(0)];
}
export const PER = { today: "Today", week: "This week", lweek: "Last week", month: "This month", lmonth: "Last month", d30: "Last 30 days", all: "Since day 1" };
export const inP = (x, [a, b]) => x.date >= a && x.date <= b;
export function workdaysIn([a, b]) { let n = 0; for (let d = parse(a); d <= parse(b); d = new Date(d.getTime() + DAY)) if (d.getDay() !== 0) n++; return n; }

/* Google Ads */
export function adsAgg(L) {
  const s = L.reduce((o, r) => ({ spend: o.spend + r.spend, clicks: o.clicks + r.clicks, impr: o.impr + r.impr, conv: o.conv + r.conv }), { spend: 0, clicks: 0, impr: 0, conv: 0 });
  s.ctr = s.impr ? (s.clicks / s.impr) * 100 : 0;
  s.cpc = s.clicks ? s.spend / s.clicks : 0;
  s.cpl = s.conv ? s.spend / s.conv : 0;
  const tm = {};
  L.forEach(r => (r.terms || []).forEach(t => {
    const x = tm[t.t] || (tm[t.t] = { t: t.t, clicks: 0, impr: 0, cost: 0, conv: 0 });
    x.clicks += t.clicks; x.impr += t.impr; x.cost += t.cost; x.conv += t.conv;
  }));
  s.terms = Object.values(tm).sort((a, b) => b.cost - a.cost);
  s.waste = s.terms.filter(t => !t.conv && t.cost > 0).sort((a, b) => b.cost - a.cost);
  s.negs = [...new Set(L.flatMap(r => r.negs || []))];
  s.days = L.length;
  return s;
}
// Search terms report: search term, clicks, impressions, cost, conversions (tab or comma separated)
export function parseTerms(txt) {
  const out = [];
  String(txt || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
    const c = l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x => x.replace(/^"|"$/g, "").trim());
    if (c.length < 2) return;
    const n = (x) => +String(x || "0").replace(/[^0-9.]/g, "") || 0;
    if (/search term|clicks/i.test(c[0] + c[1])) return;
    out.push({ t: c[0], clicks: n(c[1]), impr: n(c[2]), cost: n(c[3]), conv: n(c[4]) });
  });
  return out;
}

/* keyword positions — null position = not in the top 100 */
export const posTxt = (p) => (p == null ? "100+" : String(p));
export const posVal = (p) => (p == null ? 101 : p);
export function kwStat(e, P) {
  const H = e.hist;
  if (!H.length) return null;
  const first = H[0];
  const at = (d) => { let x = null; for (const h of H) { if (h.date <= d) x = h; else break; } return x || first; };
  const cur = P && P[1] < T(0) ? at(P[1]) : H[H.length - 1];
  const ps = P ? at(P[0]) : first;
  const best = H.reduce((b, h) => (posVal(h.pos) < posVal(b.pos) ? h : b), H[0]);
  return { first, cur, ps, best, gain: posVal(first.pos) - posVal(cur.pos), pgain: posVal(ps.pos) - posVal(cur.pos), wk: at(T(-7)), mo: at(T(-30)) };
}
export const BUCKETS = ["Top 3", "Top 10", "Top 30", "31 to 100", "100+"];
export function bucket(p) { return p == null ? "100+" : p <= 3 ? "Top 3" : p <= 10 ? "Top 10" : p <= 30 ? "Top 30" : "31 to 100"; }
export function dist(kws, getter) {
  const o = Object.fromEntries(BUCKETS.map(b => [b, 0]));
  kws.forEach(e => { const s = kwStat(e); if (s) o[bucket(getter(s).pos)]++; });
  return o;
}

/* message for the client after a Google Ads day */
export function adsText(r, c, monthDays, by) {
  const m = adsAgg(monthDays);
  const s = adsAgg([r]);
  const top = s.terms.filter(t => t.conv).slice(0, 3).map(t => `  • ${t.t} (${t.conv} lead${t.conv > 1 ? "s" : ""})`).join("\n");
  return `${greet()}, here is the Google Ads report for ${c.name} for ${fdw(r.date)}:

Amount spent: ${inr(s.spend)}
Clicks: ${num(s.clicks)} · Impressions: ${num(s.impr)} · CTR ${s.ctr.toFixed(2)}%
Average cost per click: ${inr2(s.cpc)}
Leads (calls and forms): ${s.conv}${s.conv ? ` · Cost per lead ${inr(s.cpl)}` : ""}
${top ? `\nSearches that brought leads:\n${top}\n` : ""}${r.negs?.length ? `\nBlocked irrelevant searches: ${r.negs.join(", ")}\n` : ""}${r.notes ? `\nAction taken today: ${r.notes}\n` : ""}
Month so far: ${inr(m.spend)} spent${c.budget ? ` of ${inr(c.budget)} budget (${pct(m.spend, c.budget)}%)` : ""}, ${m.conv} leads${m.conv ? ` at ${inr(m.cpl)} per lead` : ""}.

Regards,
${by ? `${by}, ` : ""}Google Ads team
Nakshatra Namaha Creations`;
}

export function downloadCsv(rows, name) {
  const csv = rows.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = u; a.download = name; a.click();
  URL.revokeObjectURL(u);
}
export const copy = (t) => { try { navigator.clipboard?.writeText(t)?.catch?.(() => {}); } catch { /* clipboard blocked */ } };
