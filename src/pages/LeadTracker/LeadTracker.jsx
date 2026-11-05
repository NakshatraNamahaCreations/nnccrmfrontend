import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, User, Clock, Bell, FileText, Flame, Trophy, Copy, Eraser, CalendarDays } from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import { billingApi } from "../ProjectBilling/billingMeta";
import {
  buildLeads, TEAM, STAGES, STL, STC, OPEN, isOpen, VIEWS, AGE, inAge, SERVICES, val, band, why, prio,
  TODAY, plusDays, dd, ymd, fd, fdw, L, pct, fmin, phF, ph10,
} from "./leadData";
import LeadDrawer from "./LeadDrawer";
import AddLead from "./AddLead";
import Pager from "./Pager";
import "./LeadTracker.css";

// Lead Tracker (sidebar → Overview, under All Leads): every enquiry and lead from the CRM,
// ranked by what needs action today, with pipeline, clients, sources and team views.

async function fetchAll(path, pageSize = 200) {
  const all = [];
  for (let p = 1; p < 40; p++) {
    const j = await billingApi(`${path}${path.includes("?") ? "&" : "?"}limit=${pageSize}&page=${p}`);
    const rows = j.data || [];
    all.push(...rows);
    const pages = j.pages || (j.total ? Math.ceil(j.total / pageSize) : 1);
    if (p >= pages || rows.length < pageSize) break;
  }
  return all;
}
const me = () => { try { return JSON.parse(localStorage.getItem("nnc_user") || "null")?.name || "Admin"; } catch { return "Admin"; } };
const PG = 50;
const OWN_C = ["#2563EB", "#7C3AED", "#0891B2", "#D97706", "#DB2777", "#64748B"];
const TABS = [["today", "Today"], ["list", "All leads"], ["board", "Pipeline"], ["clients", "Clients"], ["sources", "Sources"], ["team", "Team"]];
const NOF = { q: "", view: "open", stage: "", src: "", svc: "", age: "", band: "", owner: "", branch: "", site: "", client: "", project: "", dfield: "created", from: "", to: "", has: "", vmin: "", vmax: "" };
const FILTER_KEYS = ["q", "stage", "src", "svc", "age", "band", "owner", "branch", "site", "client", "project", "from", "to", "has", "vmin", "vmax"];
// which date the custom range looks at
const DFIELD = { created: ["Enquired on", l => l.day], last: ["Last activity", l => ymd(l.last)], nf: ["Next follow-up", l => l.nf], won: ["Won on", l => l.wonDate], lost: ["Lost on", l => l.lostDate] };
const monthStart = (k) => { const d = new Date(); d.setMonth(d.getMonth() + k, 1); return ymd(d); };
const monthEnd = (k) => { const d = new Date(); d.setMonth(d.getMonth() + k + 1, 0); return ymd(d); };
const PRESETS = [["Today", () => [TODAY(), TODAY()]], ["Last 7 days", () => [plusDays(-6), TODAY()]], ["Last 30 days", () => [plusDays(-29), TODAY()]], ["This month", () => [monthStart(0), TODAY()]], ["Last month", () => [monthStart(-1), monthEnd(-1)]], ["This year", () => [`${new Date().getFullYear()}-01-01`, TODAY()]]];

export const Score = ({ l }) => <span className={`lt-sc ${band(l.sc)}`} title="Lead score">{l.sc}</span>;

