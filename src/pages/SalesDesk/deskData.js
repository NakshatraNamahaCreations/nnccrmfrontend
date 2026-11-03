// Sales Desk: turns real CRM records (leads, enquiries, calendar events,
// monthly services) into one client list and a list of follow-up items.
import { calcGst } from "../../Leads/gst";

export const DAY = 864e5;
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysFrom = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / DAY); // <0 = past
export const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export const addDays = (n) => ymd(Date.now() + n * DAY);
export const fds = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-");
export const fdw = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "-");
export const inr = (n) => (n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "₹0");
export const lakh = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)}L` : inr(n));
export const initials = (n) => String(n || "?").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase() || "?";
export const waPhone = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };
export const ampm = (t) => { if (!t) return "All day"; let [h, m] = t.split(":").map(Number); const p = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""} ${p}`; };
export const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

// "Harish ", "HARISH", "Harish J N" → "Harish"; "Sathish" → "Satish"
export function ownerName(raw) {
  const w = String(raw || "").trim().split(/\s+/)[0] || "";
  if (!w) return "Unassigned";
  const n = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return n === "Sathish" ? "Satish" : n;
}

/* routine = can go out in a bulk send; the rest need a person */
export const KIND = {
  new:      { label: "New lead",            pill: "blue", score: 50, routine: false, tpl: "enq" },
  asked:    { label: "Client asked to remind", pill: "pur",  score: 45, routine: false, tpl: "gentle" },
  promise:  { label: "Payment follow-up",      pill: "ok",   score: 38, routine: false, tpl: "payfu" },
  advance:  { label: "Advance pending",        pill: "ok",   score: 34, routine: false, tpl: "adv" },
  pay:      { label: "Balance pending",        pill: "late", score: 32, routine: true,  tpl: "pay" },
  monthly:  { label: "Monthly due",            pill: "late", score: 30, routine: true,  tpl: "monthly" },
  followup: { label: "Follow-up due",          pill: "",     score: 26, routine: true,  tpl: "followup" },
  delivery: { label: "Delivery overdue",       pill: "late", score: 20, routine: false, tpl: "update" },
  uncontacted: { label: "Not contacted yet",   pill: "late", score: 16, routine: true,  tpl: "enq" },
  quiet:    { label: "Gone quiet",             pill: "late", score: 12, routine: true,  tpl: "quiet" },
  review:   { label: "Review pending",         pill: "",     score: 3,  routine: true,  tpl: "review" },
};

export const ENQ_STAGE = { new: "New lead", contacted: "Contacted", "follow-up": "Follow-up", quoted: "Quoted", won: "Won", lost: "Lost" };

const isWa = (s) => /whatsapp/i.test(String(s || ""));
const isMail = (s) => /^e-?mail/i.test(String(s || ""));

