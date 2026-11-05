// Lead Tracker: turns the real CRM records (enquiries, leads, quotations, calendar events)
// into one list of leads with a stage, a score and the next step.
import { leadClient, ownerName } from "../SalesDesk/deskData";

export const DAY = 864e5;
// The sales team: leads belong to Harish or Nithin. Any other name on an old record shows as Unassigned.
export const TEAM = ["Harish", "Nithin"];
const teamOwner = (raw) => { const o = ownerName(raw); return TEAM.includes(o) ? o : "Unassigned"; };
const wasOwner = (raw) => { const o = ownerName(raw); return TEAM.includes(o) || o === "Unassigned" ? "" : o; };
export const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export const TODAY = () => ymd(Date.now());
export const plusDays = (n) => ymd(Date.now() + n * DAY);
// whole days from today (negative = in the past)
export const dd = (d) => { if (!d) return 0; const a = new Date(ymd(d)), b = new Date(TODAY()); return Math.round((a - b) / DAY); };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fd = (d) => { if (!d) return "-"; const x = new Date(d); return `${x.getDate()} ${MON[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? ` ${String(x.getFullYear()).slice(2)}` : ""}`; };
export const fdw = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "-");
export const hm = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
export const L = (n) => { n = n || 0; return n >= 1e7 ? `₹${(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)}L` : inr(n); };
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const fmin = (m) => (m == null ? "-" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 6) / 10} h` : `${Math.round(m / 1440)} days`);
export const ph10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
export const phF = (p) => ph10(p).replace(/(\d{5})(\d{5})/, "$1 $2") || "-";
export const initials = (n) => String(n || "?").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase() || "?";

// Stages are the enquiry statuses used across the CRM
export const STAGES = [
  ["new", "New", "#64748B"], ["contacted", "Contacted", "#0891B2"], ["follow-up", "Follow-up", "#2563EB"],
  ["quoted", "Quoted", "#D97706"], ["won", "Won", "#059669"], ["lost", "Lost", "#94A3B8"],
];
export const STL = Object.fromEntries(STAGES.map(s => [s[0], s[1]]));
export const STC = Object.fromEntries(STAGES.map(s => [s[0], s[2]]));
export const OPEN = ["new", "contacted", "follow-up", "quoted"];
export const isOpen = (l) => OPEN.includes(l.st);
export const LOST_REASONS = ["Budget too low", "Went with another agency", "Not responding", "Just enquiring", "Timeline not suitable", "Did it in-house", "Project cancelled", "Wrong number or spam"];

// The services field has free text from ad landing pages, so it is grouped into clear categories
export const SERVICES = ["Website", "E-commerce", "Mobile app", "Software / CRM", "SEO", "Google Ads", "Social media", "Video and animation", "Branding and design", "Photography", "Other / not sure"];
function serviceOf(list, text) {
  const s = `${(list || []).join(" ")} ${text || ""}`.toLowerCase();
  if (/e-?commerce/.test(s)) return "E-commerce";
  if (/mobile app|app dev|flutter|react native|\bapp\b/.test(s)) return "Mobile app";
  if (/crm|software/.test(s)) return "Software / CRM";
  if (/website|web dev|web design|landing|wordpress/.test(s)) return "Website";
  if (/\bseo\b/.test(s)) return "SEO";
  if (/google ads|\bppc\b/.test(s)) return "Google Ads";
  if (/social|instagram|b2b marketing|digital marketing/.test(s)) return "Social media";
  if (/video|film|anim/.test(s)) return "Video and animation";
  if (/logo|brand|graphic|ui\/ux/.test(s)) return "Branding and design";
  if (/photo/.test(s)) return "Photography";
  return "Other / not sure";
}

// Budget: the number fields, else what the client wrote ("Budget: 300k+", "₹50,000 – ₹2,00,000")
function budgetOf(min, max, list, text) {
  const n = Number(max || min || 0);
  if (n) return n;
  const s = `${(list || []).join(" ")} ${text || ""}`;
  const m = s.match(/budget[^\n|]*/i);
  if (!m) return 0;
  const part = m[0];
  const ks = [...part.matchAll(/(\d+(?:\.\d+)?)\s*k\b/gi)].map(x => Number(x[1]) * 1000);
  const rs = [...part.matchAll(/₹\s*([\d,]+)/g)].map(x => Number(x[1].replace(/,/g, "")));
  const lk = [...part.matchAll(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/gi)].map(x => Number(x[1]) * 1e5);
  const all = [...ks, ...rs, ...lk].filter(x => x > 0);
  return all.length ? Math.max(...all) : 0;
}

const AUTO = /^(enquiry received|created)/i;

function fromEnquiry(e, leadById) {
  const log = (e.activityLog || []).filter(a => a.at).sort((a, b) => new Date(a.at) - new Date(b.at));
  const human = log.filter(a => !AUTO.test(a.action || ""));
  const created = new Date(e.createdAt);
  const firstAt = human[0]?.at ? new Date(human[0].at) : null;
  const conv = log.find(a => /^converted/i.test(a.action || ""));
  const lostA = [...log].reverse().find(a => /marked as lost/i.test(a.action || ""));
  const lead = e.convertedLeadId ? leadById.get(String(e.convertedLeadId)) : null;
  const money = lead ? leadClient(lead) : null;
  const acts = [
    ...log.map(a => ({ at: a.at, t: a.action || "Note", d: a.note || "", by: a.by, auto: AUTO.test(a.action || "") })),
    ...(e.proposalComments || []).map(p => ({ at: p.at, t: `Proposal ${p.status}`, d: p.text, by: p.by })),
    ...(lead ? leadActs(lead) : []),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const st = e.status === "won" || e.convertedToLead ? "won" : e.status || "new";
  return {
    id: String(e._id), src: "enq", raw: e, lead,
    name: e.name || "-", phone: e.phone || "", email: e.email || "", company: e.company || "",
    source: e.source || "Other", svc: serviceOf(e.services, e.requirements), services: (e.services || []).join(", "),
    need: e.requirements || "", budget: budgetOf(e.budgetMin, e.budgetMax, e.services, e.requirements),
    owner: teamOwner(e.assignedTo), ownerWas: wasOwner(e.assignedTo), branch: e.branch || "", site: e.site || "nnc", landing: e.landingPage || "",
    st, created, day: ymd(created), last: acts.find(a => !a.auto)?.at || e.updatedAt || e.createdAt,
    nf: e.followUpDate ? ymd(e.followUpDate) : null,
    fr: firstAt ? Math.max(0, Math.round((firstAt - created) / 6e4)) : null,
    wonDate: st === "won" ? ymd(e.convertedAt || conv?.at || lead?.onboardedDate || e.updatedAt) : null,
    lostDate: st === "lost" ? ymd(lostA?.at || e.updatedAt) : null, reason: lostA?.note || "",
    proposal: e.proposalStatus || "",
    money, acts,
  };
}

function leadActs(l) {
  return [
    ...(l.commLogs || []).map(c => ({ at: c.at, t: c.type || "Call", d: c.summary, by: c.by })),
    ...(l.notes || []).map(n => ({ at: n.at, t: "Note", d: n.text, by: n.by })),
    ...(l.momLogs || []).map(m => ({ at: m.at, t: `Minutes: ${m.title}`, d: m.summary, by: m.by })),
    ...(l.history || []).map(h => ({ at: h.at, t: h.title || "Update", d: h.meta, by: h.by, auto: /updated/i.test(h.title || "") })),
  ].filter(a => a.at);
}

// A lead added straight in Projects (no website enquiry behind it)
function fromLead(l) {
  const c = leadClient(l);
  const created = new Date(l.createdAt);
  const st = c.lost ? "lost" : c.closed ? "won" : "new";
  const acts = leadActs(l).sort((a, b) => new Date(b.at) - new Date(a.at));
  const nextFu = c.pendingFu?.[0];
  return {
    id: String(l._id), src: "lead", raw: l, lead: l,
    name: l.name || "-", phone: l.phone || l.mobile || "", email: l.email || "", company: l.business || l.company || "",
    source: l.source || "Other", svc: serviceOf([], `${l.requirements || ""} ${l.industry || ""}`), services: l.requirements || "",
    need: l.requirements || "", budget: Number(l.value || l.dealValue || 0),
    owner: teamOwner(l.repName || l.rep), ownerWas: wasOwner(l.repName || l.rep), branch: l.branch || "", site: "nnc", landing: "",
    st, created, day: ymd(created), last: acts.find(a => !a.auto)?.at || l.updatedAt || l.createdAt,
    nf: st === "new" && nextFu ? ymd(nextFu.due) : null, fr: null,
    wonDate: st === "won" ? ymd(l.onboardedDate || l.advanceReceivedDate || l.createdAt) : null,
    lostDate: st === "lost" ? ymd(l.updatedAt) : null, reason: "", proposal: "",
    money: c, acts,
  };
}

const sameQuote = (q, l) => (q.enquiryId && String(q.enquiryId) === l.id) || (q.leadId && l.lead && String(q.leadId) === String(l.lead._id)) || (ph10(q.clientPhone) && ph10(q.clientPhone) === ph10(l.phone));
const sameEvent = (ev, l) => (ev.enquiryId && String(ev.enquiryId) === l.id) || (ev.leadId && l.lead && String(ev.leadId) === String(l.lead._id)) || (ph10(ev.leadPhone) && ph10(ev.leadPhone) === ph10(l.phone));

export function buildLeads({ enquiries, leads, quotes, events }) {
  const leadById = new Map(leads.map(l => [String(l._id), l]));
  const linked = new Set(enquiries.map(e => e.convertedLeadId && String(e.convertedLeadId)).filter(Boolean));
  const rows = [...enquiries.map(e => fromEnquiry(e, leadById)), ...leads.filter(l => !linked.has(String(l._id))).map(fromLead)];
  // same mobile number seen more than once
  const byPh = new Map();
  for (const r of rows) { const p = ph10(r.phone); if (p.length === 10) byPh.set(p, [...(byPh.get(p) || []), r]); }
  for (const r of rows) {
    const same = (byPh.get(ph10(r.phone)) || []).filter(x => x !== r).sort((a, b) => a.created - b.created);
    r.same = same;
    r.dup = same.some(x => x.created < r.created);
    r.quotes = quotes.filter(q => sameQuote(q, r)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    r.meets = events.filter(ev => sameEvent(ev, r)).sort((a, b) => new Date(b.date) - new Date(a.date));
    const q = r.quotes[0];
    r.quoteVal = q ? Number(q.total || 0) : 0;
    r.quoteDate = q ? ymd(q.createdAt) : null;
  }
  // how well each source converts, from the leads that have finished (won or lost)
  const conv = {};
  for (const r of rows) {
    const c = conv[r.source] || (conv[r.source] = { won: 0, done: 0 });
    if (r.st === "won") { c.won++; c.done++; } else if (r.st === "lost") c.done++;
  }
  for (const r of rows) { const c = conv[r.source]; r.srcRate = c && c.done >= 5 ? c.won / c.done : null; score(r); }
  return rows;
}

export const val = (l) => (l.st === "won" && l.money ? l.money.total : l.quoteVal || l.budget || 0);

// Score 1 to 99, with the reasons shown in the lead
export function score(l) {
  const B = [["Starting score", 30]];
  const add = (t, v) => { if (v) B.push([t, v]); };
  if (l.srcRate != null) add(`${l.source} leads convert ${Math.round(l.srcRate * 100)}%`, Math.round(l.srcRate * 30) - 5);
  add(l.budget >= 200000 ? "Budget ₹2L or more" : l.budget >= 50000 ? "Budget ₹50k or more" : l.budget > 0 ? "Budget given" : "", l.budget >= 200000 ? 15 : l.budget >= 50000 ? 10 : l.budget > 0 ? 5 : 0);
  add({ contacted: "Spoke with us", "follow-up": "In follow-up", quoted: "Quotation sent" }[l.st] || "", { contacted: 8, "follow-up": 12, quoted: 22 }[l.st] || 0);
  if (l.meets?.length) add("Meeting held or booked", 10);
  if (l.fr != null && l.fr <= 15) add("Answered within 15 min", 5);
  if (isOpen(l) && dd(l.created) >= -2) add("Enquired in the last 2 days", 10);
  const idle = -dd(l.last);
  if (isOpen(l) && idle > 30) add(`No activity for ${idle} days`, -25);
  else if (isOpen(l) && idle > 14) add(`No activity for ${idle} days`, -12);
  if (l.dup) add("Enquired before", 5);
  l.sb = B;
  l.sc = Math.max(1, Math.min(99, B.reduce((a, x) => a + x[1], 0)));
  return l.sc;
}
export const band = (s) => (s >= 70 ? "hot" : s >= 45 ? "warm" : "cold");

const minsSince = (d) => Math.max(0, Math.round((Date.now() - new Date(d)) / 6e4));
export function why(l) {
  const t = TODAY();
  if (l.st === "new") return l.day === t ? [`Waiting ${fmin(minsSince(l.created))} for a first reply`, minsSince(l.created) > 15 ? "p-red" : "p-amb"] : [`Never contacted, ${-dd(l.created)} days old`, "p-red"];
  const mt = l.meets?.find(m => ymd(m.date) === t && !m.done);
  if (mt) return [`Meeting today${mt.time ? ` at ${mt.time}` : ""}`, "p-pur"];
  if (l.st === "quoted" && dd(l.quoteDate || l.last) <= -3) return [`Quotation ${l.quoteVal ? L(l.quoteVal) : ""} sent ${-dd(l.quoteDate || l.last)} days ago`, "p-amb"];
  if (isOpen(l) && l.nf && l.nf < t) return [`Follow-up was due ${fd(l.nf)}`, "p-red"];
  if (isOpen(l) && l.nf === t) return ["Follow-up due today", "p-blue"];
  if (isOpen(l) && !l.nf) return [`No follow-up date, last touched ${fd(l.last)}`, "p-amb"];
  if (isOpen(l)) return [`Next follow-up ${fd(l.nf)}`, "p-gr"];
  if (l.st === "won") return [l.money?.balance > 0 ? `Won · ${L(l.money.balance)} balance due` : `Won on ${fd(l.wonDate)}`, "p-ok"];
  return [`Lost${l.reason ? `: ${l.reason}` : ""}`, "p-gr"];
}
export function prio(l) {
  const s = l.sc, t = TODAY();
  if (isOpen(l) && l.st !== "new" && dd(l.last) <= -30) return s - 60;
  if (l.st === "new" && dd(l.created) < -14) return s - 40;   // old, never contacted: clean-up list, not today's
  let u = 0;
  if (l.st === "new") u = l.day === t ? 40 + Math.min(30, minsSince(l.created) / 4) : 30;
  else if (l.meets?.some(m => ymd(m.date) === t && !m.done)) u = 45;
  else if (l.nf && l.nf < t) u = Math.min(30, -dd(l.nf) * 4) + 10;
  else if (l.nf === t) u = 12;
  else if (!l.nf) u = 8;
  if (l.st === "quoted" && dd(l.quoteDate || l.last) <= -3) u += 18;
  return s + u + Math.min(20, val(l) / 50000);
}

// Saved views in All leads
export const VIEWS = {
  open: ["All open", l => isOpen(l)],
  nocontact: ["Not contacted", l => l.st === "new"],
  due: ["Follow-up today", l => isOpen(l) && l.nf === TODAY()],
  overdue: ["Follow-up overdue", l => isOpen(l) && l.nf && l.nf < TODAY()],
  nodate: ["No follow-up date", l => isOpen(l) && l.st !== "new" && !l.nf],
  hot: ["Hot", l => isOpen(l) && l.sc >= 70],
  quoted: ["Quoted, no reply 3+ days", l => l.st === "quoted" && dd(l.quoteDate || l.last) <= -3],
  quiet: ["Gone quiet 14+ days", l => isOpen(l) && l.st !== "new" && dd(l.last) <= -14],
  clean: ["Clean up: idle 30+ days", l => isOpen(l) && dd(l.last) <= -30],
  dup: ["Same number again", l => l.dup && l.st !== "lost"],
  won: ["Won", l => l.st === "won"],
  lost: ["Lost", l => l.st === "lost"],
  all: ["Everything", () => true],
};

export const AGE = [["0", "Today", 0, 0], ["1", "1 to 7 days", 1, 7], ["8", "8 to 30 days", 8, 30], ["31", "31 to 90 days", 31, 90], ["91", "Over 90 days", 91, 1e6]];
export const inAge = (l, k) => { const b = AGE.find(x => x[0] === k); const a = -dd(l.created); return a >= b[2] && a <= b[3]; };

export const TPL = {
  greet: ["New enquiry greeting", "Hi {name}, thank you for contacting Nakshatra Namaha Creations about {service}. I am {owner}. When is a good time for a quick call today?"],
  missed: ["Missed call", "Hi {name}, we tried to reach you about your {service} enquiry. I am {owner} from Nakshatra Namaha Creations. When can we talk?"],
  portfolio: ["Share portfolio", "Hi {name}, as discussed, here is our work: nakshatranamahacreations.com. Shall we fix a 20 minute call to go over your {service} requirement?"],
  quote: ["Quotation follow-up", "Hi {name}, just checking if you had a chance to go through our quotation for {service}{amount}. Happy to clarify anything on a quick call."],
  nudge: ["Gentle follow-up", "Hi {name}, following up on your {service} requirement. Are you still planning this? Let me know a good time to talk."],
  revive: ["Reactivate old lead", "Hi {name}, you had enquired with us about {service} some time ago. Would you like to restart the discussion? We have some new offers this month."],
};
export function fillTpl(text, l) {
  return text.replace(/\{name\}/g, l.name.split(" ")[0]).replace(/\{service\}/g, l.svc === "Other / not sure" ? "your project" : l.svc.toLowerCase())
    .replace(/\{owner\}/g, l.owner === "Unassigned" ? "from the team" : l.owner).replace(/\{amount\}/g, l.quoteVal ? ` (${L(l.quoteVal)})` : "");
}
export const tplFor = (l) => (l.st === "new" ? "greet" : l.st === "quoted" ? "quote" : l.st === "lost" ? "revive" : dd(l.last) <= -7 ? "nudge" : "portfolio");
export const waLink = (l, t) => `https://wa.me/91${ph10(l.phone)}?text=${encodeURIComponent(t)}`;
