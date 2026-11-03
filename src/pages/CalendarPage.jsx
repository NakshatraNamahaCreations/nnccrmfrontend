import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import Sidebar from "../components/Sidebar/Sidebar";
import LeadDrawer from "../Leads/LeadDrawer";
import { toast } from "../utils/toast";
import { billingApi, API } from "./ProjectBilling/billingMeta";
import "./CalendarPage.css";

/* ───────── helpers ───────── */
const DAY = 864e5;
const iso = (d) => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const T = (n) => iso(Date.now() + n * DAY);
const dd = (s) => Math.round((parse(s) - parse(T(0))) / DAY);
const fd = (s) => parse(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fdl = (s) => parse(s).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fds = (s) => parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const toMin = (s) => { const [h, m] = String(s || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const toHM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const ampm = (s) => { let [h, m] = String(s).split(":").map(Number); const p = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""} ${p}`; };
const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes();
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const waPhone = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };
const href = (link) => (/^https?:\/\//.test(link) ? link : `https://${link}`);

/* CRM calendar entry types → the design's types. Timed = has a start time. */
const TYPES = {
  call_followup:    { k: "meet", n: "Call / Meeting",    c: "var(--meet)", timed: true },
  demo:             { k: "demo", n: "Demo",              c: "var(--demo)", timed: true },
  payment_followup: { k: "pay",  n: "Payment follow-up", c: "var(--pay)",  timed: false },
  client_response:  { k: "resp", n: "Client response",   c: "var(--resp)", timed: false },
  enquiry_followup: { k: "enq",  n: "Enquiry follow-up", c: "var(--enq)",  timed: false },
  block:            { k: "blk",  n: "Blocked",           c: "var(--blk)",  timed: true },
};
const SHORT = { payment_followup: "Pay", client_response: "Resp", enquiry_followup: "Enq", call_followup: "Call", demo: "Demo" };
const MODES = { meet: "Google Meet", office: "Office meeting", phone: "Phone call" };
const OUTCOMES = ["", "Interested, send proposal", "Proposal agreed", "Go-live agreed", "Payment promised", "Follow-up needed", "Not interested"];
const SET0 = { start: "10:00", end: "19:00", days: [1, 2, 3, 4, 5, 6], buffer: 15, remind: 30, office: "" };
const H0 = 8, H1 = 21, PX = 60;

// An entry sits in the time grid only when it has a start time
const isTimed = (e) => !!e.time;
const isMeeting = (e) => ["call_followup", "demo"].includes(e.type) && isTimed(e);
const isDone = (e) => e.done || e.status === "done";
const who = (e) => e.leadName || e.title || "Entry";
const cls = (e) => `t-${TYPES[e.type]?.k || "meet"}${isDone(e) ? " t-done" : ""}`;

function weekDays(anchor) {
  const d = parse(anchor), off = (d.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => iso(d.getTime() + (i - off) * DAY));
}
function monthDays(anchor) {
  const a = parse(anchor), f = new Date(a.getFullYear(), a.getMonth(), 1), lead = (f.getDay() + 6) % 7, out = [];
  for (let i = -lead; out.length < 42; i++) { const d = new Date(a.getFullYear(), a.getMonth(), 1 + i); out.push({ d: iso(d), inM: d.getMonth() === a.getMonth() }); }
  if (!out.slice(35).some(x => x.inM)) out.length = 35;
  return out;
}
// Side-by-side columns for overlapping meetings
function layout(L) {
  const out = [], groups = [];
  L.forEach(e => {
    const s = toMin(e.time), en = s + (e.duration || 30);
    let g = groups.find(g => g.some(x => s < x.en && en > x.s));
    if (!g) { g = []; groups.push(g); }
    g.push({ e, s, en });
  });
  groups.forEach(g => {
    const cols = [];
    g.forEach(x => { let c = cols.findIndex(col => col.every(y => x.s >= y.en || x.en <= y.s)); if (c < 0) { c = cols.length; cols.push([]); } cols[c].push(x); x.c = c; });
    g.forEach(x => out.push({ e: x.e, l: x.c / cols.length, w: 1 / cols.length }));
  });
  return out;
}
async function fetchAll(path) {
  const all = [];
  for (let p = 1; p < 30; p++) {
    const json = await billingApi(`${path}${path.includes("?") ? "&" : "?"}limit=200&page=${p}`);
    const rows = json.data || [];
    all.push(...rows);
    const pages = json.pages || (json.total ? Math.ceil(json.total / 200) : 1);
    if (p >= pages || rows.length < 200) break;
  }
  return all;
}

/* ───────── page ───────── */
export default function CalendarPage() {
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(T(0));
  const [sel, setSel] = useState(T(0));
  const [on, setOn] = useState(() => new Set(Object.keys(TYPES)));
  const [events, setEvents] = useState([]);
  const [set, setSet] = useState(SET0);
  const [clients, setClients] = useState(null);
  const [modal, setModal] = useState(null); // { kind: "new", pre } | { kind: "open", e } | { kind: "settings" }
  const [drawerLead, setDrawerLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const wkRef = useRef(null);
  const scrolled = useRef(false);

  const days = useMemo(() => (view === "month" ? monthDays(anchor).map(x => x.d) : view === "week" ? weekDays(anchor) : [anchor]), [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = iso(Math.min(parse(days[0]).getTime(), Date.now() - 30 * DAY));
      const to = iso(parse(days[days.length - 1]).getTime() + DAY);
      const [range, pend] = await Promise.all([
        billingApi(`/calendar-events?from=${from}&to=${to}`),
        billingApi("/calendar-events?pending=1").catch(() => ({ list: [] })),
      ]);
      const m = new Map();
      for (const e of [...(range.list || []), ...(pend.list || [])]) m.set(e._id, { ...e, day: iso(e.date) });
      setEvents([...m.values()]);
    } catch (err) { toast.error(err.message || "Could not load the calendar"); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    billingApi("/sales-desk/settings").then(j => setSet({ ...SET0, ...(j.data?.calendar || {}) })).catch(() => {});
  }, []);
  // Clients for the "Schedule" form: leads and open enquiries
  const loadClients = useCallback(async () => {
    if (clients) return;
    try {
      const [L, E] = await Promise.all([fetchAll("/leads"), fetchAll("/enquiries").catch(() => [])]);
      setClients([
        ...L.map(l => ({ id: l._id, src: "lead", name: l.name, phone: l.phone || l.mobile || "", company: l.business || l.company || "", email: l.email || "" })),
        ...E.filter(e => !e.convertedToLead).map(e => ({ id: e._id, src: "enq", name: e.name, phone: e.phone || "", company: e.company || "", email: e.email || "" })),
      ]);
    } catch { setClients([]); }
  }, [clients]);

  // Scroll the time grid to "now" once
  useEffect(() => {
    if (view === "month" || scrolled.current || !wkRef.current) return;
    wkRef.current.scrollTop = Math.max(0, (Math.min(nowMin(), 17 * 60) / 60 - H0) * PX);
    scrolled.current = true;
  });

  const vis = (e) => on.has(e.type) && e.status !== "cancelled";
  const onDay = (d) => events.filter(e => e.day === d && vis(e));
  const timedOn = (d) => onDay(d).filter(isTimed).sort((a, b) => toMin(a.time) - toMin(b.time));
  const tasksOn = (d) => onDay(d).filter(e => !isTimed(e));
  const needSummary = events.filter(e => isMeeting(e) && !["cancelled", "noshow"].includes(e.status) && !e.summary &&
    (dd(e.day) < 0 || (dd(e.day) === 0 && toMin(e.time) + (e.duration || 30) <= nowMin())));
  const overdue = events.filter(e => !isTimed(e) && !isDone(e) && e.status !== "cancelled" && dd(e.day) < 0).sort((a, b) => a.day.localeCompare(b.day));

  const nav = (v) => {
    const d = parse(anchor);
    if (view === "month") d.setMonth(d.getMonth() + v, 1); else d.setDate(d.getDate() + v * (view === "week" ? 7 : 1));
    setAnchor(iso(d));
    if (view === "day") setSel(iso(d));
  };
  const title = view === "month" ? parse(anchor).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : view === "day" ? fdl(anchor) : `${fds(days[0])} to ${fds(days[6])} ${parse(days[6]).getFullYear()}`;
  const inView = view === "month" ? monthDays(anchor).filter(x => x.inM).map(x => x.d) : days;

  const openNew = (pre) => { loadClients(); setModal({ kind: "new", pre }); };
  const openEv = (e) => setModal({ kind: "open", e });
  const saved = (msg, date) => { setModal(null); if (msg) toast.success(msg); if (date) setSel(date); load(); };

  return (
    <div className="cal-layout">
      <Sidebar />
      <div className="cal2">
        <header className="hd">
          <h1><CalendarDays size={22} color="#2563EB" /> Calendar</h1>
          <span className="sp" />
          <button type="button" className="btn" onClick={() => openNew({ type: "block", time: "15:00", duration: 60 })}>Block time</button>
          <button type="button" className="btn" onClick={() => setModal({ kind: "settings" })}>Settings</button>
          <button type="button" className="btn pri" onClick={() => openNew()}>+ Schedule</button>
        </header>

        <NextBar events={events} remind={set.remind} onOpen={openEv} />

        <div className="bar">
          <button type="button" className="btn ic" onClick={() => nav(-1)} aria-label="Previous">‹</button>
          <button type="button" className="btn ic" onClick={() => nav(1)} aria-label="Next">›</button>
          <button type="button" className="btn" onClick={() => { setAnchor(T(0)); setSel(T(0)); scrolled.current = false; }}>Today</button>
          <span className="mt">{title}{loading ? " …" : ""}</span>
          <div className="seg" role="group" aria-label="View">
            {["day", "week", "month"].map(v => (
              <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => { setView(v); setAnchor(sel); scrolled.current = false; }}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <div className="chips">
            {Object.entries(TYPES).map(([k, t]) => {
              const n = events.filter(e => e.type === k && inView.includes(e.day) && e.status !== "cancelled").length;
              return (
                <button key={k} type="button" className={`chip${on.has(k) ? " on" : ""}`} aria-pressed={on.has(k)}
                  onClick={() => setOn(s => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; })}>
                  <i style={{ background: t.c }} />{t.n}<em>{n}</em>
                </button>
              );
            })}
            {view === "month" && <span className="note" style={{ alignSelf: "center" }}>Blocked time shows in Week and Day</span>}
          </div>
        </div>

        <div className="body">
          <section className="main">
            {view === "month"
              ? <MonthView anchor={anchor} sel={sel} onDay={onDay} onPick={setSel} onOpen={openEv} />
              : <TimeView days={days} wkRef={wkRef} set={set} timedOn={timedOn} tasksOn={tasksOn} onOpen={openEv}
                  onSlot={(d, start) => { setSel(d); openNew({ date: d, time: start }); }} />}
          </section>
          <aside className="side">
            <DayCard d={sel} timed={timedOn(sel).filter(e => e.type !== "block")} tasks={tasksOn(sel)} onOpen={openEv} onAdd={() => openNew({ date: sel })} />
            {needSummary.length > 0 && (
              <div className="card"><h3><span>Add meeting summary</span><small>{needSummary.length}</small></h3>
                {needSummary.slice(0, 5).map(e => (
                  <button key={e._id} type="button" className="it" onClick={() => openEv(e)}>
                    <span className="dot" style={{ background: "var(--pay)" }} /><span className="tm">{fds(e.day)}</span>
                    <span><b>{who(e)}</b><small>{e.title}</small></span>
                  </button>
                ))}
              </div>
            )}
            {overdue.length > 0 && (
              <div className="card"><h3><span>Overdue follow-ups</span><small>{overdue.length}</small></h3>
                {overdue.slice(0, 6).map(e => <Item key={e._id} e={e} onOpen={openEv} late />)}
              </div>
            )}
          </aside>
        </div>
        <p className="note" style={{ marginTop: 16 }}>Live CRM calendar. Entries added from Leads, Enquiries and All Leads show here too.</p>
      </div>

      {modal?.kind === "new" && (
        <NewForm pre={modal.pre} sel={sel} clients={clients} events={events}
          onClose={() => setModal(null)} onSaved={saved} />
      )}
      {modal?.kind === "open" && (
        <EventModal e={modal.e} onClose={() => setModal(null)} onSaved={saved}
          onTurnIntoCall={(e) => openNew({ type: "call_followup", date: e.day, client: e, mode: "phone", duration: 15 })}
          onOpenLead={(id) => { setModal(null); setDrawerLead(id); }} />
      )}
      {modal?.kind === "settings" && (
        <SettingsModal set={set} onClose={() => setModal(null)}
          onSaved={(c) => { setSet({ ...SET0, ...c }); setModal(null); toast.success("Saved"); }} />
      )}
      <LeadDrawer open={!!drawerLead} leadId={drawerLead} apiBase={API} onClose={() => setDrawerLead(null)} />
    </div>
  );
}

/* ───────── pieces ───────── */
function NextBar({ events, remind, onOpen }) {
  const nm = nowMin();
  const L = events.filter(e => e.day === T(0) && isMeeting(e) && (!e.status || e.status === "scheduled") && toMin(e.time) + (e.duration || 30) > nm)
    .sort((a, b) => toMin(a.time) - toMin(b.time));
  if (!L.length) return null;
  const e = L[0], mins = toMin(e.time) - nm, soon = mins <= remind;
  return (
    <div className={`next${soon ? " soon" : ""}`}>
      <span className={`pill ${soon ? "red" : "blue"}`}>{mins <= 0 ? "Happening now" : soon ? `In ${mins} min` : "Next today"}</span>
      <span className="t"><b>{ampm(e.time)} · {who(e)}</b> · {MODES[e.mode] || TYPES[e.type].n} · {e.title}</span>
      {e.link && <a className="btn sm pri" href={href(e.link)} target="_blank" rel="noopener noreferrer">Join Meet</a>}
      <button type="button" className="btn sm" onClick={() => onOpen(e)}>Details</button>
      <span className="note">{L.length > 1 ? `${L.length - 1} more today · ` : ""}Reminder {remind} min before</span>
    </div>
  );
}

function Chip({ e, onOpen }) {
  return (
    <button type="button" className={`mi ${cls(e)}`} title={`${who(e)}${e.title ? `: ${e.title}` : ""}`}
      onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}>
      <b>{isTimed(e) ? ampm(e.time) : SHORT[e.type] || "Task"}</b><span>{who(e)}</span>
    </button>
  );
}

function MonthView({ anchor, sel, onDay, onPick, onOpen }) {
  const D = monthDays(anchor);
  return (
    <div className="mg">
      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => <div key={d} className="dow">{d}</div>)}
      {D.map(({ d, inM }) => {
        const L = onDay(d).filter(e => e.type !== "block").sort((a, b) => (isTimed(a) ? toMin(a.time) : 9999) - (isTimed(b) ? toMin(b.time) : 9999));
        const max = 4;
        return (
          <div key={d} className={`cell${inM ? "" : " out"}${d === T(0) ? " td" : ""}${d === sel ? " sel" : ""}`} role="button" tabIndex={0}
            onClick={() => onPick(d)} onKeyDown={(e) => e.key === "Enter" && onPick(d)} aria-label={`${fdl(d)}, ${L.length} items`}>
            <span className="dn">{parse(d).getDate()}</span>
            {L.slice(0, max).map(e => <Chip key={e._id} e={e} onOpen={onOpen} />)}
            {L.length > max && <span className="more">+{L.length - max} more</span>}
          </div>
        );
      })}
    </div>
  );
}

function TimeView({ days, wkRef, set, timedOn, tasksOn, onOpen, onSlot }) {
  const cols = `56px repeat(${days.length},minmax(${days.length > 1 ? 110 : 300}px,1fr))`;
  const nowTop = (nowMin() / 60 - H0) * PX;
  const ws = (toMin(set.start) / 60 - H0) * PX, we = (toMin(set.end) / 60 - H0) * PX;
  return (
    <div className="wk" ref={wkRef}>
      <div className="wh" style={{ gridTemplateColumns: cols }}><div />
        {days.map(d => (
          <div key={d} className={d === T(0) ? "td" : ""}>{parse(d).toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase()}<b>{parse(d).getDate()}</b></div>
        ))}
      </div>
      <div className="wfu" style={{ gridTemplateColumns: cols }}><div className="lab">Follow-ups</div>
        {days.map(d => <div key={d}>{tasksOn(d).map(e => <Chip key={e._id} e={e} onOpen={onOpen} />)}{!tasksOn(d).length && <span style={{ height: 20 }} />}</div>)}
      </div>
      <div className="wb" style={{ gridTemplateColumns: cols }}>
        <div>{Array.from({ length: H1 - H0 }, (_, i) => <div key={i} className="hr" style={{ height: PX }}>{i ? ampm(toHM((H0 + i) * 60)) : ""}</div>)}</div>
        {days.map(d => {
          const off = !set.days.includes(parse(d).getDay());
          const bg = `repeating-linear-gradient(transparent 0 ${PX - 1}px,var(--line) ${PX - 1}px ${PX}px)${off ? "" : `,linear-gradient(#FAFBFD 0 ${ws}px,transparent ${ws}px ${we}px,#FAFBFD ${we}px)`}`;
          return (
            <div key={d} className={`col${off ? " off" : ""}`} style={{ height: (H1 - H0) * PX, backgroundImage: bg }}
              onClick={(ev) => {
                if (ev.target.closest(".ev")) return;
                const r = ev.currentTarget.getBoundingClientRect();
                const m = Math.floor((((ev.clientY - r.top) / PX) * 60 + H0 * 60) / 30) * 30;
                onSlot(d, toHM(Math.max(H0 * 60, m)));
              }}>
              {layout(timedOn(d)).map(({ e, l, w }) => {
                const top = (toMin(e.time) / 60 - H0) * PX, dur = e.duration || 30, h = Math.max(20, (dur / 60) * PX - 2);
                const style = { top, height: h, left: `calc(${l * 100}% + 3px)`, right: "auto", width: `calc(${w * 100}% - 6px)` };
                const click = (ev) => { ev.stopPropagation(); onOpen(e); };
                if (e.type === "block") return (
                  <button key={e._id} type="button" className="ev t-blk" style={style} onClick={click}>
                    <b>{e.title || "Blocked"}</b>{h > 36 && <span>{ampm(e.time)} to {ampm(toHM(toMin(e.time) + dur))}</span>}
                  </button>
                );
                return h < 40 ? (
                  <button key={e._id} type="button" className={`ev row1 ${cls(e)}`} style={style} onClick={click}>
                    <span style={{ opacity: 1, fontWeight: 600 }}>{ampm(e.time)}</span><b style={{ fontWeight: 500 }}>{who(e)}</b>
                  </button>
                ) : (
                  <button key={e._id} type="button" className={`ev ${cls(e)}`} style={style} onClick={click}>
                    <b>{who(e)}</b><span>{ampm(e.time)}{e.mode ? ` · ${MODES[e.mode]}` : ""}</span>{h > 60 && <span>{e.title}</span>}
                  </button>
                );
              })}
              {d === T(0) && nowTop > 0 && nowTop < (H1 - H0) * PX && <div className="now" style={{ top: nowTop }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Item({ e, onOpen, late }) {
  const t = TYPES[e.type];
  return (
    <button type="button" className="it" onClick={() => onOpen(e)}>
      <span className="dot" style={{ background: t.c }} />
      <span className="tm">{isTimed(e) ? ampm(e.time) : late ? fds(e.day) : t.n.split(" ")[0]}</span>
      <span style={{ minWidth: 0 }}>
        <b className={isDone(e) ? "t-done" : ""}>{who(e)}</b>
        <small>{isTimed(e) ? `${MODES[e.mode] || t.n} · ${e.duration || 30} min · ${e.title}` : [e.title, e.notes].filter(Boolean).join(" · ")}</small>
      </span>
    </button>
  );
}

function DayCard({ d, timed, tasks, onOpen, onAdd }) {
  return (
    <div className="card">
      <h3><span>{d === T(0) ? "Today" : fd(d)}<small style={{ display: "block" }}>{timed.length} meeting{timed.length === 1 ? "" : "s"} · {tasks.length} follow-up{tasks.length === 1 ? "" : "s"}</small></span>
        <button type="button" className="btn sm pri" onClick={onAdd}>+ Add</button></h3>
      {timed.length || tasks.length
        ? [...timed, ...tasks].map(e => <Item key={e._id} e={e} onOpen={onOpen} />)
        : <div className="empty">Nothing on this day.<br /><button type="button" className="btn sm" onClick={onAdd} style={{ marginTop: 8 }}>Schedule one</button></div>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true">
        <div className="m-h"><h3>{title}</h3><button type="button" className="btn ic" onClick={onClose} aria-label="Close" style={{ width: 36, height: 36 }}><X size={16} /></button></div>
        {children}
      </div>
    </>
  );
}

/* ───────── new entry ───────── */
function NewForm({ pre, sel, clients, events, onClose, onSaved }) {
  const p = { type: "call_followup", date: sel, time: "11:00", duration: 30, mode: "meet", ...(pre || {}) };
  const [type, setType] = useState(p.type);
  const [f, setF] = useState({ date: p.date, time: p.time, duration: p.duration, mode: p.mode, title: "", notes: "", email: "", link: "", amount: "", name: p.client ? who(p.client) : "", phone: p.client?.leadPhone || "" });
  const [clientId, setClientId] = useState(p.client ? String(p.client.leadId || p.client.enquiryId || "") : "");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  const t = TYPES[type];
  const meeting = ["call_followup", "demo"].includes(type);
  const upd = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const client = (clients || []).find(c => c.id === clientId) || null;
  const options = useMemo(() => {
    const s = find.trim().toLowerCase();
    return (clients || []).filter(c => !s || [c.name, c.company, c.phone].some(v => String(v || "").toLowerCase().includes(s))).slice(0, 150);
  }, [clients, find]);
  const clash = t.timed && f.time ? events.find(e => e.day === f.date && isTimed(e) && e.status !== "cancelled" &&
    toMin(f.time) < toMin(e.time) + (e.duration || 30) && toMin(f.time) + Number(f.duration) > toMin(e.time)) : null;

  const submit = async (ev) => {
    ev.preventDefault();
    if (type !== "block" && !client && !f.name.trim()) { toast.error("Pick a client or type a name"); return; }
    setBusy(true);
    try {
      const body = {
        type, date: f.date, title: type === "block" ? (f.title.trim() || "Blocked") : f.title.trim(), notes: f.notes.trim(),
        ...(t.timed ? { time: f.time, duration: Number(f.duration) || 30 } : { amount: Number(f.amount) || 0 }),
        ...(meeting ? { mode: f.mode, email: f.email.trim() || client?.email || "", link: f.link.trim() } : {}),
        ...(client ? (client.src === "lead" ? { leadId: client.id } : { enquiryId: client.id }) : type === "block" ? {} : { leadName: f.name.trim(), leadPhone: f.phone.trim() }),
      };
      await billingApi("/calendar-events", { method: "POST", body });
      onSaved(meeting ? `Scheduled for ${fd(f.date)}, ${ampm(f.time)}` : type === "block" ? "Time blocked" : "Follow-up added", f.date);
    } catch (err) { toast.error(err.message || "Could not save"); setBusy(false); }
  };

  return (
    <Modal title="Schedule" onClose={onClose}>
      <form className="m-b" onSubmit={submit}>
        <div className="types" role="group" aria-label="Type">
          {Object.entries(TYPES).map(([k, x]) => (
            <button key={k} type="button" className={type === k ? "on" : ""} onClick={() => setType(k)}><i style={{ background: x.c }} />{x.n}</button>
          ))}
        </div>
        {type === "block" ? (
          <div className="f"><label htmlFor="n1">Label (only you see this)</label><input id="n1" value={f.title} onChange={upd("title")} placeholder="Eg. Lunch, Team review" /></div>
        ) : (
          <div className="f"><label>Client</label>
            {clients == null ? <div className="note">Loading clients…</div> : (
              <>
                <input value={find} onChange={e => setFind(e.target.value)} placeholder="Search lead or enquiry by name, company or phone" />
                <select size={4} value={clientId} onChange={e => setClientId(e.target.value)} className="pick">
                  <option value="">Not in the CRM (type a name below)</option>
                  {options.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""} · {c.src === "lead" ? "Lead" : "Enquiry"}</option>)}
                </select>
              </>
            )}
            {!client && (
              <div className="g2" style={{ marginTop: 6 }}>
                <input value={f.name} onChange={upd("name")} placeholder="Client name" aria-label="Client name" />
                <input value={f.phone} onChange={upd("phone")} placeholder="Phone (10 digits)" inputMode="numeric" aria-label="Phone" />
              </div>
            )}
          </div>
        )}
        <div className={t.timed ? "g3" : "g2"}>
          <div className="f"><label htmlFor="n3">Date</label><input id="n3" type="date" value={f.date} onChange={upd("date")} required /></div>
          {t.timed ? (
            <>
              <div className="f"><label htmlFor="n4">Start</label><input id="n4" type="time" step="900" value={f.time} onChange={upd("time")} required /></div>
              <div className="f"><label htmlFor="n5">Minutes</label>
                <select id="n5" value={f.duration} onChange={upd("duration")}>{[15, 30, 45, 60, 90, 120, 240].map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            </>
          ) : (
            <div className="f"><label htmlFor="n6">Amount (optional)</label><input id="n6" type="number" value={f.amount} onChange={upd("amount")} placeholder="₹" /></div>
          )}
        </div>
        {meeting && (
          <>
            <div className="g2">
              <div className="f"><label htmlFor="n7">How</label>
                <select id="n7" value={f.mode} onChange={upd("mode")}>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="f"><label htmlFor="n8">Client email</label><input id="n8" type="email" value={f.email} onChange={upd("email")} placeholder={client?.email || "name@company.com"} /></div>
            </div>
            {f.mode === "meet" && <div className="f"><label htmlFor="n11">Google Meet link</label><input id="n11" value={f.link} onChange={upd("link")} placeholder="meet.google.com/…" /></div>}
            <div className="f"><label htmlFor="n9">Agenda</label><input id="n9" value={f.title} onChange={upd("title")} required placeholder="Eg. proposal walkthrough" /></div>
          </>
        )}
        {!meeting && type !== "block" && (
          <div className="f"><label htmlFor="n10">Note</label><input id="n10" value={f.title} onChange={upd("title")} required placeholder="What needs to happen" /></div>
        )}
        {clash && <p className="note" style={{ margin: 0, color: "var(--pay)" }}>Clashes with {who(clash)} at {ampm(clash.time)}.</p>}
        <div className="foot"><span />
          <span>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn pri" disabled={busy}>{meeting ? "Schedule" : type === "block" ? "Block this time" : "Add follow-up"}</button>
          </span>
        </div>
      </form>
    </Modal>
  );
}

/* ───────── open an entry ───────── */
function EventModal({ e, onClose, onSaved, onTurnIntoCall, onOpenLead }) {
  const t = TYPES[e.type] || TYPES.call_followup;
  const [note, setNote] = useState("");
  const [f, setF] = useState({ date: e.day, time: e.time || "11:00", duration: e.duration || 30, summary: e.summary || "", outcome: e.outcome || "", next: "" });
  const [busy, setBusy] = useState(false);
  const upd = (k) => (ev) => setF(s => ({ ...s, [k]: ev.target.value }));
  const put = (body) => billingApi(`/calendar-events/${e._id}`, { method: "PUT", body });
  const run = async (fn, msg, date) => {
    setBusy(true);
    try { await fn(); onSaved(msg, date); } catch (err) { toast.error(err.message || "Failed"); setBusy(false); }
  };
  const withNote = () => (note.trim() ? { notes: [e.notes, note.trim()].filter(Boolean).join(" · ") } : {});
  const remove = () => { if (window.confirm("Delete this calendar entry?")) run(() => billingApi(`/calendar-events/${e._id}`, { method: "DELETE" }), "Deleted"); };
  const leadBtn = e.leadId && <button type="button" className="btn" onClick={() => onOpenLead(e.leadId)}>Open lead</button>;
  const waBtn = e.leadPhone && <a className="btn wa" href={`https://wa.me/${waPhone(e.leadPhone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>;

  if (e.type === "block") return (
    <Modal title={`Blocked: ${e.title || "time"}`} onClose={onClose}>
      <div className="m-b">
        <div className="facts">
          <div><span>When</span><b>{fd(e.day)}, {ampm(e.time)} to {ampm(toHM(toMin(e.time) + (e.duration || 30)))}</b></div>
          <div><span>Created by</span><b>{e.createdBy || "-"}</b></div>
        </div>
        <div className="foot"><span /><span><button type="button" className="btn" onClick={remove} disabled={busy}>Remove block</button><button type="button" className="btn pri" onClick={onClose}>Done</button></span></div>
      </div>
    </Modal>
  );

  const head = <><span className="pill" style={{ background: t.c, color: "#fff", marginRight: 8 }}>{t.n}</span>{who(e)}</>;

  // Follow-ups (no time)
  if (!isTimed(e)) return (
    <Modal title={head} onClose={onClose}>
      <div className="m-b">
        <div className="facts">
          <div><span>Due</span><b>{fd(e.day)}{!isDone(e) && dd(e.day) < 0 ? ` · ${-dd(e.day)} days late` : ""}</b></div>
          {e.leadBusiness && <div><span>About</span><b>{e.leadBusiness}</b></div>}
          {e.leadPhone && <div><span>Phone</span><b>{e.leadPhone}</b></div>}
          {e.amount > 0 && <div><span>Amount</span><b>{inr(e.amount)}</b></div>}
          <div><span>Note</span><b>{[e.title, e.notes].filter(Boolean).join(" · ") || "-"}</b></div>
          <div><span>Status</span><b>{isDone(e) ? "Done" : "Open"}</b></div>
          {e.createdBy && <div><span>Added by</span><b>{e.createdBy}</b></div>}
        </div>
        <div className="f"><label htmlFor="fn">Outcome or note</label><textarea id="fn" rows={2} value={note} onChange={ev => setNote(ev.target.value)} placeholder="Eg. client said he will pay on 10th" /></div>
        <div className="foot">
          <span>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => put({ date: T(1), ...withNote() }), `Moved to ${fd(T(1))}`, T(1))}>Tomorrow</button>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => put({ date: T(3), ...withNote() }), `Moved to ${fd(T(3))}`, T(3))}>In 3 days</button>
            <button type="button" className="btn" onClick={() => onTurnIntoCall(e)}>Turn into a call</button>
          </span>
          <span>
            {leadBtn}{waBtn}
            {isDone(e)
              ? <button type="button" className="btn" disabled={busy} onClick={() => run(() => put({ done: false, status: "scheduled" }), "Reopened")}>Reopen</button>
              : <button type="button" className="btn pri" disabled={busy} onClick={() => run(() => put({ done: true, ...withNote() }), "Marked done")}>Mark done</button>}
          </span>
        </div>
        <button type="button" className="lnkbtn" onClick={remove}>Delete this entry</button>
      </div>
    </Modal>
  );

  // Meetings (timed)
  const dur = e.duration || 30;
  const past = dd(e.day) < 0 || (dd(e.day) === 0 && toMin(e.time) <= nowMin());
  const status = e.status || "scheduled";
  const saveMeeting = async (ev) => {
    ev.preventDefault();
    if (past || status === "done") {
      await run(async () => {
        await put({ summary: f.summary.trim(), outcome: f.outcome, ...(status === "noshow" ? {} : { status: "done", done: true }) });
        if (f.next) await billingApi("/calendar-events", { method: "POST", body: {
          ...(e.leadId ? { leadId: e.leadId } : e.enquiryId ? { enquiryId: e.enquiryId } : { leadName: e.leadName, leadPhone: e.leadPhone }),
          type: /Payment/.test(f.outcome) ? "payment_followup" : e.enquiryId ? "enquiry_followup" : "client_response",
          date: f.next, title: `After meeting on ${fds(e.day)}${f.outcome ? `: ${f.outcome}` : ""}`,
        } });
      }, `Summary saved${f.next ? `. Follow-up added on ${fds(f.next)}` : ""}`);
    } else {
      const moved = f.date !== e.day || f.time !== e.time || Number(f.duration) !== dur;
      await run(() => put({ date: f.date, time: f.time, duration: Number(f.duration) }), moved ? "Rescheduled" : "Saved", f.date);
    }
  };
  const setStatus = (s, msg, extra) => run(async () => {
    await put({ status: s, done: s !== "scheduled" });
    if (extra) await extra();
  }, msg);

  return (
    <Modal title={head} onClose={onClose}>
      <form className="m-b" onSubmit={saveMeeting}>
        <div className="facts">
          <div><span>When</span><b>{fd(e.day)}, {ampm(e.time)} to {ampm(toHM(toMin(e.time) + dur))}</b></div>
          <div><span>How</span><b>{MODES[e.mode] || "-"}{e.link ? <> · <a href={href(e.link)} target="_blank" rel="noopener noreferrer">{e.link}</a></> : null}</b></div>
          {e.leadBusiness && <div><span>About</span><b>{e.leadBusiness}</b></div>}
          <div><span>Agenda</span><b>{e.title || "-"}</b></div>
          {e.email && <div><span>Client email</span><b>{e.email}</b></div>}
          <div><span>Status</span><b>{{ scheduled: "Scheduled", done: "Done", noshow: "No-show", cancelled: "Cancelled" }[status]}</b></div>
        </div>
        {past || status === "done" ? (
          <>
            <div className="f"><label htmlFor="es">Meeting summary</label><textarea id="es" rows={4} value={f.summary} onChange={upd("summary")} placeholder="What was discussed, what was agreed, what the client will send" /></div>
            <div className="g2">
              <div className="f"><label htmlFor="eo">Outcome</label><select id="eo" value={f.outcome} onChange={upd("outcome")}>{OUTCOMES.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></div>
              <div className="f"><label htmlFor="en">Next follow-up (adds to calendar)</label><input id="en" type="date" value={f.next} onChange={upd("next")} /></div>
            </div>
          </>
        ) : (
          <div className="g3">
            <div className="f"><label htmlFor="rd">Reschedule date</label><input id="rd" type="date" value={f.date} onChange={upd("date")} /></div>
            <div className="f"><label htmlFor="rs">Start</label><input id="rs" type="time" step="900" value={f.time} onChange={upd("time")} /></div>
            <div className="f"><label htmlFor="ru">Minutes</label><select id="ru" value={f.duration} onChange={upd("duration")}>{[15, 30, 45, 60, 90].map(x => <option key={x} value={x}>{x}</option>)}</select></div>
          </div>
        )}
        <div className="foot">
          <span>
            {status === "scheduled" && <button type="button" className="btn" disabled={busy} onClick={() => setStatus("cancelled", "Meeting cancelled")}>Cancel meeting</button>}
            {status === "scheduled" && past && (
              <button type="button" className="btn" disabled={busy} onClick={() => setStatus("noshow", "Marked no-show. A follow-up was added for today.", () =>
                billingApi("/calendar-events", { method: "POST", body: {
                  ...(e.leadId ? { leadId: e.leadId } : e.enquiryId ? { enquiryId: e.enquiryId } : { leadName: e.leadName, leadPhone: e.leadPhone }),
                  type: "client_response", date: T(0), title: `Missed the meeting on ${fds(e.day)}. Reschedule.`,
                } }))}>No-show</button>
            )}
            <button type="button" className="btn" disabled={busy} onClick={remove}>Delete</button>
          </span>
          <span>
            {leadBtn}
            {e.link && !past && <a className="btn" href={href(e.link)} target="_blank" rel="noopener noreferrer">Join Meet</a>}
            <button type="submit" className="btn pri" disabled={busy}>{past || status === "done" ? "Save summary" : "Save"}</button>
          </span>
        </div>
      </form>
    </Modal>
  );
}

/* ───────── settings ───────── */
function SettingsModal({ set, onClose, onSaved }) {
  const [c, setC] = useState(set);
  const [busy, setBusy] = useState(false);
  const save = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    try {
      const json = await billingApi("/sales-desk/settings", { method: "PUT", body: { calendar: { ...c, buffer: Number(c.buffer), remind: Number(c.remind) } } });
      onSaved(json.data?.calendar || c);
    } catch (err) { toast.error(err.message || "Save failed"); setBusy(false); }
  };
  return (
    <Modal title="Calendar settings" onClose={onClose}>
      <form className="m-b" onSubmit={save}>
        <div className="g2">
          <div className="f"><label htmlFor="s1">Working hours from</label><input id="s1" type="time" value={c.start} onChange={e => setC({ ...c, start: e.target.value })} /></div>
          <div className="f"><label htmlFor="s2">Until</label><input id="s2" type="time" value={c.end} onChange={e => setC({ ...c, end: e.target.value })} /></div>
        </div>
        <div className="f"><label>Working days</label>
          <div className="chips">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <label key={d} className={`chip${c.days.includes(i) ? " on" : ""}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={c.days.includes(i)} style={{ margin: 0 }}
                  onChange={() => setC({ ...c, days: c.days.includes(i) ? c.days.filter(x => x !== i) : [...c.days, i] })} /> {d}
              </label>
            ))}
          </div>
        </div>
        <div className="g2">
          <div className="f"><label htmlFor="s3">Gap between meetings (min)</label><input id="s3" type="number" min="0" step="5" value={c.buffer} onChange={e => setC({ ...c, buffer: e.target.value })} /></div>
          <div className="f"><label htmlFor="s4">Show “next meeting” alert before (min)</label><input id="s4" type="number" min="5" step="5" value={c.remind} onChange={e => setC({ ...c, remind: e.target.value })} /></div>
        </div>
        <div className="f"><label htmlFor="s6">Office address</label><input id="s6" value={c.office} onChange={e => setC({ ...c, office: e.target.value })} placeholder="Shown on office meetings" /></div>
        <div className="foot"><span /><span><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={busy}>Save</button></span></div>
      </form>
    </Modal>
  );
}