export function leadClient(l) {
  const g = calcGst(l.value, l.gstApplicable, l.gstRate || 18);
  const received = Number(l.advanceReceived || 0);
  const closed = l.stage === "Closed" || l.status === "closed";
  const lost = /lost/i.test(`${l.stage} ${l.status}`);
  const completed = !!l.projectCompleted || l.projectStage === "Project Completed";
  const acts = [
    ...(l.commLogs || []).map(c => ({ at: c.at, who: isWa(c.type) ? "wa" : "call", text: `${c.type}: ${c.summary}`, wa: isWa(c.type) })),
    ...(l.emailLogs || []).map(m => ({ at: m.sentAt, who: "mail", text: `Email: ${m.subject || m.type}`, mail: true })),
    ...(l.notes || []).map(n => ({ at: n.at, who: "note", text: n.text })),
    ...(l.history || []).map(h => ({ at: h.at, who: "sys", text: [h.title, h.meta].filter(Boolean).join(" · ") })),
  ].filter(a => a.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  const pendingFu = (l.followups || []).filter(f => !f.done)
    .map(f => ({ ...f, due: f.dueDate ? new Date(f.dueDate) : new Date(new Date(f.at || l.createdAt).getTime() + (Number(f.dayIndex) || 0) * DAY), dated: !!f.dueDate }))
    .sort((a, b) => a.due - b.due);
  const stageLabel = lost ? "Lost" : !closed ? (l.stage || "Lead") : (l.projectStage || "Won · not started");
  return {
    // "project" once the deal is closed; open leads count as new leads
    id: String(l._id || l.id), src: "lead", group: closed ? "project" : "new", raw: l,
    name: l.name || "-", phone: l.phone || l.mobile || "", email: l.email || "",
    company: l.business || l.company || "", project: l.requirements || l.industry || l.business || "project",
    owner: ownerName(l.repName || l.rep), source: l.source || "", branch: l.branch || "",
    total: g.total, received, balance: Math.max(0, g.total - received),
    closed, lost, completed, hold: l.projectStage === "On Hold",
    stageLabel, acts, lastAct: acts[0]?.at || l.updatedAt || l.createdAt, pendingFu,
    createdAt: l.createdAt,
  };
}

export function enquiryClient(e) {
  const acts = [
    ...(e.activityLog || []).map(a => ({ at: a.at, who: isWa(a.action) ? "wa" : isMail(a.action) ? "mail" : "note", text: [a.action, a.note].filter(Boolean).join(": "), wa: isWa(a.action), mail: isMail(a.action) })),
    ...(e.proposalComments || []).map(p => ({ at: p.at, who: "sys", text: `Proposal ${p.status}${p.text ? `: ${p.text}` : ""}` })),
  ].filter(a => a.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  const budget = Number(e.budgetMax || e.budgetMin || 0);
  return {
    id: String(e._id), src: "enq", group: "new", raw: e,
    name: e.name || "-", phone: e.phone || "", email: e.email || "",
    company: e.company || "", project: (e.services || []).join(", ") || e.requirements || "requirement",
    owner: ownerName(e.assignedTo), source: e.source || "", branch: e.branch || "",
    total: budget, received: 0, balance: 0, closed: false, lost: e.status === "lost", completed: false, hold: false,
    stageLabel: ENQ_STAGE[e.status] || e.status || "New lead", acts, lastAct: acts[0]?.at || e.updatedAt || e.createdAt,
    pendingFu: [], createdAt: e.createdAt, enqStatus: e.status,
  };
}

export function eventClient(ev) {
  return {
    id: `ev-${ev._id}`, src: "event", raw: ev, name: ev.leadName || ev.title || "Calendar entry", phone: ev.leadPhone || "",
    email: ev.email || "", company: ev.leadBusiness || "", project: ev.title || "follow-up", owner: "Unassigned", source: "Calendar",
    total: 0, received: 0, balance: 0, closed: false, lost: false, completed: false, hold: false,
    stageLabel: "Calendar", acts: [], lastAct: ev.createdAt, pendingFu: [], createdAt: ev.createdAt,
  };
}

// WhatsApp and email reminders sent in the last 30 days
export function waCount(c) {
  let n = 0;
  for (const a of c.acts) {
    if (daysFrom(a.at) < -30) break;
    if (a.wa || a.mail) n++;
  }
  return n;
}

const EV_KIND = { payment_followup: "promise", client_response: "asked", call_followup: "followup", enquiry_followup: "followup" };

export function buildItems({ clients, events, services, settings }) {
  const R = settings.rules;
  const snoozed = new Map((settings.snoozes || []).map(s => [s.key, new Date(s.until)]));
  const byId = new Map(clients.map(c => [c.id, c]));
  const out = [];
  const add = (c, kind, date, what, amt, extra = {}) => {
    const key = extra.key || `${c.id}-${kind}`;
    if (snoozed.has(key) && snoozed.get(key) > new Date()) return;
    if (c.hold && R.holdPause && kind !== "asked") return;
    const due = daysFrom(date);
    const sent = waCount(c);
    const why = [];
    if (!KIND[kind].routine) why.push(kind === "new" ? "new lead needs a call" : kind === "asked" ? "personal reminder" : kind === "promise" ? "payment follow-up" : kind === "delivery" ? "delivery is late" : "needs a call");
    if ((amt || 0) >= R.bigAmount) why.push("large amount");
    if (sent >= R.maxAuto) why.push(`${sent} reminders already sent`);
    const human = why.length > 0;
    out.push({
      key, c, kind, date, due, what, amt: amt || 0, sent, human, whyHuman: why.join(", "), ...extra,
      score: KIND[kind].score + Math.min(40, (amt || 0) / 10000) + Math.max(0, -due) * 0.5 + (human ? 20 : 0) - (due > 0 ? due * 6 : 0),
    });
  };

  // Calendar entries (payment / call / enquiry follow-ups, client asked)
  for (const ev of events) {
    if (ev.type === "demo" || ev.done || ["done", "cancelled", "noshow"].includes(ev.status)) continue;
    const kind = EV_KIND[ev.type];
    if (!kind || daysFrom(ev.date) > 7) continue;
    const c = byId.get(String(ev.leadId || "")) || byId.get(String(ev.enquiryId || "")) || eventClient(ev);
    if (c.lost) continue;
    add(c, kind, ev.date, [ev.title, ev.notes].filter(Boolean).join(" · ") || "Calendar follow-up", c.closed ? c.balance : 0, { key: `ev-${ev._id}`, eventId: ev._id });
  }

  for (const c of clients) {
    if (c.lost) continue;
    const quietDays = -daysFrom(c.lastAct);

    if (c.src === "enq") {
      const e = c.raw;
      if (e.convertedToLead || e.status === "won") continue;
      if (e.followUpDate && daysFrom(e.followUpDate) <= 7) add(c, "followup", e.followUpDate, `Follow-up · ${c.stageLabel}`, 0, { enqFollow: true });
      else if (e.status === "new") {
        if (daysFrom(e.createdAt) >= -7) add(c, "new", e.createdAt, `New ${e.source || ""} lead for ${c.project}.`, 0);
        else add(c, "uncontacted", e.createdAt, `${e.source || "New"} lead from ${fds(e.createdAt)}, never contacted.`, 0);
      } else if (quietDays >= R.quietDays) add(c, "quiet", c.lastAct, `${c.stageLabel} · no activity for ${quietDays} days.`, 0);
      continue;
    }

    const fu = c.pendingFu.find(f => (c.closed ? f.dated : true));
    if (fu && daysFrom(fu.due) <= 7) add(c, "followup", fu.due, `${fu.title || "Follow-up"} · ${fu.channel || "Call"}`, c.closed ? c.balance : c.total, { leadFollow: fu.dated });

    if (!c.closed) {
      if (!c.raw.commLogs?.length && !(c.raw.followups || []).some(f => f.done)) add(c, "new", c.createdAt, `New lead from ${c.source || "enquiry"}. Not contacted yet.`, c.total);
      else if (!fu && quietDays >= R.quietDays) add(c, "quiet", c.lastAct, `No activity for ${quietDays} days.`, c.total);
      continue;
    }
    const l = c.raw;
    if (c.total > 0 && c.received === 0) add(c, "advance", l.onboardedDate || c.createdAt, `Deal closed for ${inr(c.total)}. No advance received yet.`, c.total);
    else if (c.balance > 0 && (c.completed || (l.finalPaymentDate && daysFrom(l.finalPaymentDate) <= 7))) {
      add(c, "pay", l.finalPaymentDate || l.projectCompletionDate || l.updatedAt,
        `${inr(c.balance)} balance${c.completed ? " · project completed" : ` · final payment ${fds(l.finalPaymentDate)}`}.`, c.balance);
    }
    if (!c.completed && l.projectCompletionDate && daysFrom(l.projectCompletionDate) < 0)
      add(c, "delivery", l.projectCompletionDate, `Delivery was due ${fds(l.projectCompletionDate)}. Stage: ${l.projectStage || "not set"}.`, c.balance);
    if (c.completed && c.balance === 0 && !c.acts.some(a => /review/i.test(a.text))) {
      const doneOn = l.projectCompletionDate || l.updatedAt;
      if (daysFrom(doneOn) >= -R.reviewDays && daysFrom(doneOn) <= 0) add(c, "review", doneOn, `Project completed ${fds(doneOn)}. Ask for a Google review.`, 0);
    }
  }

  // Monthly services (Google Ads, SEO …)
  const monthly = new Map();
  for (const s of services) {
    const c = byId.get(String(s.lead?._id || s.lead));
    if (!c) continue;
    const rows = (s.schedule || []).filter(r => ["overdue", "partial", "due"].includes(r.status) && r.balance > 0 && daysFrom(r.dueDate) <= 3);
    if (!rows.length) continue;
    const m = monthly.get(c.id) || { c, amt: 0, date: null, names: [] };
    for (const r of rows) { m.amt += r.balance; if (!m.date || new Date(r.dueDate) < m.date) m.date = new Date(r.dueDate); }
    m.names.push(s.name);
    monthly.set(c.id, m);
  }
  for (const m of monthly.values()) add(m.c, "monthly", m.date, `${inr(m.amt)} due for ${m.names.join(", ")}.`, m.amt, { services: m.names.join(", ") });

  return out.sort((a, b) => b.score - a.score);
}

const WA_TPL = [
  { id: "enq", name: "New lead: ask requirements", for: "New or uncontacted lead",
    text: "{greet} {name}, thank you for reaching out to Nakshatra Namaha Creations.\n\nTo share an accurate quote for your {project}, could you tell me:\n1. What it is for, and who will use it\n2. Main features you need\n3. Any reference sites or apps you like\n4. Your timeline and approximate budget\n\nHappy to get on a quick call as well. What time suits you today?" },
  { id: "followup", name: "Follow-up", for: "Follow-up due",
    text: "{greet} {name}, following up on our discussion about your {project}.\n\nPlease let me know a convenient time for a quick call so we can take this forward." },
  { id: "adv", name: "Advance reminder", for: "Deal closed, advance pending",
    text: "{greet} {name}, hope you are doing well.\n\nA gentle reminder about the advance for your {project}. Once we receive it, we will start work the same day and share the timeline.\n\n{bank}\n\nPlease share the transaction reference here once done. Thank you." },
  { id: "pay", name: "Balance payment request", for: "Balance pending",
    text: "{greet} {name}, hope you are doing well.\n\nThis is a reminder about the pending balance of {balance} for your {project}. Kindly arrange the payment at the earliest.\n\n{bank}\n\nPlease share the transaction reference here once done. Thank you." },
  { id: "payfu", name: "Payment follow-up", for: "Payment follow-up on the calendar",
    text: "{greet} {name}, following up regarding the payment of {balance} for your {project}.\n\nCould you please let me know a date by when it can be processed? It will help us plan the work accordingly.\n\n{bank}" },
  { id: "monthly", name: "Monthly payment reminder", for: "Monthly service due",
    text: "{greet} {name}, a gentle reminder that {monthly} is due for your monthly services ({services}).\n\n{bank}\n\nKindly share the reference here once done. Thank you." },
  { id: "update", name: "Project update", for: "Delivery overdue",
    text: "{greet} {name}, sharing a quick update on your {project}. We are working on the final items and will share the next version shortly.\n\nIf anything is pending from your side (content, logins or approvals), please send it so we can complete this quickly." },
  { id: "quiet", name: "Checking in (gone quiet)", for: "No activity for many days",
    text: "{greet} {name}, hope all is well at your end.\n\nI have not heard from you for a while, so just checking in on the {project}. Please let me know a convenient time for a quick call this week." },
  { id: "gentle", name: "Gentle reminder (client asked)", for: "Client asked to be reminded",
    text: "{greet} {name}, hope you are doing well.\n\nAs you asked, sharing a gentle reminder about the {project}. Whenever it is convenient, we will be ready to continue." },
  { id: "final", name: "Final payment and account clearance", for: "Project completed",
    text: "{greet} {name}, your {project} is complete and live. Thank you for working with us.\n\nKindly arrange the final payment of {balance} to close the account.\n\n{bank}\n\nPlease also send a short confirmation email that the agreed scope is complete." },
  { id: "review", name: "Google review request", for: "After delivery",
    text: "{greet} {name}, thank you for choosing Nakshatra Namaha Creations for your {project}.\n\nIf you are happy with our work, a short Google review would mean a lot to our team: {reviewLink}\n\nThank you." },
  { id: "meet", name: "Meeting confirmation", for: "Meeting scheduled",
    text: "{greet} {name}, confirming our meeting about your {project} on {meetWhen}.\n\n{meetWhere}\n\nLooking forward to speaking with you." },
];

// Email version of each template. The email layout already starts with "Dear <name>,"
const SIGN = "\n\nWarm regards,\nNakshatra Namaha Creations";
const MAIL_TPL = {
  enq:      { subject: "Your enquiry with Nakshatra Namaha Creations",
    mail: "Thank you for reaching out to Nakshatra Namaha Creations about your {project}.\n\nTo share an accurate quote, could you reply with:\n1. What it is for, and who will use it\n2. Main features you need\n3. Any reference sites or apps you like\n4. Your timeline and approximate budget\n\nYou can also reply with a convenient time for a quick call." + SIGN },
  followup: { subject: "Following up on your {project}",
    mail: "Following up on our discussion about your {project}.\n\nPlease let us know a convenient time for a quick call so we can take this forward." + SIGN },
  adv:      { subject: "Advance payment for your {project}",
    mail: "A gentle reminder about the advance for your {project}. Once we receive it, we will start work the same day and share the timeline.\n\n{bank}\n\nPlease reply with the transaction reference once done." + SIGN },
  pay:      { subject: "Pending balance of {balance} for your {project}",
    mail: "This is a reminder about the pending balance of {balance} for your {project}. Kindly arrange the payment at the earliest.\n\n{bank}\n\nPlease reply with the transaction reference once done." + SIGN },
  payfu:    { subject: "Payment follow-up: {project}",
    mail: "We are following up regarding the payment of {balance} for your {project}.\n\nCould you please let us know a date by when it can be processed? It will help us plan the work accordingly.\n\n{bank}" + SIGN },
  monthly:  { subject: "Monthly payment due: {services}",
    mail: "A gentle reminder that {monthly} is due for your monthly services ({services}).\n\n{bank}\n\nPlease reply with the reference once done." + SIGN },
  update:   { subject: "Update on your {project}",
    mail: "Sharing a quick update on your {project}. We are working on the final items and will share the next version shortly.\n\nIf anything is pending from your side (content, logins or approvals), please send it so we can complete this quickly." + SIGN },
  quiet:    { subject: "Checking in: {project}",
    mail: "Hope all is well at your end. We have not heard from you for a while, so we are checking in on your {project}.\n\nPlease let us know a convenient time for a quick call this week." + SIGN },
  gentle:   { subject: "Gentle reminder: {project}",
    mail: "As you asked, sharing a gentle reminder about your {project}. Whenever it is convenient, we will be ready to continue." + SIGN },
  final:    { subject: "Your {project} is complete: final payment",
    mail: "Your {project} is complete and live. Thank you for working with us.\n\nKindly arrange the final payment of {balance} to close the account.\n\n{bank}\n\nPlease also reply to confirm that the agreed scope is complete." + SIGN },
  review:   { subject: "How did we do on your {project}?",
    mail: "Thank you for choosing Nakshatra Namaha Creations for your {project}.\n\nIf you are happy with our work, a short Google review would mean a lot to our team: {reviewLink}" + SIGN },
  meet:     { subject: "Meeting confirmation: {meetWhen}",
    mail: "Confirming our meeting about your {project} on {meetWhen}.\n\n{meetWhere}\n\nLooking forward to speaking with you." + SIGN },
};
export const DEFAULT_TPL = WA_TPL.map(t => ({ ...t, ...MAIL_TPL[t.id] }));


export function bankText(settings, banks) {
  const b = banks.find(x => String(x._id) === String(settings.bankAccountId)) || null;
  const lines = [];
  if (b) {
    lines.push("Account name: Nakshatra Namaha Creations Pvt Ltd");
    if (b.bankName) lines.push(`Bank: ${b.bankName}`);
    if (b.accountNumber) lines.push(`Account no: ${b.accountNumber}`);
    if (b.ifsc) lines.push(`IFSC: ${b.ifsc}`);
  }
  if (settings.upi) lines.push(`UPI: ${settings.upi}`);
  return lines.join("\n");
}

export function fillTemplate(text, c, ctx = {}) {
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const bank = ctx.bank || "";
  return text
    .replace(/\{greet\}/g, greet)
    .replace(/\{name\}/g, String(c.name || "").split(" ")[0] || "")
    .replace(/\{project\}/g, c.project)
    .replace(/\{balance\}/g, inr(c.balance))
    .replace(/\{monthly\}/g, ctx.item?.kind === "monthly" ? inr(ctx.item.amt) : "the monthly payment")
    .replace(/\{services\}/g, ctx.item?.services || "monthly services")
    .replace(/\{reviewLink\}/g, ctx.reviewLink || "[review link: set it in Automation]")
    .replace(/\{meetWhen\}/g, ctx.meet ? `${fdw(ctx.meet.date)}, ${ampm(ctx.meet.time)}` : "[date and time]")
    .replace(/\{meetWhere\}/g, ctx.meet ? (ctx.meet.mode === "meet" ? `Google Meet: ${ctx.meet.link || "[link]"}` : ctx.meet.mode === "office" ? "At our office." : "We will call you on this number.") : "")
    // empty {bank} leaves no blank gap
    .replace(/\n*\{bank\}\n*/g, bank ? `\n\n${bank}\n\n` : "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function exportCsv(rows, name) {
  const head = ["Client", "Company", "Phone", "Source", "Type", "Details", "Amount", "Due", "Handled by"];
  const body = rows.map(x => [x.c.name, x.c.company, x.c.phone, x.c.src === "enq" ? "Enquiry" : x.c.src === "lead" ? "Lead" : "Calendar", KIND[x.kind]?.label || x.c.stageLabel, x.what || "", Math.round(x.amt || 0), x.date ? ymd(x.date) : "", x.c.owner]);
  const csv = [head, ...body].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = `${name}-${ymd(new Date())}.csv`; a.click();
  URL.revokeObjectURL(url);
}
