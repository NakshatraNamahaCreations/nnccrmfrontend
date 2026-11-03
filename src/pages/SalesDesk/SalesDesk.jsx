import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Mail, MessageCircle, Users, Briefcase, Inbox, BellRing, CircleDollarSign, Wallet, Repeat, Truck, Clock, Phone, X, Star, UserX, HandCoins, Bot,
} from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import { billingApi } from "../ProjectBilling/billingMeta";
import {
  KIND, DEFAULT_TPL, leadClient, enquiryClient, buildItems, fillTemplate, bankText, exportCsv,
  daysFrom, addDays, ymd, fds, fdw, inr, lakh, initials, waPhone, ampm, waCount,
} from "./deskData";
import CalendarView, { MeetingModal } from "./DeskCalendar";
import DeskActions from "./DeskActions";
import "./SalesDesk.css";
import "./DeskExtra.css";

const ICON = {
  new: MessageCircle, asked: BellRing, promise: HandCoins, advance: Wallet, pay: CircleDollarSign, monthly: Repeat,
  followup: Clock, delivery: Truck, uncontacted: UserX, quiet: Clock, review: Star,
};
const PER = 50;
const TEAM = ["Harish", "Nithin"];
const DEFAULT_SETTINGS = { rules: { maxAuto: 3, bigAmount: 100000, quietDays: 5, afterSend: 2, holdPause: true, reviewDays: 90 }, upi: "", reviewLink: "", bankAccountId: null, templates: {}, snoozes: [] };

async function fetchAll(path, pageSize = 200) {
  const all = [];
  for (let p = 1; p < 30; p++) {
    const json = await billingApi(`${path}${path.includes("?") ? "&" : "?"}limit=${pageSize}&page=${p}`);
    const rows = json.data || [];
    all.push(...rows);
    const pages = json.pages || (json.total ? Math.ceil(json.total / pageSize) : 1);
    if (p >= pages || rows.length < pageSize) break;
  }
  return all;
}

