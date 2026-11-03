import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, RefreshCcw } from "lucide-react";
import { toast } from "../../utils/toast";
import { calcGst } from "../../Leads/gst";
import { billingApi, monthLabel } from "../ProjectBilling/billingMeta";
import { PaymentModal } from "../ProjectBilling/BillingModals";
import "./PaymentCalendar.css";

/*
 * Month calendar of money due from clients, built from:
 *   - project balances (total incl. GST − received), due on the final payment date
 *   - monthly services, one entry per month on the billing day (next 2 months projected)
 *   - additional work, due on the date it was requested
 * Click a client to see what is pending, record payments or send a WhatsApp reminder.
 */

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY = 864e5;

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
// "2026-11-05T00:00:00Z" / "2026-11-05" → local midnight of that calendar date
const toDay = (v) => {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  return y ? new Date(y, m - 1, d) : null;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const num = (n) => Math.round(n || 0).toLocaleString("en-IN");
const fd  = (d) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const ordinal = (n) => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
const PROJECTED_MONTHS = 2;

function buildItems(leads, services, extras, today) {
  const items = [];

  for (const l of leads) {
    const { total } = calcGst(l.value, l.gstApplicable, l.gstRate || 18);
    if (total <= 0) continue;
    const paid = Number(l.advanceReceived) || 0;
    const due  = toDay(l.finalPaymentDate || l.projectCompletionDate || l.onboardedDate || l.createdAt);
    if (!due) continue;
    items.push({
      key: `p-${l._id}`, kind: "project", leadId: l._id, title: l.business ? `Project · ${l.business}` : "Project",
      due, amount: total, paid, balance: Math.max(0, total - paid), lead: l,
    });
  }

  for (const s of services) {
    const leadId = s.lead?._id || s.lead;
    for (const r of s.schedule || []) {
      if (r.status === "waived") continue;
      items.push({
        key: `s-${s._id}-${r.period}`, kind: "service", leadId, title: `${s.name} · ${monthLabel(r.period)}`,
        due: toDay(r.dueDate), amount: r.amount, paid: r.paid, balance: r.balance, service: s, period: r.period,
      });
    }
    // Upcoming months, so next month's calendar is not empty
    if (s.active) {
      const end = toDay(s.endDate);
      for (let i = 1; i <= PROJECTED_MONTHS; i++) {
        const due = new Date(today.getFullYear(), today.getMonth() + i, s.billingDay || 1);
        if (end && due > end) break;
        if (due < toDay(s.startDate)) continue;
        const period = iso(due).slice(0, 7);
        items.push({
          key: `s-${s._id}-${period}`, kind: "service", leadId, title: `${s.name} · ${monthLabel(period)}`,
          due, amount: s.monthlyTotal, paid: 0, balance: s.monthlyTotal, service: s, period, projected: true,
        });
      }
    }
  }

  for (const x of extras) {
    if (x.status === "cancelled" || !(x.total > 0)) continue;
    items.push({
      key: `x-${x._id}`, kind: "extra", leadId: x.lead?._id || x.lead, title: `Extra · ${x.title}`,
      due: toDay(x.requestedDate), amount: x.total, paid: x.paid, balance: x.balance, extra: x,
    });
  }

  return items
    .filter(i => i.due)
    .map(i => ({ ...i, state: i.balance <= 0 ? "paid" : i.due < today ? "late" : "up" }));
}

export default function PaymentCalendar({ onRecordProject, reloadKey }) {
  const today = useMemo(startOfToday, []);
  const [view, setView]       = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [leads, setLeads]     = useState([]);
  const [services, setServices] = useState([]);
  const [extras, setExtras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId]   = useState(null);
  const [paying, setPaying]   = useState(null); // item being paid (service / extra)

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      // Monthly services / extras are optional — the calendar still works without them
      const [l, s, x] = await Promise.all([
        billingApi("/leads?limit=200"),
        billingApi("/recurring-services").catch(() => ({ data: [] })),
        billingApi("/project-extras").catch(() => ({ data: [] })),
      ]);
      setLeads(l.data || []);
      setServices(s.data || []);
      setExtras(x.data || []);
    } catch (err) {
      setError(err.message || "Failed to load payments");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const items   = useMemo(() => buildItems(leads, services, extras, today), [leads, services, extras, today]);
  const leadMap = useMemo(() => new Map(leads.map(l => [String(l._id), l])), [leads]);
  const nameOf  = (id) => leadMap.get(String(id))?.name || "Client";

  // One calendar entry per client per day
  const monthKey = iso(view).slice(0, 7);
  const entries = useMemo(() => {
    const g = new Map();
    for (const i of items) {
      if (iso(i.due).slice(0, 7) !== monthKey) continue;
      const k = `${i.leadId}|${iso(i.due)}`;
      if (!g.has(k)) g.set(k, { leadId: i.leadId, due: i.due, items: [] });
      g.get(k).items.push(i);
    }
    return [...g.values()].map(e => {
      const amount  = e.items.reduce((s, i) => s + i.amount, 0);
      const pending = e.items.reduce((s, i) => s + i.balance, 0);
      return { ...e, amount, pending, state: pending <= 0 ? "paid" : e.due < today ? "late" : "up" };
    });
  }, [items, monthKey, today]);

  const dueTotal  = entries.reduce((s, e) => s + e.amount, 0);
  const pendTotal = entries.reduce((s, e) => s + e.pending, 0);

  // Still pending from before this month, per client, biggest first
  const earlier = useMemo(() => {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const g = new Map();
    for (const i of items) {
      if (i.due >= first || i.balance <= 0) continue;
      const cur = g.get(i.leadId) || { leadId: i.leadId, pending: 0, oldest: i.due };
      cur.pending += i.balance;
      if (i.due < cur.oldest) cur.oldest = i.due;
      g.set(i.leadId, cur);
    }
    return [...g.values()].sort((a, b) => b.pending - a.pending);
  }, [items, today]);

  // Calendar grid
  const byDay = {};
  entries.forEach(e => { (byDay[e.due.getDate()] ||= []).push(e); });
  const lead = (view.getDay() + 6) % 7;
  const dim  = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const tail = (7 - ((lead + dim) % 7)) % 7;
  const order = { late: 0, up: 1, paid: 2 };

  const shift = (n) => setView(v => new Date(v.getFullYear(), v.getMonth() + n, 1));

  return (
    <div className="pc">
      <div className="pc-head">
        <div className="pc-month">
          <h1>{MONTHS[view.getMonth()]} {view.getFullYear()}<span>.</span></h1>
        </div>
        <div className="pc-month">
          <button type="button" className="pc-today" onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
          <button type="button" className="pc-nav" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <button type="button" className="pc-nav" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
          <button type="button" className="pc-nav" onClick={load} aria-label="Refresh" disabled={loading}><RefreshCcw size={15} className={loading ? "pc-spin" : ""} /></button>
        </div>
      </div>

      {error && <div className="pc-error">{error}</div>}

      <p className="pc-summary">
        {loading ? "Loading payments…" : entries.length
          ? <><b>{inr(dueTotal)}</b> due from {new Set(entries.map(e => String(e.leadId))).size} clients this month. <b>{inr(dueTotal - pendTotal)}</b> received, <b className={pendTotal ? "late" : "ok"}>{inr(pendTotal)}</b> pending.</>
          : "No payments scheduled this month."}
      </p>
      <div className="pc-key"><span className="k2">Due</span><span className="k3">Late</span><span className="k1">Paid</span></div>

      <div className="pc-cal">
        {DOW.map(d => <div key={d} className="pc-dow">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} className="pc-day out" />)}
        {Array.from({ length: dim }, (_, i) => {
          const d = i + 1;
          const isToday = iso(new Date(view.getFullYear(), view.getMonth(), d)) === iso(today);
          const list = (byDay[d] || []).sort((a, b) => order[a.state] - order[b.state]);
          return (
            <div key={d} className={`pc-day${isToday ? " today" : ""}`}>
              <span className="n">{d}</span>
              {list.map(e => (
                <button
                  key={`${e.leadId}-${d}`} type="button" className={`pc-pay ${e.state}`}
                  title={`${nameOf(e.leadId)} — ${e.items.map(i => i.title).join(", ")}`}
                  onClick={() => setOpenId(e.leadId)}
                >
                  <b>{nameOf(e.leadId)}</b>
                  <small>{e.state === "paid" ? "Paid" : num(e.pending)}</small>
                </button>
              ))}
            </div>
          );
        })}
        {Array.from({ length: tail }, (_, i) => <div key={`t${i}`} className="pc-day out" />)}
      </div>

      <section className="pc-earlier">
        <h2>Still pending from earlier months</h2>
        <p>{earlier.length
          ? `${earlier.length} clients, ${inr(earlier.reduce((s, x) => s + x.pending, 0))} in total. Biggest first.`
          : "Nothing pending from earlier months."}</p>
        {earlier.length > 0 && (
          <div className="pc-list">
            {(showAll ? earlier : earlier.slice(0, 6)).map(x => {
              const l = leadMap.get(String(x.leadId));
              return (
                <button key={x.leadId} type="button" className="pc-row" onClick={() => setOpenId(x.leadId)}>
                  <span className="who"><b>{l?.name || "Client"}</b><span>{l?.business || l?.phone || ""}</span></span>
                  <span className="ago">{Math.round((today - x.oldest) / DAY)} days late</span>
                  <span className="amt">{inr(x.pending)}</span>
                </button>
              );
            })}
          </div>
        )}
        {earlier.length > 6 && (
          <button type="button" className="pc-more" onClick={() => setShowAll(s => !s)}>
            {showAll ? "Show fewer" : `Show all ${earlier.length}`}
          </button>
        )}
      </section>

      {openId && (
        <ClientPanel
          lead={leadMap.get(String(openId))}
          items={items.filter(i => String(i.leadId) === String(openId))}
          services={services.filter(s => String(s.lead?._id || s.lead) === String(openId))}
          extras={extras.filter(x => String(x.lead?._id || x.lead) === String(openId))}
          today={today}
          onClose={() => setOpenId(null)}
          onRecord={(item) => {
            if (item.kind === "project") { setOpenId(null); onRecordProject(item.lead); }
            else setPaying(item);
          }}
        />
      )}

      {paying && (
        <PaymentModal
          kind={paying.kind} item={paying.kind === "extra" ? paying.extra : paying.service}
          period={paying.period} suggested={paying.balance}
          onSaved={() => { toast.success("Calendar updated"); load(); }}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function ClientPanel({ lead, items, services, extras, today, onClose, onRecord }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Projected (future) months aren't owed yet — keep them out of the totals
  const real    = items.filter(i => !i.projected);
  const total   = real.reduce((s, i) => s + i.amount, 0);
  const got     = real.reduce((s, i) => s + i.paid, 0);
  const open    = real.filter(i => i.balance > 0).sort((a, b) => a.due - b.due);
  const pending = open.reduce((s, i) => s + i.balance, 0);
  const late    = open.some(i => i.due < today);
  const next    = items.filter(i => i.balance > 0).sort((a, b) => a.due - b.due)[0];
  const monthly = services.filter(s => s.active).reduce((s, x) => s + x.monthlyTotal, 0);
  const state   = pending <= 0 ? "paid" : late ? "late" : "up";

  const history = [
    ...services.flatMap(s => (s.payments || []).filter(p => !p.waived).map(p => ({ date: toDay(p.date), amount: p.amount, mode: p.mode, t: `${s.name} · ${monthLabel(p.period)}` }))),
    ...extras.flatMap(x => (x.payments || []).map(p => ({ date: toDay(p.date), amount: p.amount, mode: p.mode, t: `Extra · ${x.title}` }))),
    ...(lead && Number(lead.advanceReceived) > 0
      ? [{ date: toDay(lead.advanceReceivedDate), amount: Number(lead.advanceReceived), mode: "Project", t: "Project payments received (total)" }]
      : []),
  ].sort((a, b) => (b.date || 0) - (a.date || 0));

  const remind = () => {
    const phone = String(lead?.phone || "").replace(/\D/g, "");
    const to = phone.length === 10 ? `91${phone}` : phone;
    const msg = `Dear ${lead?.name || "Sir/Madam"},\n\nA gentle reminder from Nakshatra Namaha Creations: ${inr(pending)} is pending on your account. Kindly arrange the payment at the earliest. Please ignore if already paid.\n\nThank you,\nAccounts, NNC\n+91 99005 66466`;
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  return (
    <>
      <div className="pc-scrim" onClick={onClose} />
      <aside className="pc-panel" aria-label="Client payments">
        <div className="pc-p-top">
          <div>
            <h2>{lead?.name || "Client"}</h2>
            <p>{[lead?.business, lead?.phone].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" className="pc-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="pc-p-body">
          <div className={`pc-due ${state}`}>
            <span className="t">
              {pending <= 0
                ? (next ? `Nothing pending · next due ${fd(next.due)}` : "Nothing pending")
                : late ? `Pending, oldest due ${fd(open[0].due)}` : `Next due on ${fd(open[0].due)}`}
            </span>
            <span className="v">{pending <= 0 ? "All paid" : inr(pending)}</span>
            {pending > 0 && (
              <div className="pc-acts">
                <button type="button" className="pc-btn" onClick={remind}>Remind on WhatsApp</button>
              </div>
            )}
          </div>

          {open.length > 0 && (
            <div>
              <h3>Pending</h3>
              <div className="pc-hist">
                {open.map(i => (
                  <div key={i.key}>
                    <span>{i.title}<br />due {fd(i.due)} · {inr(i.paid)} of {inr(i.amount)} paid</span>
                    <span className="pc-hist-r">
                      <b>{inr(i.balance)}</b>
                      <button type="button" className="pc-btn main sm" onClick={() => onRecord(i)}>Mark paid</button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pc-three">
            <div><span>Total business</span><b>{inr(total)}</b></div>
            <div><span>Received</span><b>{inr(got)}</b></div>
            <div><span>{services.length ? "Monthly" : "Jobs"}</span><b>{services.length ? inr(monthly) : real.length}</b></div>
          </div>

          {services.length > 0 && (
            <div>
              <h3>Services</h3>
              <div className="pc-hist">
                {services.map(s => (
                  <div key={s._id}>
                    <span>{s.name} · every month on the {ordinal(s.billingDay)}{s.active ? "" : " (stopped)"}</span>
                    <b>{inr(s.monthlyTotal)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3>Payment history</h3>
            <div className="pc-hist">
              {history.length === 0
                ? <div><span>No payments yet</span></div>
                : history.map((p, idx) => (
                  <div key={idx}><span>{fd(p.date)} · {p.mode}<br />{p.t}</span><b>{inr(p.amount)}</b></div>
                ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