export default function LeadTracker() {
  const [data, setData] = useState({ enquiries: [], leads: [], quotes: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("today");
  const [own, setOwn] = useState("all");
  const [br, setBr] = useState("all");
  const [f, setF] = useState(NOF);
  const [sort, setSort] = useState("prio");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [openTab, setOpenTab] = useState("ov");
  const [seq, setSeq] = useState(0);   // a new open (even of the same lead) starts the panel fresh
  const [per, setPer] = useState("q");
  const [cf, setCf] = useState({ q: "", f: "all", s: "biz", p: 0 });
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState("");
  const [adding, setAdding] = useState(false);
  const [tf, setTf] = useState({ q: "", src: "", svc: "", band: "", stage: "", owner: "" });   // filters on Today

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [E, Ld, Q, ev] = await Promise.all([
        fetchAll("/enquiries"),
        fetchAll("/leads"),
        fetchAll("/quotations", 50).catch(() => []),
        billingApi(`/calendar-events?from=${ymd(Date.now() - 730 * 864e5)}&to=${plusDays(180)}`).catch(() => ({ list: [] })),
      ]);
      setData({ enquiries: E, leads: Ld, quotes: Q, events: ev.list || [] });
    } catch (err) { setError(err.message || "Could not load leads"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => buildLeads(data), [data]);
  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);
  const owners = useMemo(() => [...TEAM, "Unassigned"], []);
  const ownC = (o) => (o === "Unassigned" ? "#94A3B8" : OWN_C[TEAM.indexOf(o)] || "#64748B");
  const branches = useMemo(() => [...new Set(rows.map(r => r.branch).filter(Boolean))].sort(), [rows]);
  const sources = useMemo(() => [...new Set(rows.map(r => r.source))].sort(), [rows]);
  const scope = useMemo(() => rows.filter(r => (own === "all" || r.owner === own) && (br === "all" || r.branch === br)), [rows, own, br]);
  // new leads waiting for a first call (last 14 days), the same count as the sidebar badge
  const freshNew = scope.filter(l => l.src === "enq" && l.st === "new" && dd(l.created) >= -14).length;

  /* ── saving: through the existing enquiry and lead APIs ── */
  const putEnq = (doc) => setData(d => ({ ...d, enquiries: d.enquiries.map(e => (String(e._id) === String(doc._id) ? { ...e, ...doc } : e)) }));
  const act = {
    async stage(l, st) {
      if (l.src !== "enq") return toast.error("Change the stage of a direct project from Projects");
      const j = await billingApi(`/enquiries/${l.id}`, { method: "PUT", body: { status: st, updatedBy: me() } });
      putEnq(j.data);
    },
    async owner(l, o) {
      if (l.src === "enq") putEnq((await billingApi(`/enquiries/${l.id}`, { method: "PUT", body: { assignedTo: o, updatedBy: me() } })).data);
      else { await billingApi(`/leads/${l.id}`, { method: "PUT", body: { repName: o, rep: o } }); load(true); }
    },
    async log(l, action, note, followUpDate) {
      if (l.src === "enq") {
        const body = { action, note, by: me() };
        if (followUpDate !== undefined) body.followUpDate = followUpDate || null;
        putEnq((await billingApi(`/enquiries/${l.id}/activity`, { method: "POST", body })).data);
      } else { await billingApi(`/leads/${l.id}/comms`, { method: "POST", body: { type: action, summary: note } }); load(true); }
    },
    async follow(l, date) { return act.log(l, "", "", date); },
    async lost(l, reason) {
      if (l.src !== "enq") return toast.error("Close a direct project from Projects");
      putEnq((await billingApi(`/enquiries/${l.id}/lost`, { method: "POST", body: { lost: true, reason, by: me() } })).data);
    },
    async reopen(l) { putEnq((await billingApi(`/enquiries/${l.id}/lost`, { method: "POST", body: { lost: false, by: me() } })).data); },
    async convert(l) { await billingApi(`/enquiries/${l.id}/convert`, { method: "POST", body: { convertedBy: me() } }); await load(true); },
  };
  const run = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); return true; } catch (e) { toast.error(e.message || "Could not save"); return false; } };

  const openLead = (id, t = "ov") => { setOpenId(id); setOpenTab(t); setSeq(n => n + 1); };
  const goView = (v, extra = {}) => { setTab("list"); setF({ ...NOF, view: v, ...extra }); setPage(0); setSel(new Set()); setSort(v === "nocontact" ? "new" : "prio"); window.scrollTo(0, 0); };

  /* ── bulk actions ── */
  const bulk = async (label, fn) => {
    const L0 = [...sel].map(id => byId.get(id)).filter(Boolean);
    let ok = 0;
    for (const l of L0) { try { await fn(l); ok++; } catch { /* counted below */ } }
    toast[ok === L0.length ? "success" : "error"](`${ok} of ${L0.length} leads ${label}`);
    setSel(new Set());
  };

  const filtered = useMemo(() => {
    let A = f.view === "today_new" ? scope.filter(l => l.day === TODAY()) : scope.filter(VIEWS[f.view]?.[1] || VIEWS.open[1]);
    if (f.stage) A = A.filter(l => l.st === f.stage);
    if (f.src) A = A.filter(l => l.source === f.src);
    if (f.svc) A = A.filter(l => l.svc === f.svc);
    if (f.age) A = A.filter(l => inAge(l, f.age));
    if (f.band) A = A.filter(l => band(l.sc) === f.band);
    if (f.owner) A = A.filter(l => l.owner === f.owner);
    if (f.branch) A = A.filter(l => l.branch === f.branch);
    if (f.site) A = A.filter(l => (f.site === "lead" ? l.src === "lead" : l.src === "enq" && l.site === f.site));
    if (f.client.trim()) { const c = f.client.toLowerCase().trim(); A = A.filter(l => l.name.toLowerCase().includes(c) || l.company.toLowerCase().includes(c)); }
    if (f.project.trim()) { const c = f.project.toLowerCase().trim(); A = A.filter(l => `${l.services} ${l.need} ${l.svc} ${l.landing} ${l.lead?.requirements || ""}`.toLowerCase().includes(c)); }
    if (f.from || f.to) { const get = DFIELD[f.dfield]?.[1] || DFIELD.created[1]; A = A.filter(l => { const d = get(l); return d && (!f.from || d >= f.from) && (!f.to || d <= f.to); }); }
    if (f.has === "quote") A = A.filter(l => l.quotes.length);
    if (f.has === "noquote") A = A.filter(l => !l.quotes.length);
    if (f.has === "meet") A = A.filter(l => l.meets.length);
    if (f.has === "budget") A = A.filter(l => l.budget > 0);
    if (f.has === "email") A = A.filter(l => l.email);
    if (f.has === "balance") A = A.filter(l => l.money?.balance > 0);
    if (f.vmin !== "") A = A.filter(l => val(l) >= Number(f.vmin));
    if (f.vmax !== "") A = A.filter(l => val(l) <= Number(f.vmax));
    if (f.q.trim()) {
      const q = f.q.toLowerCase().trim(), dg = q.replace(/\D/g, "");
      A = A.filter(l => (dg.length >= 4 && ph10(l.phone).includes(dg)) || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.need.toLowerCase().includes(q));
    }
    const so = { prio: (a, b) => prio(b) - prio(a), new: (a, b) => b.created - a.created, old: (a, b) => a.created - b.created, val: (a, b) => val(b) - val(a), score: (a, b) => b.sc - a.sc, nf: (a, b) => (a.nf || "9").localeCompare(b.nf || "9") }[sort];
    return [...A].sort(so);
  }, [scope, f, sort]);

  const exportCsv = (A, name = "leads") => {
    const head = ["Name", "Company", "Mobile", "Email", "Source", "Website", "Landing page", "Service", "Asked for", "Requirement", "Budget said", "Value", "Stage", "Score", "Owner", "Branch", "Enquired", "First reply (min)", "Last activity", "Next follow-up", "Quotations", "Latest quotation", "Meetings", "Won on", "Project value", "Received", "Balance", "Lost on", "Lost reason", "Next step"];
    const lines = [head, ...A.map(l => [l.name, l.company, l.phone, l.email, l.source, l.src === "lead" ? "Projects" : l.site === "nncdigital" ? "NNC Digital" : "NNC", l.landing, l.svc, l.services, l.need, l.budget || "", val(l), STL[l.st], l.sc, l.owner, l.branch, l.day, l.fr ?? "", ymd(l.last), l.nf || "", l.quotes.length, l.quoteVal || "", l.meets.length, l.wonDate || "", l.money?.total ?? "", l.money?.received ?? "", l.money?.balance ?? "", l.lostDate || "", l.reason, why(l)[0]])]
      .map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const u = URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = u; a.download = `${name}-${TODAY()}.csv`; a.click(); URL.revokeObjectURL(u);
    toast.success(`${A.length} leads exported`);
  };

  const open = openId ? byId.get(openId) : null;
  const ctx = { scope, rows, branches, tf, setTf, goView, openLead, ownC, filtered, f, setF, sort, setSort, page, setPage, sel, setSel, sources, owners, act, run, bulk, exportCsv, per, setPer, cf, setCf, drag, setDrag, over, setOver, load };

  return (
    <div className="lt-layout">
      <Sidebar />
      <div className="lt">
        <div className="lt-wrap">
          <header className="lt-hd">
            <h1>All Leads<span>.</span></h1>
            <nav className="lt-tabs" aria-label="All Leads">
              {TABS.map(([k, t]) => (
                <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => { setTab(k); setSel(new Set()); }}>
                  {t}{k === "today" && freshNew > 0 && <em title="New leads from the last 14 days, not contacted yet">{freshNew}</em>}
                </button>
              ))}
            </nav>
            <span className="lt-sp" />
            <div className="lt-seg" role="group" aria-label="Owner">
              {["all", ...TEAM].map(o => <button key={o} type="button" className={own === o ? "on" : ""} onClick={() => { setOwn(o); setPage(0); }}>{o === "all" ? "Everyone" : o}</button>)}
            </div>
            <label className="lt-sr" htmlFor="lt-br">Branch</label>
            <select id="lt-br" className="lt-in sm" value={br} onChange={e => { setBr(e.target.value); setPage(0); }}>
              <option value="all">All branches</option>{branches.map(b => <option key={b}>{b}</option>)}
            </select>
            <button type="button" className="lt-btn p" onClick={() => setAdding(true)}>+ Add lead</button>
            <button type="button" className="lt-btn" onClick={() => load()} disabled={loading} aria-label="Refresh"><RefreshCw size={15} className={loading ? "lt-spin" : ""} /></button>
          </header>

          {error ? <div className="lt-card lt-empty">{error} <button type="button" className="lt-btn sm" onClick={() => load()}>Try again</button></div>
            : loading && !rows.length ? <div className="lt-card lt-empty">Loading leads…</div>
            : tab === "today" ? <Today {...ctx} />
            : tab === "list" ? <List {...ctx} />
            : tab === "board" ? <Board {...ctx} />
            : tab === "clients" ? <Clients {...ctx} />
            : tab === "sources" ? <Sources {...ctx} />
            : <Team {...ctx} />}
          <p className="lt-note" style={{ marginTop: 16 }}>{rows.length.toLocaleString("en-IN")} leads from Enquiries and Projects. Changes made here save to the same records as All Leads.</p>
        </div>
      </div>
      {adding && <AddLead rows={rows} owners={owners} by={me()} onClose={() => setAdding(false)} onSaved={async (id) => { setAdding(false); await load(true); openLead(id); }} />}
      {open && <LeadDrawer key={`${open.id}-${seq}`} l={open} tab={openTab} setTab={setOpenTab} onClose={() => setOpenId(null)} onOpen={openLead} owners={owners} act={act} run={run} />}
    </div>
  );
}