/* ───────── page ───────── */
export default function SalesDesk() {
  const [leads, setLeads] = useState([]);
  const [enqs, setEnqs] = useState([]);
  const [events, setEvents] = useState([]);
  const [services, setServices] = useState([]);
  const [banks, setBanks] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("today"); // today | queue | calendar | clients | templates | settings
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const [queue, setQueue] = useState("all");
  const [mode, setMode] = useState("human");
  const [sort, setSort] = useState("score");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(() => new Set());
  const [cf, setCf] = useState({ stage: "", money: "", src: "" });
  const [openId, setOpenId] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [openChannel, setOpenChannel] = useState("wa"); // "wa" | "mail"
  const [bulkMail, setBulkMail] = useState(null); // { rows, tpl }
  const [bulk, setBulk] = useState(null);      // { rows, tpl }
  const [meeting, setMeeting] = useState(null); // event (edit) or { clientId } (new)

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const from = ymd(Date.now() - 90 * 864e5), to = ymd(Date.now() + 120 * 864e5);
      const [L, E, pend, range, svc, bk, st] = await Promise.all([
        fetchAll("/leads"),
        fetchAll("/enquiries").catch(() => []),
        billingApi("/calendar-events?pending=1").catch(() => ({ list: [] })),
        billingApi(`/calendar-events?from=${from}&to=${to}`).catch(() => ({ list: [] })),
        billingApi("/recurring-services").catch(() => ({ data: [] })),
        billingApi("/payment-tracker/bank-accounts").catch(() => ({ data: [] })),
        billingApi("/sales-desk/settings").catch(() => ({ data: DEFAULT_SETTINGS })),
      ]);
      setLeads(L);
      setEnqs(E);
      const evMap = new Map();
      for (const ev of [...(pend.list || []), ...(range.list || [])]) evMap.set(ev._id, ev);
      setEvents([...evMap.values()]);
      setServices(svc.data || []);
      setBanks(bk.data || []);
      setSettings({ ...DEFAULT_SETTINGS, ...(st.data || {}), rules: { ...DEFAULT_SETTINGS.rules, ...(st.data?.rules || {}) } });
    } catch (err) { setError(err.message || "Could not load the desk"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const clients = useMemo(() => [
    ...leads.map(leadClient),
    ...enqs.filter(e => !e.convertedToLead).map(enquiryClient),
  ], [leads, enqs]);
  const items = useMemo(() => buildItems({ clients, events, services, settings }), [clients, events, services, settings]);
  const templates = useMemo(() => DEFAULT_TPL.map(t => {
    const o = settings.templates || {};
    return { ...t, text: o[t.id] || t.text, subject: o[`mailsub:${t.id}`] || t.subject, mail: o[`mail:${t.id}`] || t.mail };
  }), [settings]);
  const bank = useMemo(() => bankText(settings, banks), [settings, banks]);
  const tplCtx = useMemo(() => ({ bank, reviewLink: settings.reviewLink }), [bank, settings.reviewLink]);

  const owners = useMemo(() => {
    const n = {};
    for (const c of clients) n[c.owner] = (n[c.owner] || 0) + 1;
    return Object.keys(n).sort((a, b) => (a === "Unassigned") - (b === "Unassigned") || n[b] - n[a]);
  }, [clients]);
  // The sales team: only these two show as filters and in "Assign to"
  const teamNames = TEAM;

  const mine = useCallback((c) => who === "all" || c.owner === who, [who]);
  const matchQ = useCallback((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [c.name, c.company, c.phone, c.project, c.email].some(v => String(v || "").toLowerCase().includes(s));
  }, [q]);
  const myItems = useMemo(() => items.filter(x => mine(x.c) && matchQ(x.c)), [items, mine, matchQ]);
  const dueItems = myItems.filter(x => x.due <= 0);
  const weekItems = myItems.filter(x => x.due > 0);
  const meetingsToday = events
    .filter(e => (e.type === "demo" || e.time) && daysFrom(e.date) === 0 && (!e.status || e.status === "scheduled"))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));

  const openClient = clients.find(c => c.id === openId) || null;
  const openItem = openClient ? (items.find(x => x.key === openKey) || items.find(x => x.c.id === openId)) : null;
  const open = (c, key, channel) => { if (c.src === "event") { toast.info?.("This calendar entry is not linked to a lead"); return; } setOpenId(c.id); setOpenKey(key || null); setOpenChannel(channel === "mail" ? "mail" : "wa"); };

  const switchTab = (t) => { setTab(t); setPage(0); setSel(new Set()); setSort(t === "clients" ? "amt" : "score"); window.scrollTo(0, 0); };
  const goQueue = (k, m = "human") => { setQueue(k); setMode(m); setTab("queue"); setPage(0); setSel(new Set()); setSort("score"); window.scrollTo(0, 0); };

  /* ── actions (all write to the CRM) ── */
  const logWa = async (c, what) => {
    if (c.src === "lead") await billingApi(`/leads/${c.id}/comms`, { method: "POST", body: { type: "WhatsApp", summary: what } });
    else if (c.src === "enq") await billingApi(`/enquiries/${c.id}/activity`, { method: "POST", body: { action: "WhatsApp", note: what } });
  };
  // Email goes out from the CRM's mail account and is logged on the lead / enquiry
  const sendMail = async (c, subject, body) => {
    if (c.src === "lead") return billingApi(`/leads/${c.id}/send-email`, { method: "POST", body: { type: "custom", subject, body } });
    if (c.src === "enq") return billingApi(`/enquiries/${c.id}/send-email`, { method: "POST", body: { subject, body } });
    throw new Error("Not linked to a lead or enquiry");
  };
  const snooze = async (keys, until) => {
    const json = await billingApi("/sales-desk/snooze", { method: "POST", body: { keys, until } });
    setSettings(s => ({ ...s, snoozes: json.data?.snoozes || [] }));
  };
  // After a message, the item comes back in "afterSend" days if nothing changes
  const afterSent = async (rows) => { await snooze(rows.map(x => x.key), addDays(settings.rules.afterSend || 2)); };

  const markDone = async (rows) => {
    const rest = [];
    for (const x of rows) {
      try {
        if (x.eventId) await billingApi(`/calendar-events/${x.eventId}`, { method: "PUT", body: { done: true } });
        else if (x.enqFollow) await billingApi(`/enquiries/${x.c.id}/activity`, { method: "POST", body: { action: "Follow-up done", note: "From Sales Desk", followUpDate: null } });
        else if (x.leadFollow) await billingApi(`/leads/${x.c.id}/followup-done`, { method: "PATCH", body: { outcome: "Completed", notes: "From Sales Desk" } });
        else rest.push(x.key);
      } catch (err) { toast.error(`${x.c.name}: ${err.message}`); }
    }
    if (rest.length) await snooze(rest, addDays(7));
    toast.success(`${rows.length} marked done`);
    load();
  };
  const assign = async (cs, owner) => {
    let ok = 0;
    for (const c of cs) {
      try {
        if (c.src === "lead") await billingApi(`/leads/${c.id}`, { method: "PUT", body: { repName: owner } });
        else if (c.src === "enq") await billingApi(`/enquiries/${c.id}`, { method: "PUT", body: { assignedTo: owner } });
        else continue;
        ok++;
      } catch (err) { toast.error(`${c.name}: ${err.message}`); }
    }
    toast.success(`${ok} assigned to ${owner}`);
    load();
  };
  const saveSettings = async (patch) => {
    try {
      const json = await billingApi("/sales-desk/settings", { method: "PUT", body: patch });
      setSettings(s => ({ ...s, ...json.data, rules: { ...s.rules, ...(json.data?.rules || {}) } }));
      toast.success("Saved");
    } catch (err) { toast.error(err.message || "Save failed"); }
  };

  const needCount = items.filter(x => x.due <= 0 && x.human && mine(x.c)).length;
  const TABS = [["today", "Today"], ["calendar", "Calendar"], ["clients", "Clients"], ["templates", "Templates"], ["settings", "Automation"]];

  return (
    <div className="sd-layout">
      <Sidebar />
      <div className="sd">
        <header className="sd-top">
          <div className="sd-logo">All Leads<span>.</span></div>
          <nav className="sd-tabs" aria-label="All Leads">
            {TABS.map(([k, t]) => (
              <button key={k} type="button" className={(tab === k || (tab === "queue" && k === "today")) ? "on" : ""} onClick={() => switchTab(k)}>
                {t}
                {k === "today" && needCount > 0 && <em>{needCount}</em>}
                {k === "calendar" && meetingsToday.length > 0 && <em className="cal">{meetingsToday.length}</em>}
              </button>
            ))}
          </nav>
          <input className="sd-gsearch" type="search" value={q} aria-label="Search clients"
            onChange={e => { setQ(e.target.value); setPage(0); if (tab === "today" && e.target.value) setTab("clients"); }}
            placeholder={`Search ${clients.length.toLocaleString("en-IN")} clients by name, phone or project`} />
          <div className="sd-who" role="group" aria-label="Show work for">
            <button type="button" className={who === "all" ? "on" : ""} onClick={() => { setWho("all"); setPage(0); }}>Both</button>
            {TEAM.map(o => (
              <button key={o} type="button" className={who === o ? "on" : ""} onClick={() => { setWho(o); setPage(0); }}>{o}</button>
            ))}
          </div>
          <button type="button" className="sd-btn sm" onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshCw size={14} className={loading ? "sd-spin" : ""} />
          </button>
        </header>

        <main className="sd-wrap">
          {error && <div className="sd-error">{error}</div>}
          {loading && !clients.length ? <div className="sd-empty">Loading clients…</div> : (
            <>
              {tab === "today" && (
                <TodayView items={dueItems} week={weekItems} clients={clients.filter(mine)} who={who} settings={settings}
                  meetings={meetingsToday} clientsById={clients} goQueue={goQueue} open={open}
                  openMeeting={setMeeting} toCalendar={() => switchTab("calendar")}
                  onClients={(src) => { switchTab("clients"); setCf({ stage: "", money: "", src }); }} />
              )}
              {tab === "queue" && (
                <QueueView items={queue === "week" ? weekItems : dueItems.filter(x => queue === "all" || x.kind === queue)}
                  queue={queue} setQueue={(v) => { setQueue(v); setPage(0); setSel(new Set()); }}
                  mode={mode} setMode={(v) => { setMode(v); setPage(0); setSel(new Set()); }}
                  sort={sort} setSort={setSort} page={page} setPage={setPage} sel={sel} setSel={setSel}
                  settings={settings} templates={templates} teamNames={teamNames}
                  back={() => switchTab("today")} open={open}
                  onSend={(rows, tpl) => setBulk({ rows, tpl })}
                  onMail={(rows, tpl) => setBulkMail({ rows, tpl })}
                  onSnooze={async (rows) => { await snooze(rows.map(x => x.key), addDays(3)); setSel(new Set()); toast.success(`${rows.length} moved to ${fdw(addDays(3))}`); }}
                  onDone={async (rows) => { setSel(new Set()); await markDone(rows); }}
                  onAssign={async (rows, o) => { setSel(new Set()); await assign([...new Map(rows.map(x => [x.c.id, x.c])).values()], o); }} />
              )}
              {tab === "calendar" && (
                <CalendarView events={events} clients={clients} onOpen={setMeeting}
                  onNew={() => setMeeting({ new: true })} />
              )}
              {tab === "clients" && (
                <ClientsView clients={clients.filter(c => mine(c) && matchQ(c))} items={items} cf={cf} setCf={(v) => { setCf(v); setPage(0); }}
                  sort={sort} setSort={setSort} page={page} setPage={setPage} open={open} sel={sel} setSel={setSel}
                  teamNames={teamNames} templates={templates}
                  onSend={(rows, tpl) => setBulk({ rows, tpl })}
                  onMail={(rows, tpl) => setBulkMail({ rows, tpl })}
                  onAssign={async (cs, o) => { setSel(new Set()); await assign(cs, o); }} />
              )}
              {tab === "templates" && (
                <TemplatesView templates={templates} sample={clients.find(c => c.src === "lead") || clients[0]} ctx={tplCtx}
                  onSave={(patch) => saveSettings({ templates: patch })}
                  onReset={(keys) => saveSettings({ templates: Object.fromEntries(keys.map(k => [k, ""])) })} />
              )}
              {tab === "settings" && (
                <AutomationView settings={settings} banks={banks} owners={owners} clients={clients} items={items} onSave={saveSettings} />
              )}
              <p className="sd-note sd-foot">
                Live CRM data: {clients.filter(c => c.group === "project").length} projects, {clients.filter(c => c.group === "new").length} new leads,
                {" "}{events.length} calendar entries and {services.length} monthly service{services.length === 1 ? "" : "s"}.
              </p>
            </>
          )}
        </main>

        {openClient && (
          <ClientDrawer c={openClient} item={openItem} templates={templates} ctx={tplCtx} settings={settings} teamNames={teamNames}
            events={events.filter(e => String(e.leadId || "") === openClient.id || String(e.enquiryId || "") === openClient.id)}
            services={services.filter(s => String(s.lead?._id || s.lead) === openClient.id)}
            onClose={() => setOpenId(null)} onChanged={load}
            logWa={logWa} afterSent={afterSent} assign={assign} sendMail={sendMail} channel={openChannel}
            onMeeting={(ev) => setMeeting(ev || { new: true, clientId: openClient.id })} />
        )}

        {bulk && (
          <BulkSend rows={bulk.rows} tplId={bulk.tpl} templates={templates} ctx={tplCtx}
            onClose={() => { setBulk(null); setSel(new Set()); load(); }}
            onSent={async (x, tplName) => { await logWa(x.c, `WhatsApp sent: ${tplName}`); if (x.key) await afterSent([x]); }} />
        )}

        {bulkMail && (
          <BulkMail rows={bulkMail.rows} tplId={bulkMail.tpl} templates={templates} ctx={tplCtx}
            onClose={() => { setBulkMail(null); setSel(new Set()); load(); }}
            onSend={async (x, subject, body) => { await sendMail(x.c, subject, body); if (x.key) await afterSent([x]); }} />
        )}

        {meeting && (
          <MeetingModal ev={meeting.new ? null : meeting} presetClientId={meeting.clientId} clients={clients}
            onClose={() => setMeeting(null)}
            onSaved={() => { setMeeting(null); load(); }}
            onShare={(ev, c) => {
              const t = templates.find(x => x.id === "meet");
              const msg = fillTemplate(t.text, c, { ...tplCtx, meet: ev });
              window.open(`https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
              logWa(c, "WhatsApp sent: Meeting confirmation").catch(() => {});
            }} />
        )}
      </div>
    </div>
  );
}

/* ───────── Today ───────── */
function TodayView({ items, week, clients, who, settings, meetings, clientsById, goQueue, open, openMeeting, toCalendar, onClients }) {
  const h = new Date().getHours();
  const human = items.filter(x => x.human);
  const routine = items.filter(x => !x.human);
  const money = items.reduce((a, x) => a + (["pay", "advance", "monthly", "promise"].includes(x.kind) ? x.amt : 0), 0);
  const top = human.slice(0, 12);
  const R = settings.rules;
  const byId = new Map(clientsById.map(c => [c.id, c]));
  return (
    <>
      <h1 className="sd-h1">{h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}{who !== "all" && who !== "Unassigned" ? `, ${who}` : ""}<span>.</span></h1>
      <p className="sd-lead">
        {clients.length.toLocaleString("en-IN")} clients. <b>{items.length} follow-ups due today</b>, worth {lakh(money)} in payments.
        {" "}<b>{human.length} need a person</b>; {routine.length} are routine and can go out in one bulk send.
      </p>

      <div className="sd-auto">
        <span className="ic k-new big"><Bot size={20} /></span>
        <div><div className="big">{routine.length}</div><div className="sd-note">routine reminders ready</div></div>
        <div className="t">
          Routine reminders (balance and monthly dues, follow-ups, quiet clients, uncontacted leads, reviews) are grouped so you can send them together.
          A client goes to a person if it is a large amount ({inr(R.bigAmount)} or more), {R.maxAuto} reminders were already sent, or it needs a call.
          Automatic sending needs the WhatsApp Business API, which is not connected yet.
        </div>
        <button type="button" className="sd-btn" onClick={() => goQueue("all", "auto")}>Send routine reminders</button>
      </div>

      {meetings.length > 0 && (
        <>
          <div className="sd-sec"><h2>Meetings today</h2><span>{meetings.length} scheduled</span><span className="sp" />
            <button type="button" className="sd-btn" onClick={toCalendar}>Open calendar</button></div>
          <div className="sd-meetstrip">
            {meetings.map(m => {
              const c = byId.get(String(m.leadId || "")) || byId.get(String(m.enquiryId || ""));
              const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
              const [hh, mm] = String(m.time || "0:0").split(":").map(Number);
              const diff = m.time ? hh * 60 + mm - nowMin : null;
              const soon = diff != null && diff <= 30 && diff > -(m.duration || 30);
              return (
                <button key={m._id} type="button" className={`sd-meet${soon ? " soon" : ""}`} onClick={() => openMeeting(m)}>
                  <b>{ampm(m.time)} · {c?.name || m.leadName || m.title}</b>
                  <span className="sd-note">{{ meet: "Google Meet", office: "Office", phone: "Phone" }[m.mode] || "Meeting"} · {m.duration || 30} min</span>
                  <span>{m.title || m.notes}</span>
                  {soon && <span className="pill late">Starts in {Math.max(0, diff)} min</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="sd-sec"><h2>All clients</h2><span>Click to open the full list</span></div>
      <div className="sd-tiles sd-ctiles">
        {[
          { src: "", label: "All clients", Icon: Users, list: clients, cls: "k-all" },
          { src: "project", label: "Projects", Icon: Briefcase, list: clients.filter(c => c.group === "project"), cls: "k-lead" },
          { src: "new", label: "New leads", Icon: Inbox, list: clients.filter(c => c.group === "new"), cls: "k-new" },
        ].map(t => {
          const pending = t.list.reduce((a, c) => a + c.balance, 0);
          const open = t.list.filter(c => c.group === "new" ? !c.lost && c.enqStatus !== "won" : c.closed && !c.completed).length;
          return (
            <button key={t.label} type="button" className="sd-tile" onClick={() => onClients(t.src)}>
              <span className="h"><span className={`ic ${t.cls}`}><t.Icon size={16} /></span><b>{t.label}</b></span>
              <span className="n"><strong>{t.list.length.toLocaleString("en-IN")}</strong><span>{pending ? `${lakh(pending)} pending` : ""}</span></span>
              <span className="s">{t.src === "new" ? `${open} still open · convert to move to Projects` : t.src === "project" ? `${open} projects running` : `${t.list.filter(c => c.group === "project").length} projects · ${t.list.filter(c => c.group === "new").length} new leads`}</span>
            </button>
          );
        })}
      </div>

      <div className="sd-sec"><h2>Today by type</h2><span>Click to open the full list with bulk actions</span></div>
      <div className="sd-tiles">
        {Object.entries(KIND).map(([k, meta]) => {
          const L = items.filter(x => x.kind === k);
          const hN = L.filter(x => x.human).length;
          const amt = L.reduce((a, x) => a + x.amt, 0);
          const Icon = ICON[k];
          return (
            <button key={k} type="button" className="sd-tile" onClick={() => goQueue(k, hN ? "human" : "all")}>
              <span className="h"><span className={`ic k-${k}`}><Icon size={16} /></span><b>{meta.label}</b></span>
              <span className="n"><strong>{L.length}</strong><span>{amt ? lakh(amt) : ""}</span></span>
              <span className="s">{hN ? <><b>{hN} need you</b> · </> : null}{L.length - hN} routine</span>
            </button>
          );
        })}
      </div>

      <div className="sd-sec">
        <h2>Your top {top.length} for today</h2><span>Highest value and most urgent first</span><span className="sp" />
        <button type="button" className="sd-btn" onClick={() => goQueue("all", "human")}>See all {human.length} that need you</button>
      </div>
      <ItemTable rows={top} compact open={open} settings={settings} />

      <div className="sd-sec" style={{ marginTop: 22 }}>
        <h2>Coming up this week</h2><span>{week.length} scheduled</span><span className="sp" />
        <button type="button" className="sd-btn" onClick={() => goQueue("week", "all")}>Open</button>
      </div>
    </>
  );
}

/* ───────── Queue (full list + bulk actions) ───────── */
function QueueView({ items, queue, setQueue, mode, setMode, sort, setSort, page, setPage, sel, setSel, settings, templates, teamNames, back, open, onSend, onMail, onSnooze, onDone, onAssign }) {
  const so = { score: (a, b) => b.score - a.score, amt: (a, b) => b.amt - a.amt, age: (a, b) => new Date(a.date) - new Date(b.date), name: (a, b) => String(a.c.name).localeCompare(String(b.c.name)) }[sort];
  let W = items;
  if (mode === "human") W = W.filter(x => x.human); else if (mode === "auto") W = W.filter(x => !x.human);
  W = [...W].sort(so);
  const pages = Math.max(1, Math.ceil(W.length / PER));
  const pg = Math.min(page, pages - 1);
  const P = W.slice(pg * PER, pg * PER + PER);
  const total = W.reduce((a, x) => a + x.amt, 0);
  const title = queue === "week" ? "Coming up this week" : queue !== "all" ? KIND[queue].label : "All follow-ups due";
  const selected = W.filter(x => sel.has(x.key));
  const chip = (k, t) => <button type="button" className={`sd-chip${mode === k ? " on" : ""}`} onClick={() => setMode(k)}>{t}</button>;
  return (
    <>
      <div className="sd-sec">
        <button type="button" className="sd-btn sm" onClick={back}>‹ Today</button>
        <h2>{title}</h2><span>{W.length} clients{total ? ` · ${lakh(total)}` : ""}</span>
      </div>
      <div className="sd-filters">
        {chip("human", "Needs a person")}{chip("auto", "Routine")}{chip("all", "Both")}
        <span style={{ flex: 1 }} />
        <select value={queue} onChange={e => setQueue(e.target.value)} aria-label="Type">
          <option value="all">All types</option>
          {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          <option value="week">Coming up this week</option>
        </select>
      </div>
      <BulkBar count={selected.length} total={W.length} onAll={() => setSel(new Set(W.map(x => x.key)))} onClear={() => setSel(new Set())}
        templates={templates} teamNames={teamNames}
        onSend={(tpl) => onSend(selected, tpl)} onMail={(tpl) => onMail(selected, tpl)} onAssign={(o) => onAssign(selected, o)}
        onSnooze={() => onSnooze(selected)} onDone={() => onDone(selected)} onExport={() => exportCsv(selected, "sales-desk")} />
      <ItemTable rows={P} open={open} settings={settings} sort={sort} setSort={(k) => { setSort(k); setPage(0); }} sel={sel} setSel={setSel} />
      <Pager page={pg} pages={pages} count={W.length} setPage={setPage} />
    </>
  );
}

function BulkBar({ count, total, onAll, onClear, templates, teamNames, onSend, onMail, onAssign, onSnooze, onDone, onExport }) {
  const [tpl, setTpl] = useState("");
  if (!count) return null;
  return (
    <div className="sd-bulk">
      <b>{count} selected</b>
      {count < total && <button type="button" className="lnk" onClick={onAll}>Select all {total}</button>}
      <button type="button" className="lnk" onClick={onClear}>Clear</button>
      <span className="sp" />
      <select value={tpl} onChange={e => setTpl(e.target.value)} aria-label="Template">
        <option value="">Suggested for each client</option>
        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button type="button" className="sd-btn wa" onClick={() => onSend(tpl)}>Send WhatsApp to {count}</button>
      {onMail && <button type="button" className="sd-btn mail" onClick={() => onMail(tpl)}><Mail size={14} /> Email {count}</button>}
      <select value="" onChange={e => e.target.value && onAssign(e.target.value)} aria-label="Assign to">
        <option value="">Assign to</option>
        {teamNames.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {onSnooze && <button type="button" className="sd-btn" onClick={onSnooze}>Snooze 3 days</button>}
      {onDone && <button type="button" className="sd-btn" onClick={onDone}>Mark done</button>}
      <button type="button" className="sd-btn" onClick={onExport}>Export</button>
    </div>
  );
}

// Clicking anywhere on a row opens the client — except on its checkbox, buttons and links
const rowClick = (ev, fn) => { if (!ev.target.closest("input, button, a, select, label")) fn(); };

function Dots({ n, max }) {
  return (
    <span className="sd-dots" title={`${n} WhatsApp reminder${n === 1 ? "" : "s"} in the last 30 days`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
    </span>
  );
}

function ItemTable({ rows, compact, open, settings, sort, setSort, sel, setSel }) {
  const th = (k, t, cls = "") => (compact || !setSort)
    ? <th className={cls}>{t}</th>
    : <th className={cls}><button type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{t}{sort === k ? " ↓" : ""}</button></th>;
  const allChk = !compact && rows.length > 0 && rows.every(x => sel.has(x.key));
  const toggle = (key) => setSel(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const max = settings.rules.maxAuto || 3;
  return (
    <div className="sd-tbl"><div className="sd-tw"><table>
      <thead><tr>
        {compact ? <th /> : <th><input type="checkbox" checked={allChk} aria-label="Select page"
          onChange={e => setSel(s => { const n = new Set(s); rows.forEach(x => (e.target.checked ? n.add(x.key) : n.delete(x.key))); return n; })} /></th>}
        {th("name", "Client")}<th>Why</th>{th("amt", "Amount", "r")}{th("age", "Due")}<th>Handled by</th><th>Reminders sent</th><th className="r">Action</th>
      </tr></thead>
      <tbody>
        {rows.map(x => {
          const k = KIND[x.kind];
          const Icon = ICON[x.kind];
          const chk = !compact && sel.has(x.key);
          const callFirst = ["quiet", "delivery"].includes(x.kind) || x.sent >= max;
          return (
            <tr key={x.key} className={`sd-row${chk ? " sel" : ""}`} onClick={(ev) => rowClick(ev, () => open(x.c, x.key))}>
              <td>{compact
                ? <span className={`ic k-${x.kind}`}><Icon size={15} /></span>
                : <input type="checkbox" checked={chk} onChange={() => toggle(x.key)} aria-label={`Select ${x.c.name}`} />}</td>
              <td className="nm">
                <button type="button" className="link" onClick={() => open(x.c, x.key)}>{x.c.name}</button>
                <small>{[x.c.company, x.c.group === "new" ? "New lead" : null, x.c.project].filter(Boolean).join(" · ")}</small>
              </td>
              <td className="why"><span className={`pill ${k.pill}`}>{k.label}</span> {x.what}
                {x.human && x.whyHuman && <span className="sub">Needs you: {x.whyHuman}</span>}</td>
              <td className="r num">{x.amt ? inr(x.amt) : <span className="sub">-</span>}</td>
              <td style={{ whiteSpace: "nowrap" }}>{x.due < 0 ? <span className="pill late">{-x.due}d late</span> : x.due === 0 ? "Today" : fds(x.date)}</td>
              <td>{x.human ? <b className="sd-own">{x.c.owner}</b> : <span className="pill blue">Routine</span>}</td>
              <td><Dots n={x.sent} max={max} /></td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                {callFirst && x.c.phone && <><a className="sd-btn sm" href={`tel:${x.c.phone}`} aria-label={`Call ${x.c.name}`}><Phone size={14} /></a>{" "}</>}
                <button type="button" className="sd-btn sm" onClick={() => open(x.c, x.key, "mail")} disabled={!x.c.email} title={x.c.email || "No email address"} aria-label={`Email ${x.c.name}`}><Mail size={14} /></button>{" "}
                <button type="button" className={`sd-btn sm${x.human ? " wa" : ""}`} onClick={() => open(x.c, x.key)}>Message</button>
              </td>
            </tr>
          );
        })}
        {!rows.length && <tr><td colSpan={8} className="sd-none">Nothing here.</td></tr>}
      </tbody>
    </table></div></div>
  );
}

function Pager({ page, pages, count, setPage }) {
  return (
    <div className="sd-pager">
      <span>Showing {count ? page * PER + 1 : 0} to {Math.min(count, page * PER + PER)} of {count.toLocaleString("en-IN")}</span>
      <div>
        <button type="button" className="sd-btn sm" disabled={page === 0} onClick={() => { setPage(page - 1); window.scrollTo(0, 0); }}>Previous</button>
        <span>Page {page + 1} of {pages}</span>
        <button type="button" className="sd-btn sm" disabled={page >= pages - 1} onClick={() => { setPage(page + 1); window.scrollTo(0, 0); }}>Next</button>
      </div>
    </div>
  );
}

/* ───────── Clients ───────── */
function ClientsView({ clients, items, cf, setCf, sort, setSort, page, setPage, open, sel, setSel, teamNames, templates, onSend, onMail, onAssign }) {
  const stages = [...new Set(clients.map(c => c.stageLabel))].sort();
  let L = clients;
  if (cf.src) L = L.filter(c => c.group === cf.src);
  if (cf.stage) L = L.filter(c => c.stageLabel === cf.stage);
  if (cf.money === "due") L = L.filter(c => c.balance > 0);
  if (cf.money === "big") L = L.filter(c => c.balance >= 100000);
  if (cf.money === "paid") L = L.filter(c => c.closed && c.total > 0 && c.balance === 0);
  const so = { score: (a, b) => b.balance - a.balance, amt: (a, b) => b.balance - a.balance || new Date(b.createdAt) - new Date(a.createdAt), age: (a, b) => new Date(b.createdAt) - new Date(a.createdAt), name: (a, b) => String(a.name).localeCompare(String(b.name)), val: (a, b) => b.total - a.total }[sort] || ((a, b) => b.balance - a.balance);
  L = [...L].sort(so);
  const pages = Math.max(1, Math.ceil(L.length / PER));
  const pg = Math.min(page, pages - 1);
  const P = L.slice(pg * PER, pg * PER + PER);
  const totalDue = L.reduce((a, c) => a + c.balance, 0);
  const th = (k, t, cls = "") => <th className={cls}><button type="button" className={sort === k ? "on" : ""} onClick={() => { setSort(k); setPage(0); }}>{t}{sort === k ? " ↓" : ""}</button></th>;
  const pill = (c) => (c.lost ? "" : c.src === "enq" ? "blue" : !c.closed ? "blue" : c.hold ? "pur" : c.completed ? "ok" : c.balance > 0 ? "late" : "blue");
  const selected = L.filter(c => sel.has(c.id));
  const allChk = P.length > 0 && P.every(c => sel.has(c.id));
  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // A client's own follow-up item (for the suggested template); otherwise a plain row
  const rowFor = (c) => items.find(x => x.c.id === c.id) || { c, kind: null, key: null, what: c.stageLabel, amt: c.balance, date: c.createdAt };
  return (
    <>
      <h1 className="sd-h1">Clients<span>.</span></h1>
      <p className="sd-lead">{L.length.toLocaleString("en-IN")} shown · {lakh(totalDue)} pending across them.</p>
      <div className="sd-filters">
        <select value={cf.src} onChange={e => setCf({ ...cf, src: e.target.value })} aria-label="Type">
          <option value="">Projects and new leads</option>
          <option value="project">Projects ({clients.filter(c => c.group === "project").length})</option>
          <option value="new">New leads ({clients.filter(c => c.group === "new").length})</option>
        </select>
        <select value={cf.stage} onChange={e => setCf({ ...cf, stage: e.target.value })} aria-label="Stage">
          <option value="">All stages</option>
          {stages.map(s => <option key={s} value={s}>{s} ({clients.filter(c => c.stageLabel === s).length})</option>)}
        </select>
        <select value={cf.money} onChange={e => setCf({ ...cf, money: e.target.value })} aria-label="Money">
          <option value="">Any amount</option>
          <option value="due">Money pending</option>
          <option value="big">Over ₹1,00,000 pending</option>
          <option value="paid">Fully paid</option>
        </select>
        {(cf.stage || cf.money || cf.src) && <button type="button" className="sd-btn sm" onClick={() => setCf({ stage: "", money: "", src: "" })}>Clear</button>}
      </div>
      <BulkBar count={selected.length} total={L.length} onAll={() => setSel(new Set(L.map(c => c.id)))} onClear={() => setSel(new Set())}
        templates={templates} teamNames={teamNames}
        onSend={(tpl) => onSend(selected.map(rowFor), tpl)} onMail={(tpl) => onMail(selected.map(rowFor), tpl)} onAssign={(o) => onAssign(selected, o)}
        onExport={() => exportCsv(selected.map(rowFor), "clients")} />
      <div className="sd-tbl"><div className="sd-tw"><table>
        <thead><tr>
          <th><input type="checkbox" checked={allChk} aria-label="Select page"
            onChange={e => setSel(s => { const n = new Set(s); P.forEach(c => (e.target.checked ? n.add(c.id) : n.delete(c.id))); return n; })} /></th>
          {th("name", "Client")}<th>Stage</th>{th("amt", "Pending", "r")}{th("val", "Project value", "r")}<th>Handled by</th>{th("age", "Client since")}<th className="r" />
        </tr></thead>
        <tbody>
          {P.map(c => (
            <tr key={c.id} className={`sd-row${sel.has(c.id) ? " sel" : ""}`} onClick={(ev) => rowClick(ev, () => open(c))}>
              <td><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} /></td>
              <td className="nm"><button type="button" className="link" onClick={() => open(c)}>{c.name}</button>
                <small>{[c.company, c.project, c.group === "new" ? `New lead · ${c.source}` : c.branch].filter(Boolean).join(" · ")}</small></td>
              <td><span className={`pill ${pill(c)}`}>{c.stageLabel}</span></td>
              <td className="r num">{c.balance ? inr(c.balance) : <span className="sub">-</span>}</td>
              <td className="r">{c.total ? inr(c.total) : "-"}{c.src === "enq" && c.total ? <span className="sub">budget</span> : null}</td>
              <td>{c.owner}</td>
              <td>{fds(c.createdAt)}</td>
              <td className="r"><button type="button" className="sd-btn sm" onClick={() => open(c)}>Open</button></td>
            </tr>
          ))}
          {!P.length && <tr><td colSpan={8} className="sd-none">No clients match.</td></tr>}
        </tbody>
      </table></div></div>
      <Pager page={pg} pages={pages} count={L.length} setPage={setPage} />
    </>
  );
}

/* ───────── Templates ───────── */
function TemplatesView({ templates, sample, ctx, onSave, onReset }) {
  const [tsel, setTsel] = useState(templates[0].id);
  const [ch, setCh] = useState("wa"); // "wa" | "mail"
  const t = templates.find(x => x.id === tsel) || templates[0];
  const def = DEFAULT_TPL.find(x => x.id === t.id);
  const [text, setText] = useState(t.text);
  const [subject, setSubject] = useState(t.subject);
  const [mail, setMail] = useState(t.mail);
  useEffect(() => { setText(t.text); setSubject(t.subject); setMail(t.mail); }, [t]);
  const isDefault = ch === "wa" ? def?.text === t.text : def?.subject === t.subject && def?.mail === t.mail;
  const save = () => onSave(ch === "wa" ? { [t.id]: text } : { [`mailsub:${t.id}`]: subject, [`mail:${t.id}`]: mail });
  const reset = () => onReset(ch === "wa" ? [t.id] : [`mailsub:${t.id}`, `mail:${t.id}`]);
  return (
    <>
      <h1 className="sd-h1">{ch === "wa" ? "WhatsApp" : "Email"} templates<span>.</span></h1>
      <p className="sd-lead">One complete message each, filled with the client's name, project, amount and your bank details. Saved for the whole team.</p>
      <div className="sd-filters">
        <button type="button" className={`sd-chip${ch === "wa" ? " on" : ""}`} onClick={() => setCh("wa")}>WhatsApp</button>
        <button type="button" className={`sd-chip${ch === "mail" ? " on" : ""}`} onClick={() => setCh("mail")}>Email</button>
      </div>
      <div className="sd-tgrid">
        <nav className="sd-tnav">
          {templates.map(x => (
            <button key={x.id} type="button" className={x.id === t.id ? "on" : ""} onClick={() => setTsel(x.id)}>{x.name}<small>{x.for}</small></button>
          ))}
        </nav>
        <div className="sd-tview">
          <b className="sd-tname">{t.name}</b>
          {ch === "wa" ? (
            <label className="sd-f"><span>Template</span><textarea rows={9} value={text} onChange={e => setText(e.target.value)} /></label>
          ) : (
            <>
              <label className="sd-f"><span>Subject</span><input className="sd-in" value={subject} onChange={e => setSubject(e.target.value)} /></label>
              <label className="sd-f"><span>Email body (the email already starts with “Dear name,”)</span><textarea rows={10} value={mail} onChange={e => setMail(e.target.value)} /></label>
            </>
          )}
          <div className="sd-note">Placeholders: {"{greet} {name} {project} {balance} {bank} {monthly} {services} {reviewLink} {meetWhen} {meetWhere}"}</div>
          {sample && (ch === "wa" ? (
            <div className="sd-prev"><div className="sd-note">Preview for {sample.name}</div>
              <div className="sd-bub">{fillTemplate(text, sample, ctx)}</div></div>
          ) : (
            <MailPreview c={sample} subject={fillTemplate(subject, sample, ctx)} body={fillTemplate(mail, sample, ctx)} />
          ))}
          <div className="sd-acts">
            {!isDefault && <button type="button" className="sd-btn" onClick={reset}>Reset to default</button>}
            <button type="button" className="sd-btn main" onClick={save}>Save template</button>
          </div>
        </div>
      </div>
    </>
  );
}

function MailPreview({ c, subject, body }) {
  return (
    <div className="sd-mail">
      <div className="mh"><span><b>To:</b> {c.email || "no email on this record"}</span><span><b>Subject:</b> {subject}</span></div>
      <div className="mb"><b>Dear {c.name},</b>{"\n\n"}{body}</div>
    </div>
  );
}

/* ───────── Bulk email (sent from the CRM, one after another) ───────── */
function BulkMail({ rows, tplId, templates, ctx, onClose, onSend }) {
  const list = rows.filter(x => x.c.email && x.c.src !== "event");
  const skipped = rows.length - list.length;
  const tplFor = (row) => templates.find(t => t.id === (tplId || (row.kind ? KIND[row.kind].tpl : row.c.closed ? "pay" : "followup"))) || templates[0];
  const [state, setState] = useState("confirm"); // confirm | sending | done
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState([]);
  const first = list[0];
  const ft = first ? tplFor(first) : null;
  const go = async () => {
    setState("sending");
    for (const x of list) {
      const t = tplFor(x);
      try {
        await onSend(x, fillTemplate(t.subject, x.c, { ...ctx, item: x }), fillTemplate(t.mail, x.c, { ...ctx, item: x }));
        setDone(n => n + 1);
      } catch (err) { setFailed(f => [...f, `${x.c.name}: ${err.message}`]); }
    }
    setState("done");
  };
  return (
    <>
      <div className="sd-mscrim" onClick={state === "sending" ? undefined : onClose} />
      <div className="sd-modal" role="dialog" aria-modal="true">
        <div className="m-h"><h3>Email {list.length} client{list.length === 1 ? "" : "s"}</h3>
          {state !== "sending" && <button type="button" className="sd-btn sm" onClick={onClose} aria-label="Close"><X size={14} /></button>}</div>
        <div className="m-b">
          {state === "confirm" && (
            <>
              <p style={{ margin: 0 }}>
                {tplId ? <>Template: <b>{ft?.name}</b></> : <>Each client gets the <b>template suggested for their situation</b></>}, filled with their own name, project and amount.
                {" "}Emails go out from the CRM mail account and are logged on each client.
                {skipped ? <> <b>{skipped}</b> without an email address will be skipped.</> : null}
              </p>
              {first && <><div className="sd-note">Example for {first.c.name}</div>
                <MailPreview c={first.c} subject={fillTemplate(ft.subject, first.c, { ...ctx, item: first })} body={fillTemplate(ft.mail, first.c, { ...ctx, item: first })} /></>}
              <div className="sd-acts">
                <button type="button" className="sd-btn" onClick={onClose}>Cancel</button>
                <button type="button" className="sd-btn main" onClick={go} disabled={!list.length}>Send {list.length} email{list.length === 1 ? "" : "s"}</button>
              </div>
            </>
          )}
          {state !== "confirm" && (
            <>
              <p style={{ margin: 0 }}><b>{done} of {list.length} sent</b>{state === "sending" ? "…" : "."}</p>
              {failed.length > 0 && <div className="sd-error">{failed.map(f => <div key={f}>{f}</div>)}</div>}
              {state === "done" && <div className="sd-acts"><button type="button" className="sd-btn main" onClick={onClose}>Done</button></div>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ───────── Automation & settings ───────── */
function AutomationView({ settings, banks, owners, clients, items, onSave }) {
  const [r, setR] = useState(settings.rules);
  const [upi, setUpi] = useState(settings.upi || "");
  const [review, setReview] = useState(settings.reviewLink || "");
  const [bankId, setBankId] = useState(settings.bankAccountId || "");
  const num = (k, w = 64, step = 1) => (
    <input type="number" min="0" step={step} style={{ width: w }} value={r[k]} onChange={e => setR({ ...r, [k]: e.target.value })}
      onBlur={() => Number(r[k]) !== Number(settings.rules[k]) && onSave({ rules: { [k]: Number(r[k]) } })} />
  );
  const counts = {};
  for (const c of clients) counts[c.owner] = (counts[c.owner] || 0) + 1;
  const open = {};
  for (const x of items) if (x.due <= 0) open[x.c.owner] = (open[x.c.owner] || 0) + 1;
  return (
    <>
      <h1 className="sd-h1">Automation and settings<span>.</span></h1>
      <p className="sd-lead">These rules decide what needs a person and what can go out as a routine reminder.</p>
      <div className="sd-setgrid">
        <div className="sd-box">
          <h3>Who handles what</h3>
          <div className="sd-rule"><span><b>Automatic sending.</b> Needs the WhatsApp Business API, which is not connected. Until then, routine reminders are grouped under “Routine” so you can send them in one bulk send.</span><span className="pill">Not connected</span></div>
          <div className="sd-rule"><span>After {num("maxAuto")} reminders in 30 days with no reply, hand the client to a person to call.</span></div>
          <div className="sd-rule"><span>Amounts of ₹ {num("bigAmount", 110, 10000)} or more always go to a person.</span></div>
          <div className="sd-rule"><span>A client is “gone quiet” after {num("quietDays")} days without any activity.</span></div>
          <div className="sd-rule"><span>After you send a message, bring the client back in {num("afterSend")} days if nothing changes.</span></div>
          <div className="sd-rule"><span>Ask for a Google review up to {num("reviewDays")} days after a project is completed and fully paid.</span></div>
          <div className="sd-rule"><span><b>Pause clients on hold.</b> Projects on hold only show reminders the client asked for.</span>
            <label className="sd-tog"><input type="checkbox" checked={!!r.holdPause} onChange={e => { setR({ ...r, holdPause: e.target.checked }); onSave({ rules: { holdPause: e.target.checked } }); }} aria-label="Pause on hold" /><span /></label></div>
          <div className="sd-rule"><span><b>Any WhatsApp you send is logged</b> on the client, and counts towards the reminder limit.</span></div>
        </div>

        <div className="sd-box">
          <h3>Payment details used in messages</h3>
          <label className="sd-f"><span>Bank account</span>
            <select value={bankId} onChange={e => setBankId(e.target.value)}>
              <option value="">Don't include bank details</option>
              {banks.map(b => <option key={b._id} value={b._id}>{b.name} · {b.bankName} · {String(b.accountNumber).slice(-4).padStart(8, "•")}</option>)}
            </select></label>
          <label className="sd-f"><span>UPI ID</span><input value={upi} onChange={e => setUpi(e.target.value)} placeholder="name@bank" /></label>
          <label className="sd-f"><span>Google review link</span><input value={review} onChange={e => setReview(e.target.value)} placeholder="https://g.page/r/…/review" /></label>
          <button type="button" className="sd-btn main" style={{ alignSelf: "flex-start" }}
            onClick={() => onSave({ bankAccountId: bankId || null, upi, reviewLink: review })}>Save</button>
          <h3 style={{ marginTop: 10 }}>Team</h3>
          <div className="sd-list">
            {owners.map(o => (
              <div key={o}><span>{o}<small>{counts[o] || 0} clients</small></span><b>{open[o] || 0} due</b></div>
            ))}
          </div>
          <p className="sd-note" style={{ margin: 0 }}>Taken from “Rep” on projects and “Assigned to” on new leads. Reassign many at once from any list.</p>
        </div>
      </div>
    </>
  );
}

/* ───────── Bulk send (one WhatsApp per client, in order) ───────── */
function BulkSend({ rows, tplId, templates, ctx, onClose, onSent }) {
  const list = rows.filter(x => x.c.phone && x.c.src !== "event");
  const skipped = rows.length - list.length;
  const [i, setI] = useState(0);
  const [sent, setSent] = useState(0);
  const x = list[i];
  const tplFor = (row) => templates.find(t => t.id === (tplId || (row.kind ? KIND[row.kind].tpl : row.c.closed ? "pay" : "followup"))) || templates[0];
  const t = x ? tplFor(x) : null;
  const [edits, setEdits] = useState({}); // edited message per row
  const text = x && t ? (edits[i] ?? fillTemplate(t.text, x.c, { ...ctx, item: x })) : "";
  const setText = (v) => setEdits(m => ({ ...m, [i]: v }));
  const send = async () => {
    window.open(`https://wa.me/${waPhone(x.c.phone)}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    try { await onSent(x, t.name); setSent(n => n + 1); } catch (err) { toast.error(err.message || "Could not log"); }
    setI(n => n + 1);
  };
  return (
    <>
      <div className="sd-mscrim" onClick={onClose} />
      <div className="sd-modal" role="dialog" aria-modal="true">
        <div className="m-h"><h3>Send to {list.length} client{list.length === 1 ? "" : "s"}</h3><button type="button" className="sd-btn sm" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
        <div className="m-b">
          {x ? (
            <>
              <p className="sd-note" style={{ margin: 0 }}>
                {i + 1} of {list.length} · {tplId ? <>Template: <b>{t.name}</b></> : <>Suggested template for each client</>}.
                {" "}Each message opens in WhatsApp; it is logged on the client when you move to the next.
                {skipped ? ` ${skipped} without a phone number are skipped.` : ""}
              </p>
              <div className="sd-bulkwho"><b>{x.c.name}</b><span>{[x.c.company, x.c.phone].filter(Boolean).join(" · ")}</span></div>
              <textarea className="sd-bub edit" value={text} onChange={e => setText(e.target.value)} aria-label="Message" />
              <div className="sd-acts">
                <button type="button" className="sd-btn" onClick={() => setI(n => n + 1)}>Skip</button>
                <button type="button" className="sd-btn wa" onClick={send}>Open WhatsApp and next</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}><b>{sent} message{sent === 1 ? "" : "s"} sent and logged.</b> They come back to your list if there is no change.</p>
              <div className="sd-acts"><button type="button" className="sd-btn main" onClick={onClose}>Done</button></div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ───────── Client drawer ───────── */
function ClientDrawer({ c, item, templates, ctx, settings, teamNames, events, services, onClose, onChanged, logWa, afterSent, assign, onMeeting, sendMail, channel }) {
  const firstTpl = item ? KIND[item.kind].tpl : c.src === "enq" ? "enq" : c.completed && c.balance > 0 ? "final" : c.closed ? "pay" : "followup";
  const [tpl, setTpl] = useState(firstTpl);
  const [text, setText] = useState("");
  const [ch, setCh] = useState(channel || "wa"); // "wa" | "mail"
  const [subject, setSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [remDate, setRemDate] = useState(addDays(2));
  const [remType, setRemType] = useState(c.closed ? "payment_followup" : c.src === "enq" ? "enquiry_followup" : "call_followup");
  const [remNote, setRemNote] = useState("");
  const [busy, setBusy] = useState(false);
  const meetings = events.filter(e => e.type === "demo" || e.time).sort((a, b) => new Date(b.date) - new Date(a.date));
  const reminders = events.filter(e => !(e.type === "demo" || e.time)).sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextMeet = meetings.find(m => daysFrom(m.date) >= 0 && (!m.status || m.status === "scheduled"));

  useEffect(() => { setTpl(firstTpl); }, [c.id, firstTpl]);
  useEffect(() => {
    const t = templates.find(x => x.id === tpl) || templates[0];
    const x = { ...ctx, item, meet: nextMeet };
    setText(fillTemplate(t.text, c, x));
    setSubject(fillTemplate(t.subject || "", c, x));
    setMailBody(fillTemplate(t.mail || "", c, x));
  }, [tpl, c, item, ctx, templates, nextMeet]);
  useEffect(() => { setCh(channel || "wa"); }, [c.id, channel]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); onChanged(); }
    catch (err) { toast.error(err.message || "Failed"); }
    finally { setBusy(false); }
  };
  const send = () => {
    const msg = text.trim();
    if (!msg) return;
    window.open(`https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    const t = templates.find(x => x.id === tpl);
    run(async () => { await logWa(c, `WhatsApp sent: ${t?.name || "message"}`); if (item) await afterSent([item]); },
      `Sent and logged. Comes back on ${fdw(addDays(settings.rules.afterSend || 2))} if nothing changes.`);
  };
  const email = () => {
    if (!subject.trim() || !mailBody.trim()) { toast.error("Add a subject and a message"); return; }
    run(async () => { await sendMail(c, subject.trim(), mailBody.trim()); if (item) await afterSent([item]); },
      `Email sent to ${c.email} and logged. Comes back on ${fdw(addDays(settings.rules.afterSend || 2))} if nothing changes.`);
  };
  const addReminder = () => run(() => billingApi("/calendar-events", { method: "POST", body: {
    ...(c.src === "lead" ? { leadId: c.id } : { enquiryId: c.id }),
    type: remType, date: remDate, title: remNote.trim() || "Follow up",
  } }).then(() => setRemNote("")), `Reminder set for ${fdw(remDate)}`);
  const evDone = (ev) => run(() => billingApi(`/calendar-events/${ev._id}`, { method: "PUT", body: { done: true } }), "Done");
  const setHold = (on) => run(() => billingApi(`/leads/${c.id}`, { method: "PUT", body: { projectStage: on ? "On Hold" : "Development in Progress" } }), on ? "Put on hold" : "Resumed");
  const sent = waCount(c);
  const svcDue = services.reduce((a, s) => a + (s.overdueAmount || 0), 0);

  return (
    <>
      <div className="sd-scrim" onClick={onClose} />
      <aside className="sd-drawer" aria-label={c.name}>
        <div className="d-top">
          <span className="sd-av">{initials(c.name)}</span>
          <div>
            <h2>{c.name}</h2>
            <p>{[c.company, c.project, c.group === "new" ? "New lead" : c.branch, c.phone && `+91 ${c.phone}`].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="d-b">
          <div className="sd-g3">
            <div className="sd-kv"><span>Stage</span><b>{c.stageLabel}</b></div>
            <label className="sd-kv"><span>Handled by</span>
              <select value={c.owner} disabled={busy} onChange={e => assign([c], e.target.value)}>
                {!teamNames.includes(c.owner) && <option value={c.owner}>{c.owner}</option>}
                {teamNames.map(o => <option key={o} value={o}>{o}</option>)}
              </select></label>
            <div className="sd-kv"><span>Source</span><b>{c.source || "-"}</b></div>
          </div>

          {item && (
            <div className={`sd-why k-${item.kind}`}>
              <b>{KIND[item.kind].label}{item.due < 0 ? ` · ${-item.due}d late` : ""}</b><span>{item.what}</span>
              {item.human && item.whyHuman && <span className="sd-note">Needs you: {item.whyHuman}</span>}
            </div>
          )}

          {c.hold && (
            <div className="sd-hold"><b>On hold</b><span>Reminders are paused except ones the client asked for.</span>
              <button type="button" className="sd-btn sm" onClick={() => setHold(false)} disabled={busy}>Resume now</button></div>
          )}

          <div className="sd-comp">
            <h3>
              <span className="sd-chtabs" role="group" aria-label="Channel">
                <button type="button" className={ch === "wa" ? "on" : ""} onClick={() => setCh("wa")}><MessageCircle size={14} /> WhatsApp</button>
                <button type="button" className={ch === "mail" ? "on" : ""} onClick={() => setCh("mail")}><Mail size={14} /> Email</button>
              </span>
              <select value={tpl} onChange={e => setTpl(e.target.value)} aria-label="Template">
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </h3>
            {ch === "wa" ? (
              <textarea value={text} onChange={e => setText(e.target.value)} aria-label="Message" />
            ) : (
              <>
                <div className="sd-mailto"><span>To</span><b>{c.email || "No email address on this record"}</b></div>
                <input className="sd-in" value={subject} onChange={e => setSubject(e.target.value)} aria-label="Subject" placeholder="Subject" />
                <div className="sd-note">The email starts with “Dear {c.name},” automatically.</div>
                <textarea value={mailBody} onChange={e => setMailBody(e.target.value)} aria-label="Email message" />
              </>
            )}
            <div className="sd-acts">
              {c.src === "lead" && c.closed && !c.hold && <button type="button" className="sd-btn" onClick={() => setHold(true)} disabled={busy}>Put on hold</button>}
              {c.phone && <a className="sd-btn" href={`tel:${c.phone}`}><Phone size={14} /> Call</a>}
              {ch === "wa"
                ? <button type="button" className="sd-btn wa" onClick={send} disabled={!c.phone || busy}>Send on WhatsApp</button>
                : <button type="button" className="sd-btn mail" onClick={email} disabled={!c.email || busy}><Mail size={14} /> Send email</button>}
            </div>
            {ch === "wa" && !c.phone && <div className="sd-note">No phone number on this record.</div>}
            {ch === "mail" && !c.email && <div className="sd-note">Add an email address on this client to send email.</div>}
          </div>

          <DeskActions key={c.id} c={c} run={run} busy={busy} />

          {c.src === "lead" && (
            <div>
              <h3>Money</h3>
              <div className="sd-money">
                <div><span>Project value{c.raw.gstApplicable ? " (incl. GST)" : ""}</span><b>{inr(c.total)}</b></div>
                <div><span>Received</span><b>{inr(c.received)}</b></div>
                <div><span>Balance</span><b className={c.balance ? "late" : "ok"}>{inr(c.balance)}</b></div>
              </div>
              <div className="sd-dates">
                {c.raw.onboardedDate && <span>Onboarded {fds(c.raw.onboardedDate)}</span>}
                {c.raw.finalPaymentDate && <span>Final payment {fds(c.raw.finalPaymentDate)}</span>}
                {c.raw.projectCompletionDate && <span>{c.completed ? "Completed" : "Delivery due"} {fds(c.raw.projectCompletionDate)}</span>}
              </div>
            </div>
          )}
          {c.src === "enq" && (
            <div>
              <h3>New lead</h3>
              <div className="sd-money">
                <div><span>Services</span><b>{c.project}</b></div>
                <div><span>Budget</span><b>{c.total ? inr(c.total) : "-"}</b></div>
                <div><span>Received on</span><b>{fds(c.createdAt)}</b></div>
              </div>
              {c.raw.requirements && <p className="sd-note" style={{ marginTop: 8 }}>{c.raw.requirements}</p>}
            </div>
          )}

          {services.length > 0 && (
            <div>
              <h3>Monthly services {svcDue > 0 && <span className="pill late">{inr(svcDue)} overdue</span>}</h3>
              <div className="sd-list">
                {services.map(s => (
                  <div key={s._id}><span>{s.name}<small>{s.type} · billed on day {s.billingDay}</small></span><b>{inr(s.monthlyTotal || s.amount)}/mo</b></div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3>Meetings <button type="button" className="sd-btn sm" onClick={() => onMeeting(null)}>Schedule</button></h3>
            <div className="sd-list">
              {meetings.map(m => (
                <button key={m._id} type="button" className="sd-li" onClick={() => onMeeting(m)}>
                  <span><b className="sd-fd">{fds(m.date)}</b>{m.title || "Meeting"}<small>{ampm(m.time)} · {m.summary || (m.status === "scheduled" || !m.status ? "upcoming" : m.status)}</small></span>
                  {m.outcome ? <span className="pill ok">{m.outcome}</span> : m.status && m.status !== "scheduled" ? <span className="pill">{m.status}</span> : null}
                </button>
              ))}
              {!meetings.length && <div><span className="sd-note">No meetings yet.</span></div>}
            </div>
          </div>

          <div>
            <h3>Reminders</h3>
            <div className="sd-list">
              {reminders.map(ev => (
                <div key={ev._id}>
                  <span style={ev.done ? { textDecoration: "line-through", color: "#667085" } : undefined}><b className="sd-fd">{fds(ev.date)}</b>{ev.title || "Follow-up"}<small>{ev.type.replace(/_/g, " ")}</small></span>
                  {!ev.done && ev.status !== "done" && <button type="button" className="sd-btn sm" onClick={() => evDone(ev)} disabled={busy}>Done</button>}
                </div>
              ))}
              {c.pendingFu.filter(f => f.dated).map((f, i) => (
                <div key={`f${i}`}><span><b className="sd-fd">{fds(f.due)}</b>{f.title || "Follow-up"}<small>{f.channel} · lead follow-up</small></span>
                  {daysFrom(f.due) < 0 && <span className="pill late">{-daysFrom(f.due)}d late</span>}</div>
              ))}
              {c.src === "enq" && c.raw.followUpDate && (
                <div><span><b className="sd-fd">{fds(c.raw.followUpDate)}</b>Follow-up<small>set on the lead</small></span></div>
              )}
              {!reminders.length && !c.pendingFu.some(f => f.dated) && !(c.src === "enq" && c.raw.followUpDate) && <div><span className="sd-note">No reminders.</span></div>}
            </div>
            <div className="sd-addrow">
              <input type="date" value={remDate} onChange={e => setRemDate(e.target.value)} aria-label="Reminder date" />
              <select value={remType} onChange={e => setRemType(e.target.value)} aria-label="Reminder type">
                <option value="call_followup">Follow-up</option>
                <option value="payment_followup">Payment</option>
                <option value="client_response">Client asked</option>
                {c.src === "enq" && <option value="enquiry_followup">Lead follow-up</option>}
              </select>
              <input value={remNote} onChange={e => setRemNote(e.target.value)} placeholder="What to do" aria-label="Reminder note" />
              <button type="button" className="sd-btn sm" onClick={addReminder} disabled={busy || !remDate}>Add</button>
            </div>
          </div>

          <div>
            <h3>Recent activity <span className="sd-note">{sent} reminder{sent === 1 ? "" : "s"} sent in 30 days</span></h3>
            <div className="sd-tl">
              {c.acts.slice(0, 8).map((a, i) => (
                <div key={i}><span className={`w ${a.who}`}>{a.who === "wa" ? "WhatsApp" : a.who === "mail" ? "Email" : a.who === "note" ? "Note" : a.who === "call" ? "Call" : "Update"}</span>
                  <p>{a.text}</p><small>{fds(a.at)}</small></div>
              ))}
              {!c.acts.length && <p className="sd-note">No activity yet.</p>}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