/* ───────── Today ───────── */
function Tile({ ic, c, bg, t, n, s, onClick }) {
  return (
    <button type="button" className="lt-tile" onClick={onClick}>
      <span className="h"><span className="lt-ic" style={{ background: bg, color: c }}>{ic}</span>{t}</span>
      <span className="v">{n}</span><span className="s">{s}</span>
    </button>
  );
}
function Today({ scope: all, tf, setTf, sources, owners, goView, openLead, ownC, act, run }) {
  const t = TODAY(), ms = t.slice(0, 8) + "01";
  const scope = all.filter(l => (!tf.src || l.source === tf.src) && (!tf.svc || l.svc === tf.svc) && (!tf.band || band(l.sc) === tf.band) && (!tf.stage || l.st === tf.stage) && (!tf.owner || l.owner === tf.owner)
    && (!tf.q.trim() || `${l.name} ${l.company} ${l.phone} ${l.need} ${l.services}`.toLowerCase().includes(tf.q.toLowerCase().trim())));
  const tOn = Object.values(tf).some(Boolean);
  const set = (k, v) => setTf(x => ({ ...x, [k]: v }));
  const pick = (k, label, opts) => (
    <><label className="lt-sr" htmlFor={`tf-${k}`}>{label}</label>
      <select id={`tf-${k}`} className="lt-in sm" value={tf[k]} onChange={e => set(k, e.target.value)}><option value="">{label}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></>
  );
  const open = scope.filter(isOpen), newT = scope.filter(l => l.day === t), wait = scope.filter(l => l.st === "new");
  const due = open.filter(l => l.nf === t && l.st !== "new"), late = open.filter(l => l.nf && l.nf < t);
  const quoted = open.filter(VIEWS.quoted[1]), hot = open.filter(VIEWS.hot[1]);
  const wonM = scope.filter(l => l.st === "won" && l.wonDate >= ms), cm = scope.filter(l => l.day >= ms);
  const fresh = (l) => dd(l.created) >= -14;
  const Q = open.filter(l => (l.st === "new" ? fresh(l) : dd(l.last) > -30))
    .filter(l => l.st === "new" || (l.nf && l.nf <= t) || !l.nf || VIEWS.quoted[1](l) || l.sc >= 70 || l.meets.some(m => ymd(m.date) === t))
    .sort((a, b) => prio(b) - prio(a));
  const meetT = scope.flatMap(l => l.meets.filter(m => ymd(m.date) === t).map(m => ({ m, l }))).sort((a, b) => (a.m.time || "").localeCompare(b.m.time || ""));
  const srcT = {}; newT.forEach(l => { srcT[l.source] = (srcT[l.source] || 0) + 1; });
  const ageC = AGE.map(b => [b, open.filter(l => inAge(l, b[0])).length]), ageMax = ageC.reduce((a, x) => a + x[1], 0) || 1;
  const ageCol = ["#2563EB", "#0891B2", "#D97706", "#EA580C", "#DC2626"];
  const fun = [["Enquiries", cm.length], ["Contacted", cm.filter(l => l.st !== "new").length], ["Quoted or later", cm.filter(l => l.st === "quoted" || l.st === "won" || l.quotes.length).length], ["Won", cm.filter(l => l.st === "won").length]];
  const [tp, setTp] = useState(0), [tper, setTper] = useState(10);
  const TQ = Q.slice(Math.min(tp, Math.max(0, Math.ceil(Q.length / tper) - 1)) * tper).slice(0, tper);
  const off = Math.min(tp, Math.max(0, Math.ceil(Q.length / tper) - 1)) * tper;
  return (
    <>
      <h2 className="lt-t">Today<span>.</span></h2>
      <p className="lt-lead">{fdw(new Date())} · <b>{Q.length} leads need action</b>. Ranked by score, urgency and value.</p>
      <div className="lt-fbar" style={{ marginTop: 0 }}>
        <label className="lt-sr" htmlFor="tf-q">Search</label>
        <input id="tf-q" type="search" className="lt-search" placeholder="Search name, company, mobile or requirement" value={tf.q} onChange={e => set("q", e.target.value)} />
        {pick("owner", "Any owner", owners.map(o => [o, o]))}
        {pick("src", "Any source", sources.map(x => [x, x]))}
        {pick("svc", "Any service", SERVICES.map(x => [x, x]))}
        {pick("stage", "Any stage", STAGES.map(x => [x[0], x[1]]))}
        {pick("band", "Any score", [["hot", "Hot (70+)"], ["warm", "Warm (45 to 69)"], ["cold", "Cold (below 45)"]])}
        {tOn && <button type="button" className="lt-btn sm" onClick={() => setTf({ q: "", src: "", svc: "", band: "", stage: "", owner: "" })}>Clear filters</button>}
        {tOn && <span className="lt-note">Showing {scope.length} of {all.length} leads</span>}
      </div>
      <div className="lt-tiles">
        <Tile ic={<User size={17} />} c="#2563EB" bg="#EFF4FF" t="New today" n={newT.length} s={Object.entries(srcT).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(" · ") || "No enquiries yet today"} onClick={() => goView("today_new")} />
        <Tile ic={<Clock size={17} />} c="#DC2626" bg="#FEF2F2" t="Not contacted yet" n={wait.filter(fresh).length} s={<><b className="red">{wait.filter(l => !fresh(l)).length} older than 14 days</b> · reply within 15 min</>} onClick={() => goView("nocontact")} />
        <Tile ic={<Bell size={17} />} c="#7C3AED" bg="#F3EEFF" t="Follow-ups today" n={due.length} s={<><b>{late.length} overdue</b> from earlier days</>} onClick={() => goView(due.length ? "due" : "overdue")} />
        <Tile ic={<FileText size={17} />} c="#D97706" bg="#FFF4E5" t="Quoted, no reply" n={quoted.length} s={`${L(quoted.reduce((a, l) => a + val(l), 0))} waiting on a yes`} onClick={() => goView("quoted")} />
        <Tile ic={<Flame size={17} />} c="#BE123C" bg="#FFE4E6" t="Hot leads" n={hot.length} s={`${L(hot.reduce((a, l) => a + val(l), 0))} in play`} onClick={() => goView("hot")} />
        <Tile ic={<Trophy size={17} />} c="#059669" bg="#ECFDF5" t="Won this month" n={wonM.length} s={`${L(wonM.reduce((a, l) => a + val(l), 0))} · ${pct(cm.filter(l => l.st === "won").length, cm.length)}% of this month's enquiries`} onClick={() => goView("won")} />
      </div>
      <div className="lt-grid2" style={{ marginTop: 14 }}>
        <section className="lt-card">
          <h4>Your list for today <small>{Q.length} leads · highest first</small><span className="lt-sp" /><button type="button" className="lt-btn sm" onClick={() => goView("overdue")}>See all overdue</button></h4>
          {TQ.map((l, j) => {
            const i = off + j;
            const [w, cls] = why(l);
            return (
              <div className="lt-q" key={l.id}>
                <span className="rk">{i + 1}</span><Score l={l} />
                <button type="button" className="x" onClick={() => openLead(l.id)}>
                  <b>{l.name}</b>{l.company && <span className="lt-sub in"> · {l.company}</span>}
                  <span className="lt-sub">{l.svc} · {val(l) ? L(val(l)) : "no budget"} · {l.source}{l.branch ? ` · ${l.branch}` : ""}</span>
                  <span className={`lt-why ${cls}`}>{w}</span>
                </button>
                <span className="lt-av" style={{ background: ownC(l.owner) }} title={l.owner}>{l.owner[0]}</span>
                <a className="lt-btn sm" href={`tel:+91${ph10(l.phone)}`} onClick={() => setTimeout(() => openLead(l.id, "log"), 300)}>Call</a>
                <button type="button" className="lt-btn sm g" onClick={() => openLead(l.id, "wa")}>WhatsApp</button>
                {isOpen(l) && <button type="button" className="lt-btn sm" title="Move the follow-up to tomorrow" onClick={() => run(() => act.follow(l, plusDays(1)), "Moved to tomorrow")}>Later</button>}
              </div>
            );
          })}
          {!Q.length && <div className="lt-empty">Nothing due. Well done.</div>}
          {Q.length > 10 && <Pager total={Q.length} page={tp} per={tper} onPage={setTp} onPer={setTper} sizes={[10, 20, 50]} label="leads" top />}
        </section>
        <div>
          {meetT.length > 0 && (
            <section className="lt-card"><h4>Meetings today <small>{meetT.length}</small></h4>
              {meetT.map(({ m, l }) => (
                <div className="lt-q" key={m._id}><button type="button" className="x" onClick={() => openLead(l.id, "mt")}><b>{m.time || "All day"} · {l.name}</b><span className="lt-sub">{m.title || m.type} · {{ meet: "Google Meet", office: "Office", phone: "Phone" }[m.mode] || m.mode || "Meeting"}{m.done ? " · done" : ""}</span></button><span className="lt-av" style={{ background: ownC(l.owner) }}>{l.owner[0]}</span></div>
              ))}
            </section>
          )}
          <section className="lt-card"><h4>Needs a decision</h4>
            {[[<Copy size={17} />, "#2563EB", "#EFF4FF", "Same number again", "This mobile number enquired before", "dup"],
              [<CalendarDays size={17} />, "#7C3AED", "#F3EEFF", "No follow-up date", "Contacted, but no next date set", "nodate"],
              [<Eraser size={17} />, "#C2410C", "#FFF4E5", "Clean up old leads", "Open but no activity for 30+ days. Close them in bulk", "clean"]].map(([ic, c, bg, t2, s, v]) => (
              <button type="button" className="lt-q btn" key={v} onClick={() => goView(v)}>
                <span className="lt-ic" style={{ background: bg, color: c }}>{ic}</span>
                <span className="x"><b>{t2}</b><span className="lt-sub">{s}</span></span><b className="num">{scope.filter(VIEWS[v][1]).length}</b>
              </button>
            ))}
          </section>
          <section className="lt-card"><h4>Open leads by age <small>{open.length} open</small></h4>
            <div style={{ padding: "14px 16px" }}>
              <div className="lt-ageb">{ageC.map(([b, n], i) => n ? <button type="button" key={b[0]} style={{ width: `${Math.max(6, (n / ageMax) * 100)}%`, background: ageCol[i] }} onClick={() => goView("open", { age: b[0] })} title={`${b[1]}: ${n}`}>{n}</button> : null)}</div>
              <div className="lt-chips" style={{ marginTop: 10 }}>{ageC.map(([b, n], i) => <button type="button" className="lt-chip" key={b[0]} onClick={() => goView("open", { age: b[0] })}><span className="dot" style={{ background: ageCol[i] }} />{b[1]}<i>{n}</i></button>)}</div>
            </div>
          </section>
          <section className="lt-card"><h4>This month's funnel <small>enquiries from {fd(ms)}</small></h4>
            <div className="lt-funnel">{fun.map(([t2, n], i) => <div key={t2}><b>{n}</b><span>{t2}{i ? ` · ${pct(n, fun[0][1])}%` : ""}</span><div className="bar"><i style={{ width: `${pct(n, fun[0][1])}%` }} /></div></div>)}</div>
          </section>
        </div>
      </div>
    </>
  );
}

/* ───────── All leads ───────── */
function List({ rows, scope, filtered: A, f, setF, sort, setSort, page, setPage, sel, setSel, sources, owners, branches, openLead, ownC, act, bulk, exportCsv }) {
  const [more, setMore] = useState(() => FILTER_KEYS.slice(6).some(k => f[k]));
  const nOn = FILTER_KEYS.filter(k => f[k] !== "" && f[k] != null).length;
  const [per, setPer] = useState(50);
  const pages = Math.max(1, Math.ceil(A.length / per)), pg = Math.min(page, pages - 1), P = A.slice(pg * per, pg * per + per);
  const allSel = P.length > 0 && P.every(l => sel.has(l.id));
  const setFl = (k, v) => { setF(x => ({ ...x, [k]: v })); setPage(0); };
  const tog = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sel2 = (k, t, opts) => (
    <><label className="lt-sr" htmlFor={`lf-${k}`}>{t}</label>
      <select id={`lf-${k}`} className="lt-in sm" value={f[k]} onChange={e => setFl(k, e.target.value)}><option value="">{t}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></>
  );
  const [lostR, setLostR] = useState("");
  return (
    <>
      <h2 className="lt-t">All leads<span>.</span></h2>
      <p className="lt-lead">Search {scope.length} leads by name, mobile, company or requirement. Pick a view, filter, then act on many at once.</p>
      <div className="lt-chips">
        {f.view === "today_new" && <button type="button" className="lt-chip on">New today<i>{A.length}</i></button>}
        {Object.entries(VIEWS).map(([k, [t, fn]]) => <button type="button" key={k} className={`lt-chip ${f.view === k ? "on" : ""}`} onClick={() => { setF({ ...f, view: k }); setPage(0); setSel(new Set()); }}>{t}<i>{scope.filter(fn).length}</i></button>)}
      </div>
      <div className="lt-fbar">
        <label className="lt-sr" htmlFor="lt-q">Search leads</label>
        <input id="lt-q" type="search" className="lt-search" placeholder="Search name, mobile, company or requirement" value={f.q} onChange={e => setFl("q", e.target.value)} />
        {sel2("stage", "Any stage", STAGES.map(s => [s[0], s[1]]))}
        {sel2("src", "Any source", sources.map(s => [s, s]))}
        {sel2("svc", "Any service", SERVICES.map(s => [s, s]))}
        {sel2("age", "Any age", AGE.map(b => [b[0], b[1]]))}
        {sel2("band", "Any score", [["hot", "Hot (70+)"], ["warm", "Warm (45 to 69)"], ["cold", "Cold (below 45)"]])}
        <label className="lt-sr" htmlFor="lt-sort">Sort</label>
        <select id="lt-sort" className="lt-in sm" value={sort} onChange={e => setSort(e.target.value)}>
          {[["prio", "Sort: priority"], ["new", "Newest first"], ["old", "Oldest first"], ["val", "Highest value"], ["score", "Highest score"], ["nf", "Next follow-up"]].map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <button type="button" className={`lt-btn sm ${more ? "p" : ""}`} onClick={() => setMore(x => !x)} aria-expanded={more}>More filters{nOn ? ` (${nOn} on)` : ""}</button>
        {nOn > 0 && <button type="button" className="lt-btn sm" onClick={() => { setF({ ...NOF, view: f.view }); setPage(0); }}>Clear filters</button>}
        <span className="lt-sp" />
        <button type="button" className="lt-btn sm" onClick={() => exportCsv(A, "leads-view")} title="The leads in this view with these filters">Export this view ({A.length})</button>
        <button type="button" className="lt-btn sm p" onClick={() => exportCsv(rows, "all-leads")} title="Every lead, no filters">Export all ({rows.length})</button>
      </div>
      {more && (
        <div className="lt-card lt-more">
          <div className="lt-mgrid">
            <div className="lt-f"><label htmlFor="mf-client">Client name or company</label><input id="mf-client" type="search" value={f.client} onChange={e => setFl("client", e.target.value)} placeholder="Ravi, Green Interiors" /></div>
            <div className="lt-f"><label htmlFor="mf-proj">Project or requirement</label><input id="mf-proj" type="search" value={f.project} onChange={e => setFl("project", e.target.value)} placeholder="e-commerce, school app, CRM" /></div>
            <div className="lt-f"><label htmlFor="mf-own">Owner</label><select id="mf-own" value={f.owner} onChange={e => setFl("owner", e.target.value)}><option value="">Everyone</option>{owners.map(o => <option key={o}>{o}</option>)}</select></div>
            <div className="lt-f"><label htmlFor="mf-br">Branch</label><select id="mf-br" value={f.branch} onChange={e => setFl("branch", e.target.value)}><option value="">All branches</option>{branches.map(b => <option key={b}>{b}</option>)}</select></div>
            <div className="lt-f"><label htmlFor="mf-site">Came from</label><select id="mf-site" value={f.site} onChange={e => setFl("site", e.target.value)}><option value="">Anywhere</option><option value="nnc">NNC website and CRM</option><option value="nncdigital">NNC Digital website</option><option value="lead">Added in Projects</option></select></div>
            <div className="lt-f"><label htmlFor="mf-has">Has</label><select id="mf-has" value={f.has} onChange={e => setFl("has", e.target.value)}><option value="">Anything</option><option value="quote">A quotation</option><option value="noquote">No quotation yet</option><option value="meet">A meeting</option><option value="budget">A budget</option><option value="email">An email address</option><option value="balance">A balance due</option></select></div>
            <div className="lt-f"><label htmlFor="mf-vmin">Value from (₹)</label><input id="mf-vmin" type="number" min="0" step="5000" value={f.vmin} onChange={e => setFl("vmin", e.target.value)} placeholder="0" /></div>
            <div className="lt-f"><label htmlFor="mf-vmax">Value up to (₹)</label><input id="mf-vmax" type="number" min="0" step="5000" value={f.vmax} onChange={e => setFl("vmax", e.target.value)} placeholder="Any" /></div>
          </div>
          <div className="lt-drange">
            <div className="lt-f"><label htmlFor="mf-df">Date range on</label><select id="mf-df" value={f.dfield} onChange={e => setFl("dfield", e.target.value)}>{Object.entries(DFIELD).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></div>
            <div className="lt-f"><label htmlFor="mf-from">From</label><input id="mf-from" type="date" value={f.from} max={f.to || undefined} onChange={e => setFl("from", e.target.value)} /></div>
            <div className="lt-f"><label htmlFor="mf-to">To</label><input id="mf-to" type="date" value={f.to} min={f.from || undefined} onChange={e => setFl("to", e.target.value)} /></div>
            <div className="lt-chips">{PRESETS.map(([t, fn]) => { const [a, b] = fn(); return <button type="button" key={t} className={`lt-chip ${f.from === a && f.to === b ? "on" : ""}`} onClick={() => { setF(x => ({ ...x, from: a, to: b })); setPage(0); }}>{t}</button>; })}
              {(f.from || f.to) && <button type="button" className="lt-chip" onClick={() => { setF(x => ({ ...x, from: "", to: "" })); setPage(0); }}>Any date</button>}</div>
          </div>
          <p className="lt-note" style={{ margin: "8px 0 0" }}>Tip: pick <b>Everything</b> above to filter across won and lost leads too. {A.length} leads match.</p>
        </div>
      )}
      <section className="lt-card">
        <Pager total={A.length} page={pg} per={per} onPage={setPage} onPer={setPer} top />
        <div className="lt-tw"><table>
          <thead><tr>
            <th style={{ width: 34 }}><input type="checkbox" checked={allSel} aria-label="Select all on this page" onChange={e => setSel(s => { const n = new Set(s); P.forEach(l => (e.target.checked ? n.add(l.id) : n.delete(l.id))); return n; })} /></th>
            <th>Lead</th><th>Mobile</th><th>Source</th><th>Service</th><th className="r">Value</th><th>Stage</th><th>Score</th><th>Owner</th><th>Age</th><th>Next step</th>
          </tr></thead>
          <tbody>
            {P.map(l => {
              const [w, cls] = why(l);
              return (
                <tr key={l.id} className={`rw ${sel.has(l.id) ? "sel" : ""}`} onClick={() => openLead(l.id)}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(l.id)} onChange={() => tog(l.id)} aria-label={`Select ${l.name}`} /></td>
                  <td className="nm"><b>{l.name}{l.dup && <span className="lt-pill p-blue" style={{ marginLeft: 6 }}>Repeat</span>}</b><span className="lt-sub">{l.company || l.branch}{l.src === "lead" ? " · Projects" : ""}</span></td>
                  <td className="num">{phF(l.phone)}</td><td>{l.source}</td><td>{l.svc}</td>
                  <td className="r num">{val(l) ? L(val(l)) : "-"}</td>
                  <td><span className="lt-pill" style={{ background: `${STC[l.st]}1A`, color: STC[l.st] }}>{STL[l.st]}</span></td>
                  <td><Score l={l} /></td>
                  <td><span className="lt-av" style={{ background: ownC(l.owner) }} title={l.owner}>{l.owner[0]}</span></td>
                  <td className="num">{-dd(l.created) === 0 ? "Today" : `${-dd(l.created)} d`}</td>
                  <td><span className={`lt-why ${cls}`} style={{ margin: 0 }}>{w}</span></td>
                </tr>
              );
            })}
            {!P.length && <tr><td colSpan={11} className="lt-empty">No leads match. Try clearing filters.</td></tr>}
          </tbody>
        </table></div>
        <Pager total={A.length} page={pg} per={per} onPage={setPage} onPer={setPer} />
      </section>
      {sel.size > 0 && (
        <div className="lt-bulk">
          <b>{sel.size} selected</b>
          {sel.size < A.length && <button type="button" className="lt-btn sm" onClick={() => setSel(new Set(A.map(l => l.id)))}>Select all {A.length} in this view</button>}
          <span className="lt-sp" />
          <label className="lt-sr" htmlFor="lb-own">Assign</label>
          <select id="lb-own" value="" onChange={e => { const o = e.target.value; if (o) bulk(`assigned to ${o}`, l => act.owner(l, o)); }}>
            <option value="">Assign to…</option>{owners.filter(o => o !== "Unassigned").map(o => <option key={o}>{o}</option>)}
          </select>
          <label className="lt-sr" htmlFor="lb-st">Stage</label>
          <select id="lb-st" value="" onChange={e => { const s = e.target.value; if (s) bulk(`moved to ${STL[s]}`, l => act.stage(l, s)); }}>
            <option value="">Move to stage…</option>{OPEN.map(s => <option key={s} value={s}>{STL[s]}</option>)}
          </select>
          <button type="button" className="lt-btn sm" onClick={() => bulk(`set to follow up on ${fd(plusDays(7))}`, l => act.follow(l, plusDays(7)))}>Follow up next week</button>
          <label className="lt-sr" htmlFor="lb-lost">Mark lost</label>
          <select id="lb-lost" value={lostR} onChange={e => { const r = e.target.value; setLostR(""); if (r) bulk(`marked lost`, l => act.lost(l, r)); }}>
            <option value="">Mark lost…</option>{LOST.map(r => <option key={r}>{r}</option>)}
          </select>
          <button type="button" className="lt-btn sm" onClick={() => exportCsv([...sel].map(id => A.find(l => l.id === id)).filter(Boolean))}>Export</button>
          <button type="button" className="lt-btn sm" onClick={() => setSel(new Set())}>Clear</button>
          <span className="lt-sub" style={{ color: "#CBD5E1", width: "100%" }}>Bulk changes save one lead at a time.</span>
        </div>
      )}
    </>
  );
}
const LOST = ["Not responding", "Budget too low", "Went with another agency", "Just enquiring", "Timeline not suitable", "Did it in-house", "Project cancelled", "Wrong number or spam"];

/* ───────── Pipeline ───────── */
function Board({ scope, openLead, ownC, act, run, drag, setDrag, over, setOver, goView }) {
  const ms = TODAY().slice(0, 8) + "01";
  const drop = (st) => {
    const l = scope.find(x => x.id === drag);
    setDrag(null); setOver("");
    if (!l || l.st === st) return;
    if (st === "lost") return openLead(l.id, "lost");
    run(() => act.stage(l, st), `${l.name} moved to ${STL[st]}`);
  };
  return (
    <>
      <h2 className="lt-t">Pipeline<span>.</span></h2>
      <p className="lt-lead">Drag a card to change its stage. Each column shows its 25 highest scoring leads. Won and Lost show this month only.</p>
      <div className="lt-board">
        {STAGES.map(([c]) => {
          let A = scope.filter(l => l.st === c);
          if (c === "won") A = A.filter(l => l.wonDate >= ms);
          if (c === "lost") A = A.filter(l => l.lostDate >= ms);
          A.sort((a, b) => b.sc - a.sc);
          return (
            <div key={c} className={`lt-col ${over === c ? "over" : ""}`} onDragOver={e => { if (drag) { e.preventDefault(); setOver(c); } }} onDragLeave={() => setOver("")} onDrop={e => { e.preventDefault(); drop(c); }}>
              <h5>{STL[c]}<span>{A.length}</span></h5><div className="cv">{L(A.reduce((a, l) => a + val(l), 0))}</div>
              {A.slice(0, 25).map(l => (
                <div key={l.id} className="lt-kc" draggable={l.src === "enq"} onDragStart={() => setDrag(l.id)} onClick={() => openLead(l.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") openLead(l.id); }}>
                  <b>{l.name}</b><span className="lt-sub">{l.svc}{l.company ? ` · ${l.company}` : ""}</span>
                  <div className="m"><span>{val(l) ? L(val(l)) : "-"}</span><span style={{ display: "flex", gap: 6, alignItems: "center" }}><Score l={l} /><span className="lt-av xs" style={{ background: ownC(l.owner) }}>{l.owner[0]}</span></span></div>
                </div>
              ))}
              {A.length > 25 && <button type="button" className="lt-btn sm" onClick={() => goView("all", { stage: c })}>View all {A.length}</button>}
              {!A.length && <span className="lt-sub" style={{ textAlign: "center", padding: 12 }}>Nothing here</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ───────── Clients ───────── */
function Clients({ scope, openLead, ownC, cf, setCf }) {
  const W = scope.filter(l => l.st === "won");
  const q = cf.q.toLowerCase();
  let A = W.filter(l => !q || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || (q.replace(/\D/g, "").length >= 4 && ph10(l.phone).includes(q.replace(/\D/g, ""))));
  const m = (l) => l.money || { total: 0, received: 0, balance: 0 };
  if (cf.f === "due") A = A.filter(l => m(l).balance > 0);
  if (cf.f === "paid") A = A.filter(l => m(l).total > 0 && m(l).balance <= 0);
  A.sort(cf.s === "bal" ? (a, b) => m(b).balance - m(a).balance : cf.s === "new" ? (a, b) => (b.wonDate || "").localeCompare(a.wonDate || "") : (a, b) => m(b).total - m(a).total);
  const tb = W.reduce((a, l) => a + m(l).total, 0), tr = W.reduce((a, l) => a + m(l).received, 0);
  const cper = cf.per || 50, cp = Math.min(cf.p, Math.max(0, Math.ceil(A.length / cper) - 1));
  const P = A.slice(cp * cper, cp * cper + cper);
  return (
    <>
      <h2 className="lt-t">Clients<span>.</span></h2>
      <p className="lt-lead">Every lead you won, with the project value, what was received and the balance. Open a client for the full history.</p>
      <div className="lt-kp">
        <div><span>Clients</span><b>{W.length}</b></div>
        <div><span>Total business</span><b>{L(tb)}</b><small>incl. GST where applicable</small></div>
        <div><span>Received</span><b style={{ color: "var(--ok)" }}>{L(tr)}</b></div>
        <div><span>Balance due</span><b style={{ color: "var(--red)" }}>{L(tb - tr)}</b><small>{W.filter(l => m(l).balance > 0).length} clients</small></div>
      </div>
      <div className="lt-fbar">
        <label className="lt-sr" htmlFor="lt-cq">Search clients</label>
        <input id="lt-cq" type="search" className="lt-search" placeholder="Search client, company or mobile" value={cf.q} onChange={e => setCf({ ...cf, q: e.target.value, p: 0 })} />
        <div className="lt-chips">{[["all", "All"], ["due", "Balance due"], ["paid", "Fully paid"]].map(([k, t]) => <button type="button" key={k} className={`lt-chip ${cf.f === k ? "on" : ""}`} onClick={() => setCf({ ...cf, f: k, p: 0 })}>{t}</button>)}</div>
        <label className="lt-sr" htmlFor="lt-cs">Sort</label>
        <select id="lt-cs" className="lt-in sm" value={cf.s} onChange={e => setCf({ ...cf, s: e.target.value })}>{[["biz", "Biggest business"], ["bal", "Highest balance"], ["new", "Newest client"]].map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
      </div>
      <section className="lt-card">
        <div className="lt-tw"><table>
          <thead><tr><th>Client</th><th>Service</th><th>Won on</th><th>Project stage</th><th className="r">Total</th><th className="r">Received</th><th className="r">Balance</th><th className="r">Meetings</th><th className="r">Quotations</th><th>Owner</th></tr></thead>
          <tbody>
            {P.map(l => (
              <tr key={l.id} className="rw" onClick={() => openLead(l.id, "tx")}>
                <td className="nm"><b>{l.company || l.name}</b><span className="lt-sub">{l.company ? l.name : l.branch} · {phF(l.phone)}</span></td>
                <td>{l.svc}</td><td className="num">{fd(l.wonDate)}</td><td>{l.lead?.projectStage || <span className="lt-sub">Not started</span>}</td>
                <td className="r num"><b>{L(m(l).total)}</b></td><td className="r num" style={{ color: "var(--ok)" }}>{L(m(l).received)}</td>
                <td className="r num">{m(l).balance > 0 ? <b style={{ color: "var(--amb)" }}>{L(m(l).balance)}</b> : <span className="lt-sub">{m(l).total ? "Paid" : "-"}</span>}</td>
                <td className="r num">{l.meets.length}</td><td className="r num">{l.quotes.length}</td>
                <td><span className="lt-av" style={{ background: ownC(l.owner) }} title={l.owner}>{l.owner[0]}</span></td>
              </tr>
            ))}
            {!P.length && <tr><td colSpan={10} className="lt-empty">No clients match.</td></tr>}
          </tbody>
        </table></div>
        <Pager total={A.length} page={cp} per={cper} onPage={p => setCf(c => ({ ...c, p }))} onPer={n => setCf(c => ({ ...c, per: n, p: 0 }))} label="clients" />
      </section>
    </>
  );
}

/* ───────── Sources ───────── */
function period(per) {
  const d = new Date();
  if (per === "month") return [TODAY().slice(0, 8) + "01", TODAY()];
  if (per === "lmonth") return [ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), ymd(new Date(d.getFullYear(), d.getMonth(), 0))];
  if (per === "q") return [plusDays(-89), TODAY()];
  if (per === "y") return [plusDays(-364), TODAY()];
  return ["2000-01-01", TODAY()];
}
const PERS = [["month", "This month"], ["lmonth", "Last month"], ["q", "Last 90 days"], ["y", "Last 12 months"], ["all", "All time"]];
function PerSeg({ per, setPer }) {
  const [a, b] = period(per);
  return <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}><div className="lt-seg">{PERS.map(([k, t]) => <button type="button" key={k} className={per === k ? "on" : ""} onClick={() => setPer(k)}>{t}</button>)}</div>{per !== "all" && <span className="lt-note">{fd(a)} to {fd(b)}</span>}</div>;
}
function Sources({ scope, per, setPer }) {
  const [a, b] = period(per), P = scope.filter(l => l.day >= a && l.day <= b);
  const srcs = [...new Set(P.map(l => l.source))];
  const rows = srcs.map(s => {
    const A = P.filter(l => l.source === s), w = A.filter(l => l.st === "won"), fr = A.filter(l => l.fr != null);
    return { s, n: A.length, c: A.filter(l => l.st !== "new").length, frm: fr.length ? Math.round(fr.reduce((x, l) => x + l.fr, 0) / fr.length) : null, qd: A.filter(l => l.quotes.length || l.st === "quoted").length, w: w.length, lost: A.filter(l => l.st === "lost").length, rev: w.reduce((x, l) => x + val(l), 0), open: A.filter(isOpen).length };
  }).sort((x, y) => y.n - x.n);
  const mx = Math.max(1, ...rows.map(r => r.n));
  const won = P.filter(l => l.st === "won");
  const mon = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - i, 1), e = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
    const A = scope.filter(l => l.day >= ymd(s) && l.day <= ymd(e));
    mon.push([s.toLocaleDateString("en-IN", { month: "short" }), A.length, A.filter(l => l.st === "won").length]);
  }
  const mm = Math.max(1, ...mon.map(m => m[1]));
  const RB = [["Within 15 min", l => l.fr != null && l.fr <= 15], ["16 to 60 min", l => l.fr > 15 && l.fr <= 60], ["1 to 24 hours", l => l.fr > 60 && l.fr <= 1440], ["Over a day", l => l.fr > 1440], ["No reply logged", l => l.fr == null]]
    .map(([t, fn]) => { const A = P.filter(l => l.src === "enq" && fn(l)); return [t, A.length, A.filter(l => l.st === "won").length]; });
  const svcR = SERVICES.map(s => { const A = P.filter(l => l.svc === s), w = A.filter(l => l.st === "won"); return [s, A.length, w.length, w.reduce((x, l) => x + val(l), 0)]; }).filter(r => r[1]).sort((x, y) => y[1] - x[1]);
  const best = rows.filter(r => r.n >= 10).sort((x, y) => y.w / y.n - x.w / x.n)[0], worst = rows.filter(r => r.n >= 10).sort((x, y) => x.w / x.n - y.w / y.n)[0];
  return (
    <>
      <h2 className="lt-t">Sources<span>.</span></h2>
      <p className="lt-lead">Which channels bring leads that become clients. Counted for leads that came in during the period.</p>
      <PerSeg per={per} setPer={setPer} />
      <div className="lt-kp">
        <div><span>Leads</span><b>{P.length}</b></div>
        <div><span>Won</span><b>{won.length}</b><small>{pct(won.length, P.length)}% conversion</small></div>
        <div><span>Value won</span><b>{L(won.reduce((x, l) => x + val(l), 0))}</b></div>
        <div><span>Still open</span><b>{P.filter(isOpen).length}</b></div>
        <div><span>Lost</span><b>{P.filter(l => l.st === "lost").length}</b></div>
      </div>
      <section className="lt-card"><h4>By source</h4>
        <div className="lt-tw"><table>
          <thead><tr><th>Source</th><th style={{ minWidth: 150 }}>Leads</th><th className="r">Contacted</th><th className="r">Avg first reply</th><th className="r">Quoted</th><th className="r">Won</th><th className="r">Lost</th><th className="r">Conversion</th><th className="r">Value won</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.s}>
              <td><b className="nmb">{r.s}</b>{r.open > 0 && <span className="lt-sub">{r.open} still open</span>}</td>
              <td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="lt-sbar" style={{ flex: 1 }}><i style={{ width: `${(r.n / mx) * 100}%` }} /></span><span className="num">{r.n}</span></span></td>
              <td className="r num">{pct(r.c, r.n)}%</td><td className="r num">{fmin(r.frm)}</td><td className="r num">{r.qd}</td><td className="r num">{r.w}</td><td className="r num">{r.lost}</td>
              <td className="r num"><b style={{ color: r.n && r.w / r.n >= 0.12 ? "var(--ok)" : r.n && r.w / r.n < 0.05 ? "var(--red)" : "var(--navy)" }}>{r.n ? ((r.w / r.n) * 100).toFixed(1) : 0}%</b></td>
              <td className="r num">{L(r.rev)}</td>
            </tr>
          ))}{!rows.length && <tr><td colSpan={9} className="lt-empty">No leads in this period.</td></tr>}</tbody>
        </table></div>
      </section>
      <div className="lt-grid2">
        <section className="lt-card"><h4>Leads and clients won by month <small>last 12 months</small></h4>
          <div style={{ padding: "14px 16px" }}>
            <svg viewBox="0 0 640 200" width="100%" role="img" aria-label="Leads and won by month">
              {mon.map((m, i) => { const x = 20 + i * 51, h = (m[1] / mm) * 150, hw = m[2] ? Math.max(2, (m[2] / mm) * 150) : 0; return (
                <g key={i}><rect x={x} y={170 - h} width="34" height={h} rx="4" fill="#C7D8FF"><title>{`${m[0]}: ${m[1]} leads, ${m[2]} won`}</title></rect><rect x={x + 8} y={170 - hw} width="18" height={hw} rx="3" fill="#059669" />
                  <text x={x + 17} y="188" fontSize="11" fill="#64748B" textAnchor="middle">{m[0]}</text>{m[1] > 0 && <text x={x + 17} y={165 - h} fontSize="10" fill="#334155" textAnchor="middle">{m[1]}</text>}</g>); })}
            </svg>
            <span className="lt-note"><span className="lt-key" style={{ background: "#C7D8FF" }} /> leads &nbsp; <span className="lt-key" style={{ background: "#059669" }} /> won</span>
          </div>
        </section>
        <section className="lt-card"><h4>What the numbers say</h4>
          {per === "month" && <div className="lt-ins"><i>!</i><span>Most of this month's leads are still open, so conversion looks low. Use Last 90 days to judge sources.</span></div>}
          {best && best.w > 0 && <div className="lt-ins"><i>1</i><span><b>{best.s}</b> converts best: {((best.w / best.n) * 100).toFixed(1)}% of its leads become clients.</span></div>}
          {worst && worst !== best && <div className="lt-ins"><i>2</i><span><b>{worst.s}</b> converts lowest ({((worst.w / worst.n) * 100).toFixed(1)}% of {worst.n} leads).</span></div>}
          <div className="lt-ins"><i>3</i><span>{RB[4][1]} of {P.filter(l => l.src === "enq").length} enquiries have no reply logged. Log calls and WhatsApps on the lead so reply time and conversion are measured.</span></div>
          {svcR[0] && <div className="lt-ins"><i>4</i><span>Most asked for: <b>{svcR[0][0]}</b>, {svcR[0][1]} leads and {svcR[0][2]} won.</span></div>}
        </section>
      </div>
      <div className="lt-grid2">
        <section className="lt-card"><h4>First reply time and conversion <small>website and CRM enquiries</small></h4>
          <div className="lt-tw"><table><thead><tr><th>First reply</th><th className="r">Leads</th><th className="r">Won</th><th className="r">Conversion</th></tr></thead>
            <tbody>{RB.map(r => <tr key={r[0]}><td>{r[0]}</td><td className="r num">{r[1]}</td><td className="r num">{r[2]}</td><td className="r num"><b>{pct(r[2], r[1])}%</b></td></tr>)}</tbody></table></div>
        </section>
        <section className="lt-card"><h4>By service</h4>
          <div className="lt-tw"><table><thead><tr><th>Service</th><th className="r">Leads</th><th className="r">Won</th><th className="r">Value won</th></tr></thead>
            <tbody>{svcR.map(r => <tr key={r[0]}><td>{r[0]}</td><td className="r num">{r[1]}</td><td className="r num">{r[2]}</td><td className="r num">{L(r[3])}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </>
  );
}

/* ───────── Team ───────── */
function Team({ rows, owners, ownC, per, setPer }) {
  const [a, b] = period(per);
  const C = owners.map(o => {
    const A = rows.filter(l => l.owner === o), P = A.filter(l => l.day >= a && l.day <= b), fr = P.filter(l => l.fr != null), w = A.filter(l => l.st === "won" && l.wonDate >= a && l.wonDate <= b);
    return { o, open: A.filter(isOpen).length, n: P.length, frm: fr.length ? Math.round(fr.reduce((x, l) => x + l.fr, 0) / fr.length) : null, nc: A.filter(l => l.st === "new").length, over: A.filter(l => isOpen(l) && l.nf && l.nf < TODAY()).length, nodate: A.filter(VIEWS.nodate[1]).length, q: A.filter(l => l.st === "quoted"), w: w.length, rev: w.reduce((x, l) => x + val(l), 0), cv: pct(P.filter(l => l.st === "won").length, P.length) };
  });
  const row = (t, k, fmt = x => x) => <tr key={t}><td>{t}</td>{C.map(c => <td key={c.o} className="r num"><b>{fmt(c[k])}</b></td>)}</tr>;
  return (
    <>
      <h2 className="lt-t">Team<span>.</span></h2>
      <p className="lt-lead">Who is carrying what, how fast each person replies and what converts.</p>
      <PerSeg per={per} setPer={setPer} />
      <section className="lt-card"><div className="lt-tw"><table>
        <thead><tr><th />{C.map(c => <th key={c.o} className="r"><span className="lt-av" style={{ background: ownC(c.o), marginRight: 6 }}>{c.o[0]}</span>{c.o}</th>)}</tr></thead>
        <tbody>
          {row("Open leads now", "open")}{row("New leads in period", "n")}{row("Average first reply", "frm", fmin)}{row("Not contacted yet", "nc")}{row("Follow-ups overdue", "over")}{row("Contacted, no follow-up date", "nodate")}
          <tr><td>Quotations waiting</td>{C.map(c => <td key={c.o} className="r num"><b>{c.q.length}</b><span className="lt-sub">{L(c.q.reduce((x, l) => x + val(l), 0))}</span></td>)}</tr>
          {row("Won in period", "w")}{row("Value won", "rev", L)}{row("Conversion of new leads", "cv", x => `${x}%`)}
        </tbody>
      </table></div></section>
      <p className="lt-note">Leads with no owner show as Unassigned. Assign them from All leads (select, then Assign to).</p>
    </>
  );
}

