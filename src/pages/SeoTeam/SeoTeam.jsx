import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { billingApi } from "../ProjectBilling/billingMeta";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import {
  seoApi, T, ds, fd, fds, fdw, inr, inr2, num, pct, initials, waPhone, TYPES, ROLE,
  weekOf, monthOf, period, PER, inP, workdaysIn, adsAgg, kwStat, posTxt, posVal, dist, BUCKETS, downloadCsv, copy, greet, parse, addD,
} from "./seoUtil";
import { WorkForm, AdsForm, AdsView, KeywordView, RankForm, KeywordAdd, ClientForm, MemberForm , TeamPick } from "./SeoForms";
import "./SeoTeam.css";

const TABS = [["today", "Today"], ["work", "Work log"], ["ads", "Google Ads"], ["ranks", "Keyword positions"], ["history", "Activity history"], ["reports", "PDF reports"], ["clients", "Clients and settings"]];

export default function SeoTeam() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today");
  const [who, setWho] = useState("all");
  const [modal, setModal] = useState(null); // { kind, ...props }
  const [sel, setSel] = useState({ kc: "", hc: "", rc: "", ac: "" }); // client picked in ranks / history / reports / ads

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const j = await seoApi("/all"); setRaw(j.data); }
    catch (err) { setError(err.status === 403 ? "You don't have access to the SEO and Ads team." : err.message || "Could not load"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Normalise ids and dates (YYYY-MM-DD) once
  const D = useMemo(() => {
    if (!raw) return null;
    const team = raw.team.map(t => ({ ...t, id: String(t._id) }));
    const clients = raw.clients.map(c => ({
      ...c, id: String(c._id), start: ds(c.start), seo: c.seo ? String(c.seo) : "", ads: c.ads ? String(c.ads) : "", design: c.design ? String(c.design) : "",
      // the team; older clients only had the three single fields
      members: (c.members?.length ? c.members.map(String) : [...new Set([c.seo, c.ads, c.design].filter(Boolean).map(String))]),
      phone: c.phone || c.lead?.phone || "", email: c.email || c.lead?.email || "",
    }));
    const work = raw.work.map(w => ({ ...w, id: String(w._id), date: ds(w.date), cid: String(w.client), who: w.who ? String(w.who) : "" }));
    const ads = raw.ads.map(r => ({ ...r, id: String(r._id), date: ds(r.date), cid: String(r.client), who: r.who ? String(r.who) : "" }));
    const kws = {};
    raw.keywords.forEach(k => {
      (kws[String(k.client)] ||= []).push({ ...k, id: String(k._id), added: ds(k.added), hist: (k.hist || []).map(h => ({ ...h, date: ds(h.date) })).sort((a, b) => a.date.localeCompare(b.date)) });
    });
    return { team, clients, work, ads, kws, logo: raw.settings?.logo || "" };
  }, [raw]);

  if (!D) {
    return (
      <div className="seo-layout"><Sidebar /><div className="seo"><div className="seo-app">
        {error ? <div className="empty err">{error}</div> : <div className="empty">{loading ? "Loading…" : ""}</div>}
      </div></div></div>
    );
  }

  const client = (id) => D.clients.find(c => c.id === id);
  const person = (id) => D.team.find(t => t.id === id);
  const av = (id) => { const p = person(id); return p ? <span key={id} className="av" style={{ background: ROLE[p.role][1] }} title={p.name}>{initials(p.name)}</span> : null; };
  const active = D.clients.filter(c => c.isActive !== false);
  const mineC = (c) => who === "all" || c.members.includes(who) || [c.seo, c.ads, c.design].includes(who);
  const ctx = { D, client, person, av, mineC, active, who, setModal, load, setTab, sel, setSel };
  const pend = active.filter(c => c.ads && mineC(c) && !D.ads.some(r => r.cid === c.id && r.date === T(0))).length;
  const done = (msg) => { setModal(null); if (msg) toast.success(msg); load(); };

  return (
    <div className="seo-layout">
      <Sidebar />
      <div className="seo">
        <div className="seo-app">
          <header className="hd noprint">
            <h1><Search size={20} color="#2563EB" /> SEO and Ads Team</h1>
            <nav className="tabs" aria-label="Sections">
              {TABS.map(([k, t]) => (
                <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => { setTab(k); window.scrollTo(0, 0); }}>
                  {t}{k === "today" && pend > 0 && <em>{pend}</em>}
                </button>
              ))}
            </nav>
            <span className="sp" />
            <select value={who} onChange={e => setWho(e.target.value)} aria-label="View as">
              <option value="all">Whole team</option>
              {D.team.filter(t => t.portal !== false && t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name} · {(t.roles?.length ? t.roles : [t.role]).map(r => ROLE[r]?.[0] || r).join(", ")}</option>)}
            </select>
            <button type="button" className="btn ic" onClick={load} aria-label="Refresh"><RefreshCw size={14} className={loading ? "spin" : ""} /></button>
            <span className="sub sd-own">The team logs work and sends reports from the Employee Portal. Here you assign, set targets and follow up.</span>
          </header>

          {error && <div className="empty err">{error}</div>}
          <main className="view">
            {!active.length && tab !== "clients" ? (
              <div className="card"><div className="empty">
                No SEO or Ads clients yet. Add your team members and clients in <b>Clients and settings</b> to start.<br />
                <button type="button" className="btn pri" style={{ marginTop: 12 }} onClick={() => setTab("clients")}>Go to Clients and settings</button>
              </div></div>
            ) : (
              <>
                {tab === "today" && <TodayView {...ctx} />}
                {tab === "work" && <WorkView {...ctx} />}
                {tab === "ads" && <AdsTab {...ctx} />}
                {tab === "ranks" && <RanksView {...ctx} />}
                {tab === "history" && <HistoryView {...ctx} />}
                {tab === "reports" && <ReportsView {...ctx} />}
                {tab === "clients" && <ClientsView {...ctx} />}
              </>
            )}
          </main>
          <p className="note noprint" style={{ marginTop: 18 }}>Live CRM data. Search terms and spend come from the Google Ads export you upload each day.</p>
        </div>
      </div>

      {modal?.kind === "work" && <WorkForm {...ctx} cid={modal.cid} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "ads" && <AdsForm {...ctx} cid={modal.cid} onClose={() => setModal(null)} onSaved={(r) => { load(); setModal({ kind: "adsview", id: String(r._id), fresh: r }); }} />}
      {modal?.kind === "adsview" && <AdsView {...ctx} id={modal.id} fresh={modal.fresh} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "kw" && <KeywordView {...ctx} kw={modal.kw} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "rank" && <RankForm {...ctx} cid={modal.cid} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "kwadd" && <KeywordAdd {...ctx} cid={modal.cid} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "client" && <ClientForm {...ctx} edit={modal.edit} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "member" && <MemberForm {...ctx} edit={modal.edit} onClose={() => setModal(null)} onSaved={done} />}
    </div>
  );
}

/* ───────── shared bits ───────── */
const Chk = ({ ok, late, children }) => <span className={`chk ${ok ? "ok" : late ? "late" : "no"}`}><i>{ok ? "✓" : late ? "!" : ""}</i>{children}</span>;
const Chg = ({ g }) => (g > 0 ? <span className="up">▲ {g}</span> : g < 0 ? <span className="down">▼ {-g}</span> : <span className="sub" style={{ display: "inline" }}>0</span>);
function Spark({ H, w = 120, h = 30 }) {
  if (!H.length) return <span className="sub">-</span>;
  const pts = H.map((x, i) => [(i / Math.max(1, H.length - 1)) * w, ((posVal(x.pos) - 1) / 100) * h]);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline fill="none" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" points={pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#2563EB" />
    </svg>
  );
}
function ClientSelect({ list, value, onChange, label = "Client", allLabel }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
      {allLabel && <option value="">{allLabel}</option>}
      {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
function WorkTable({ L, client, av, canDelete, onChanged }) {
  if (!L.length) return <div className="empty">Nothing logged.</div>;
  const toggle = async (w) => {
    try { await seoApi(`/work/${w.id}`, { method: "PUT", body: { status: w.status === "live" ? "pending" : "live" } }); onChanged?.(); }
    catch (err) { toast.error(err.message); }
  };
  const del = async (w) => {
    if (!window.confirm("Delete this entry?")) return;
    try { await seoApi(`/work/${w.id}`, { method: "DELETE" }); onChanged?.(); } catch (err) { toast.error(err.message); }
  };
  return (
    <div className="tw"><table><thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Details</th><th>Link</th><th>By</th><th>Status</th>{canDelete && <th />}</tr></thead><tbody>
      {L.map(w => (
        <tr key={w.id}>
          <td className="num">{fds(w.date)}</td>
          <td>{client(w.cid)?.name || "-"}</td>
          <td><span className={`pill p-${w.type}`}>{TYPES[w.type]}</span></td>
          <td>{w.title}{w.kw ? <span className="sub">Keyword: {w.kw}{w.da ? ` · DA ${w.da}` : ""}</span> : w.platform ? <span className="sub">{w.platform}</span> : null}</td>
          <td>{w.url ? <a className="url" href={w.url} target="_blank" rel="noopener noreferrer">{w.url.replace(/^https?:\/\//, "")}</a> : <span className="sub">-</span>}</td>
          <td>{av(w.who)}</td>
          <td><button type="button" className={`pill ${w.status === "live" ? "p-ok" : "p-amb"}`} onClick={() => toggle(w)} title="Click to change">{w.status === "live" ? "Live" : "Pending"}</button></td>
          {canDelete && <td className="r"><button type="button" className="btn sm" onClick={() => del(w)} aria-label="Delete">✕</button></td>}
        </tr>
      ))}
    </tbody></table></div>
  );
}

/* ───────── TODAY ───────── */
function TodayView({ D, client, av, mineC, active, who, setModal, setTab, setSel, load }) {
  const C = active.filter(mineC), wk = weekOf(T(0)), mo = monthOf(T(0));
  const adsC = C.filter(c => c.ads);
  const sent = adsC.filter(c => D.ads.some(r => r.cid === c.id && r.date === T(0) && r.sent));
  const todayW = D.work.filter(w => w.date === T(0) && (who === "all" || w.who === who));
  const hr = new Date().getHours();
  const rows = C.map(c => {
    const W = D.work.filter(w => w.cid === c.id);
    const bt = Math.ceil((c.targets?.backlink || 0) / Math.max(1, workdaysIn(mo)));
    const m = c.ads ? adsAgg(D.ads.filter(r => r.cid === c.id && inP(r, mo))) : null;
    return {
      c, bt, m,
      bToday: W.filter(w => w.type === "backlink" && w.date === T(0)).length,
      gW: W.filter(w => w.type === "gmb" && inP(w, wk)).length, gt: Math.ceil((c.targets?.gmb || 0) / 4.3),
      blM: W.filter(w => w.type === "blog" && inP(w, mo)).length,
      poM: W.filter(w => w.type === "poster" && inP(w, mo)).length,
      adsDay: c.ads ? D.ads.find(r => r.cid === c.id && r.date === T(0)) : null,
    };
  });
  const dayOfMonth = parse(T(0)).getDate();
  const member = (id) => D.team.find(t => t.id === id);
  // A message in the Employee Portal to whoever is behind on this client
  const remind = async (r) => {
    const todo = [];
    if (r.c.ads && !r.adsDay?.sent) todo.push({ who: r.c.ads, t: "today's Google Ads report" });
    if (r.bToday < r.bt) todo.push({ who: r.c.seo, t: `backlinks (${r.bToday} of ${r.bt} today)` });
    if (r.gW < r.gt) todo.push({ who: r.c.seo, t: `GMB posts (${r.gW} of ${r.gt} this week)` });
    if (r.blM < (r.c.targets?.blog || 0)) todo.push({ who: r.c.seo, t: `blogs (${r.blM} of ${r.c.targets?.blog || 0} this month)` });
    if (r.poM < (r.c.targets?.poster || 0)) todo.push({ who: r.c.design, t: `posters (${r.poM} of ${r.c.targets?.poster || 0} this month)` });
    // everyone on the client's team is reminded of everything pending
    const by = {};
    const people = [...new Set([...r.c.members, ...todo.map(x => x.who)].filter(Boolean))];
    people.forEach(id => { const m = member(id); if (m?.account) by[m.account] = { name: m.name, items: todo.map(x => x.t) }; });
    const L = Object.entries(by);
    if (!L.length) { toast.error(todo.length ? "The people on this client have no Employee Portal login" : "Nothing pending for this client"); return; }
    try {
      await Promise.all(L.map(([acc, v]) => billingApi(`/portal/admin/messages/${acc}`, { method: "POST", body: { refName: r.c.name, text: `Hi ${v.name.split(" ")[0]}, a reminder for ${r.c.name}: please complete ${v.items.join(", ")}. Thank you.` } })));
      toast.success(`Reminder sent to ${L.map(([, v]) => v.name).join(" and ")}`);
    } catch (e) { toast.error(e.message); }
  };
  return (
    <>
      <h2 className="t">Today<span>.</span></h2>
      <p className="lead">{fdw(T(0))} · <b>{sent.length} of {adsC.length} Google Ads reports sent</b> · {todayW.length} work items logged today</p>
      <div className="kpis">
        <div className="kpi"><span className="l">Ads reports to clients today</span><span className={`v ${sent.length < adsC.length && hr >= 18 ? "red" : sent.length < adsC.length ? "amb" : "ok"}`}>{sent.length} / {adsC.length}</span><span className="s">Send by 7 pm every working day</span></div>
        <div className="kpi"><span className="l">Backlinks today</span><span className="v">{todayW.filter(w => w.type === "backlink").length}</span><span className="s">Target {rows.reduce((a, r) => a + r.bt, 0)} across clients</span></div>
        <div className="kpi"><span className="l">GMB posts this week</span><span className="v">{rows.reduce((a, r) => a + r.gW, 0)}</span><span className="s">Target {rows.reduce((a, r) => a + r.gt, 0)}</span></div>
        <div className="kpi"><span className="l">Blogs this month</span><span className="v">{rows.reduce((a, r) => a + r.blM, 0)}</span><span className="s">Target {C.reduce((a, c) => a + (c.targets?.blog || 0), 0)}</span></div>
        <div className="kpi"><span className="l">Ad spend this month</span><span className="v">{inr(rows.reduce((a, r) => a + (r.m ? r.m.spend : 0), 0))}</span><span className="s">{rows.reduce((a, r) => a + (r.m ? r.m.conv : 0), 0)} leads so far</span></div>
      </div>
      <div className="card"><h3>Client checklist for today <small>green done · grey pending · red overdue</small></h3>
        <div className="tw"><table><thead><tr><th>Client</th><th>Team</th><th>Google Ads report</th><th>Backlinks today</th><th>GMB this week</th><th>Blogs this month</th><th>Posters this month</th><th>Ad budget used</th><th className="r" /></tr></thead><tbody>
          {rows.map(r => (
            <tr key={r.c.id}>
              <td><button type="button" className="link" onClick={() => { setSel(s => ({ ...s, rc: r.c.id })); setTab("reports"); }}>{r.c.name}</button><span className="sub">{r.c.site}</span></td>
              <td><span className="who">{r.c.members.map(id => av(id))}</span></td>
              <td>{r.c.ads
                ? r.adsDay?.sent ? <Chk ok>Sent</Chk>
                  : r.adsDay ? <button type="button" className="btn sm" onClick={() => setModal({ kind: "adsview", id: r.adsDay.id })}>Ready, not sent · View</button>
                    : <span className={`pill ${hr >= 18 ? "p-red" : "p-grey"}`}>{hr >= 18 ? "Late" : "Not sent yet"}{member(r.c.ads) ? ` · ${member(r.c.ads).name.split(" ")[0]}` : ""}</span>
                : <span className="sub">No ads</span>}</td>
              <td><Chk ok={r.bToday >= r.bt}>{r.bToday} of {r.bt}</Chk></td>
              <td><Chk ok={r.gW >= r.gt}>{r.gW} of {r.gt}</Chk></td>
              <td><Chk ok={r.blM >= (r.c.targets?.blog || 0)} late={r.blM < ((r.c.targets?.blog || 0) * dayOfMonth) / 30 - 1}>{r.blM} of {r.c.targets?.blog || 0}</Chk></td>
              <td><Chk ok={r.poM >= (r.c.targets?.poster || 0)}>{r.poM} of {r.c.targets?.poster || 0}</Chk></td>
              <td style={{ minWidth: 150 }}>{r.m && r.c.budget ? (
                <><span className="ub"><span className={`bar ${pct(r.m.spend, r.c.budget) > pct(dayOfMonth, 30) + 12 ? "red" : ""}`}><i style={{ width: `${Math.min(100, pct(r.m.spend, r.c.budget))}%` }} /></span><span className="num" style={{ fontSize: 12 }}>{pct(r.m.spend, r.c.budget)}%</span></span>
                  <span className="sub">{inr(r.m.spend)} of {inr(r.c.budget)}</span></>
              ) : <span className="sub">-</span>}</td>
              <td className="r"><button type="button" className="btn sm" onClick={() => remind(r)} title="Message the person responsible in the Employee Portal">Remind</button></td>
            </tr>
          ))}
        </tbody></table></div>
      </div>
      <div className="card"><h3>Logged today <small>{todayW.length} items</small><button type="button" className="btn sm" onClick={() => setTab("work")}>Full work log</button></h3>
        <WorkTable L={todayW.slice(0, 15)} client={client} av={av} onChanged={load} />
      </div>
    </>
  );
}

/* ───────── WORK LOG ───────── */
function WorkView({ D, client, av, who, load }) {
  const [f, setF] = useState({ per: "week", cid: "", type: "", who: "", q: "" });
  const P = period(f.per);
  let L = D.work.filter(w => inP(w, P));
  if (who !== "all") L = L.filter(w => w.who === who);
  if (f.cid) L = L.filter(w => w.cid === f.cid);
  if (f.type) L = L.filter(w => w.type === f.type);
  if (f.who) L = L.filter(w => w.who === f.who);
  if (f.q) { const q = f.q.toLowerCase(); L = L.filter(w => `${w.url} ${w.title} ${w.kw}`.toLowerCase().includes(q)); }
  L = [...L].sort((a, b) => b.date.localeCompare(a.date));
  const cnt = (k) => L.filter(w => w.type === k).length;
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <h2 className="t">Work log<span>.</span></h2>
      <p className="lead">Every backlink, blog, GMB post and poster with its link. {PER[f.per]}: <b>{L.length} items</b>.</p>
      <div className="kpis">{["backlink", "blog", "gmb", "poster"].map(k => (
        <div key={k} className="kpi"><span className="l">{TYPES[k]}s</span><span className="v">{cnt(k)}</span><span className="s">{L.filter(w => w.type === k && w.status === "pending").length} pending to go live</span></div>
      ))}</div>
      <div className="filters">
        <select value={f.per} onChange={set("per")} aria-label="Period">{Object.entries(PER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.cid} onChange={set("cid")} aria-label="Client"><option value="">All clients</option>{D.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={f.type} onChange={set("type")} aria-label="Type"><option value="">All types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.who} onChange={set("who")} aria-label="Person"><option value="">Everyone</option>{D.team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <input type="search" value={f.q} onChange={set("q")} placeholder="Search link, title or keyword" style={{ minWidth: 220 }} aria-label="Search" />
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => { copy(L.map(w => w.url).filter(Boolean).join("\n")); toast.success(`${L.length} links copied`); }}>Copy links</button>
        <button type="button" className="btn" onClick={() => downloadCsv([["Date", "Client", "Type", "Title", "Keyword", "DA", "URL", "By", "Status"],
          ...L.map(w => [w.date, client(w.cid)?.name, TYPES[w.type], w.title, w.kw, w.da || "", w.url, D.team.find(t => t.id === w.who)?.name || "", w.status])], "seo-work-log.csv")}>Export CSV</button>
      </div>
      <div className="card">
        <WorkTable L={L.slice(0, 200)} client={client} av={av} canDelete onChanged={load} />
        {L.length > 200 && <div className="empty">Showing 200 of {L.length}. Narrow the filters to see the rest.</div>}
      </div>
    </>
  );
}

/* ───────── GOOGLE ADS ───────── */
function AdsTab({ D, client, av, mineC, active, setModal, sel, setSel }) {
  const C = active.filter(c => c.ads && mineC(c));
  const L = D.ads.filter(r => (!sel.ac || r.cid === sel.ac) && C.some(c => c.id === r.cid)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  const now = parse(T(0));
  const pace = (now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100;
  return (
    <>
      <h2 className="t">Google Ads<span>.</span></h2>
      <p className="lead">Daily reports with spend and search terms. Upload the search terms export from Google Ads, and the summary for the client is written for you.</p>
      {!C.length && <div className="card"><div className="empty">No client has a Google Ads expert assigned. Set one in Clients and settings.</div></div>}
      <div className="kpis">{C.map(c => {
        const m = adsAgg(D.ads.filter(r => r.cid === c.id && inP(r, monthOf(T(0))))), u = pct(m.spend, c.budget);
        return (
          <div key={c.id} className="kpi"><span className="l">{c.name}</span><span className="v" style={{ fontSize: 19 }}>{inr(m.spend)}</span>
            {c.budget ? <span className="ub"><span className={`bar ${u > pace + 12 ? "red" : u < pace - 15 ? "amb" : "ok"}`}><i style={{ width: `${Math.min(100, u)}%` }} /></span><span className="num" style={{ fontSize: 12 }}>{u}%</span></span> : null}
            <span className="s">{c.budget ? `of ${inr(c.budget)} · ` : ""}{m.conv} leads · {m.conv ? `${inr(m.cpl)} per lead` : "no leads yet"}</span></div>
        );
      })}</div>
      {C.length > 0 && <p className="note" style={{ margin: "-6px 0 0" }}>Bar colour: <span style={{ color: "var(--ok)" }}>green</span> on pace for the month, <span style={{ color: "var(--red)" }}>red</span> spending too fast, <span style={{ color: "var(--amb)" }}>amber</span> under-spending.</p>}
      <div className="filters">
        <ClientSelect list={C} value={sel.ac} onChange={v => setSel(s => ({ ...s, ac: v }))} allLabel="All ad clients" />
        <span style={{ flex: 1 }} />
        <span className="note">Daily reports are made and sent by the Google Ads expert from the Employee Portal.</span>
      </div>
      <div className="card"><div className="tw"><table><thead><tr><th>Date</th><th>Client</th><th className="r">Spent</th><th className="r">Clicks</th><th className="r">CTR</th><th className="r">Avg CPC</th><th className="r">Leads</th><th className="r">Cost per lead</th><th>Search terms</th><th>By</th><th className="r">Report</th></tr></thead><tbody>
        {L.map(r => {
          const s = adsAgg([r]);
          return (
            <tr key={r.id}>
              <td className="num">{fdw(r.date)}</td><td>{client(r.cid)?.name}</td>
              <td className="r num b">{inr(r.spend)}</td><td className="r num">{num(r.clicks)}</td><td className="r num">{s.ctr.toFixed(2)}%</td><td className="r num">{inr2(s.cpc)}</td>
              <td className="r num b">{r.conv}</td><td className="r num">{r.conv ? inr(s.cpl) : "-"}</td>
              <td>{(r.terms || []).length} terms{s.waste.length > 0 && <span className="sub" style={{ color: "var(--red)" }}>{inr(s.waste.reduce((a, t) => a + t.cost, 0))} on {s.waste.length} with no lead</span>}</td>
              <td>{av(r.who)}</td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                <button type="button" className="btn sm" onClick={() => setModal({ kind: "adsview", id: r.id })}>View</button>{" "}
                {r.sent ? <span className="pill p-ok">Sent</span> : <span className="pill p-grey">Not sent</span>}
              </td>
            </tr>
          );
        })}
        {!L.length && <tr><td colSpan={11} className="empty">No reports yet.</td></tr>}
      </tbody></table></div></div>
    </>
  );
}

/* ───────── KEYWORD POSITIONS ───────── */
function RanksView({ D, active, mineC, setModal, sel, setSel }) {
  const C = active.filter(mineC);
  const cid = C.some(c => c.id === sel.kc) ? sel.kc : C[0]?.id;
  const c = C.find(x => x.id === cid);
  if (!c) return <div className="card"><div className="empty">No clients for this view.</div></div>;
  const K = D.kws[c.id] || [];
  const rows = K.map(e => ({ e, s: kwStat(e) })).sort((a, b) => (a.s ? posVal(a.s.cur.pos) : 999) - (b.s ? posVal(b.s.cur.pos) : 999));
  const withHist = K.filter(e => e.hist.length);
  const d0 = dist(withHist, s => s.first), d1 = dist(withHist, s => s.cur);
  const avg = (x) => { const L = rows.filter(r => r.s).map(r => x(r.s).pos).filter(p => p != null); return L.length ? (L.reduce((a, b) => a + b, 0) / L.length).toFixed(1) : "-"; };
  const lastCheck = withHist.reduce((m, e) => (e.hist[e.hist.length - 1].date > m ? e.hist[e.hist.length - 1].date : m), "");
  return (
    <>
      <h2 className="t">Keyword positions<span>.</span></h2>
      <p className="lead">Google position for every agreed keyword, tracked from day 1 ({fd(c.start)}). Position 1 is the top of Google; 100+ means not in the first 100 results.</p>
      <div className="filters">
        <ClientSelect list={C} value={cid} onChange={v => setSel(s => ({ ...s, kc: v }))} />
        <span className="note">Started {fd(c.start)} · {K.length} keywords{lastCheck ? ` · last checked ${fds(lastCheck)}` : " · not checked yet"}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => setModal({ kind: "kwadd", cid: c.id })}>+ Agreed keyword</button>
        <span className="note">Rank checks are done by the SEO analyst in the Employee Portal.</span>
      </div>
      <div className="kpis">
        {BUCKETS.map(b => {
          const diff = d1[b] - d0[b];
          const good = b === "100+" || b === "31 to 100" ? diff < 0 : diff > 0;
          return (
            <div key={b} className="kpi"><span className="l">{b === "100+" ? "Not in top 100" : b}</span><span className={`v ${b === "100+" ? "" : "ok"}`}>{d1[b]}</span>
              <span className="s">Day 1: {d0[b]} {diff ? <span style={{ color: good ? "var(--ok)" : "var(--red)" }}>({diff > 0 ? "▲" : "▼"} {Math.abs(diff)})</span> : null}</span></div>
          );
        })}
        <div className="kpi"><span className="l">Average position (ranked keywords)</span><span className="v">{avg(s => s.cur)}</span><span className="s">Day 1: {avg(s => s.first)}</span></div>
      </div>
      <div className="card"><h3>Agreed keywords <small>click a keyword for its full history</small></h3>
        <div className="tw"><table><thead><tr><th>Keyword</th><th className="r">Day 1</th><th className="r">30 days ago</th><th className="r">7 days ago</th><th className="r">Now</th><th className="r">Change since day 1</th><th className="r">Best</th><th>Trend since day 1</th><th>Ranking page</th></tr></thead><tbody>
          {rows.map(({ e, s }) => (
            <tr key={e.id}>
              <td><button type="button" className="link" onClick={() => setModal({ kind: "kw", kw: e })}>{e.keyword}</button><span className="sub">Tracked since {fds(e.added)}</span></td>
              {s ? (
                <>
                  <td className="r num">{posTxt(s.first.pos)}</td><td className="r num">{posTxt(s.mo.pos)}</td><td className="r num">{posTxt(s.wk.pos)}</td>
                  <td className="r num"><span className={`pill ${s.cur.pos != null && s.cur.pos <= 10 ? "p-ok" : s.cur.pos != null && s.cur.pos <= 30 ? "p-amb" : "p-grey"}`} style={{ fontSize: 13 }}>{posTxt(s.cur.pos)}</span></td>
                  <td className="r num"><Chg g={s.gain} /></td>
                  <td className="r num">{posTxt(s.best.pos)}<span className="sub">{fds(s.best.date)}</span></td>
                  <td><Spark H={e.hist} /></td>
                  <td>{s.cur.url ? <a className="url" style={{ maxWidth: 200 }} href={s.cur.url} target="_blank" rel="noopener noreferrer">{s.cur.url.replace(/^https?:\/\//, "")}</a> : <span className="sub">-</span>}</td>
                </>
              ) : <td colSpan={8} className="sub">No position yet. Add it with “+ Rank check”.</td>}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9} className="empty">No agreed keywords yet. Click “+ Agreed keyword”.</td></tr>}
        </tbody></table></div>
      </div>
      <p className="note" style={{ margin: 0 }}>Enter positions from your rank tracker or Search Console with “+ Rank check” (you can paste the export).</p>
    </>
  );
}

/* ───────── ACTIVITY HISTORY ───────── */
function HistoryView({ D, active, mineC, av, sel, setSel, setTab }) {
  const C = active.filter(mineC);
  const cid = C.some(c => c.id === sel.hc) ? sel.hc : C[0]?.id;
  const c = C.find(x => x.id === cid);
  const [ht, setHt] = useState("");
  const [hm, setHm] = useState("");
  if (!c) return <div className="card"><div className="empty">No clients for this view.</div></div>;
  const ev = [];
  if (ht !== "ads" && ht !== "rank") D.work.filter(w => w.cid === c.id && (!ht || w.type === ht)).forEach(w => ev.push({ date: w.date, kind: w.type, w, key: w.id }));
  if (!ht || ht === "ads") D.ads.filter(r => r.cid === c.id).forEach(r => ev.push({ date: r.date, kind: "ads", r, key: r.id }));
  if (!ht || ht === "rank") (D.kws[c.id] || []).forEach(e => e.hist.forEach((h, i) => {
    const p = e.hist[i - 1]; if (!p) return;
    [10, 3, 1].forEach(m => { if (posVal(h.pos) <= m && posVal(p.pos) > m) ev.push({ date: h.date, kind: "rank", k: e.keyword, m, pos: h.pos, key: `${e.id}${h.date}${m}` }); });
  }));
  ev.sort((a, b) => b.date.localeCompare(a.date));
  const months = {};
  ev.forEach(e => { (months[e.date.slice(0, 7)] ||= []).push(e); });
  const mk = Object.keys(months);
  const cur = mk.includes(hm) ? hm : mk[0];
  const mlabel = (m) => parse(`${m}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const mx = Math.max(1, ...mk.map(m => months[m].filter(e => e.kind !== "ads").length));
  const line = (e) => {
    if (e.kind === "ads") return <div key={e.key}><span className="d">{fds(e.date)}</span><span className="pill p-ads">Ads</span><span className="x">Spent {inr(e.r.spend)} · {e.r.clicks} clicks · {e.r.conv} leads{e.r.negs?.length ? ` · blocked: ${e.r.negs.join(", ")}` : ""}{e.r.notes ? ` · ${e.r.notes}` : ""}</span>{av(e.r.who)}</div>;
    if (e.kind === "rank") return <div key={e.key}><span className="d">{fds(e.date)}</span><span className="pill p-ok">Ranking</span><span className="x"><b>{e.k}</b> entered the {e.m === 1 ? "number 1 spot" : `top ${e.m}`} (position {e.pos})</span></div>;
    const w = e.w;
    return <div key={e.key}><span className="d">{fds(e.date)}</span><span className={`pill p-${w.type}`}>{TYPES[w.type]}</span><span className="x">{w.title}{w.kw ? ` · ${w.kw}` : ""}{w.url && <><br /><a href={w.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>{w.url}</a></>}</span>{av(w.who)}</div>;
  };
  return (
    <>
      <h2 className="t">Activity history<span>.</span></h2>
      <p className="lead">Everything done for <b>{c.name}</b> since day 1 ({fd(c.start)}): {ev.length} activities.</p>
      <div className="filters">
        <ClientSelect list={C} value={cid} onChange={v => { setSel(s => ({ ...s, hc: v })); setHm(""); }} />
        <select value={ht} onChange={e => { setHt(e.target.value); setHm(""); }} aria-label="Type">
          <option value="">All activity</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}s</option>)}
          <option value="ads">Google Ads days</option><option value="rank">Ranking milestones</option>
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => { setSel(s => ({ ...s, rc: c.id, rp: "all" })); setTab("reports"); }}>Full history report</button>
      </div>
      <div className="cols">
        <section className="card n"><h3>By month</h3>
          {mk.map(m => {
            const E = months[m], n = (k) => E.filter(e => e.kind === k).length, tot = E.filter(e => e.kind !== "ads").length;
            const sp = E.filter(e => e.kind === "ads").reduce((a, e) => a + e.r.spend, 0), cv = E.filter(e => e.kind === "ads").reduce((a, e) => a + e.r.conv, 0);
            return (
              <button key={m} type="button" className={`mrow${m === cur ? " on" : ""}`} onClick={() => setHm(m)}>
                <span className="mtop"><b>{mlabel(m)}</b><span className="num b">{tot}</span></span>
                <span className="bar"><i style={{ width: `${pct(tot, mx)}%` }} /></span>
                <span className="sub">{n("backlink")} backlinks · {n("blog")} blogs · {n("gmb")} GMB · {n("poster")} posters{sp ? ` · ${inr(sp)} ads, ${cv} leads` : ""}{n("rank") ? ` · ${n("rank")} ranking wins` : ""}</span>
              </button>
            );
          })}
          {!mk.length && <div className="empty">Nothing yet.</div>}
        </section>
        <section className="card w"><h3>{cur ? mlabel(cur) : ""} <small>{(months[cur] || []).length} activities</small></h3>
          <div className="ll flat">{(months[cur] || []).map(line)}{!(months[cur] || []).length && <div className="empty">Nothing this month.</div>}</div>
        </section>
      </div>
    </>
  );
}

/* ───────── PDF REPORTS ───────── */
function ReportsView({ D, active, mineC, client, person, av, sel, setSel, who }) {
  const [mode, setMode] = useState("client");
  const rp = sel.rp || "week";
  const C = active.filter(mineC);
  const rc = C.some(c => c.id === sel.rc) ? sel.rc : C[0]?.id;
  const c = client(rc);
  const P = rp === "all" && c ? [c.start, T(0)] : period(rp === "all" ? "month" : rp);
  const shareWa = () => {
    const txt = repText(c, P, rp, D);
    window.open(`https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
    toast.success("Summary opened in WhatsApp. Attach the PDF from Download PDF.");
  };
  return (
    <>
      <h2 className="t noprint">PDF reports<span>.</span></h2>
      <p className="lead noprint">Weekly, monthly or full since-day-1 reports with your logo. “Download PDF” opens the print window: choose “Save as PDF”.</p>
      <div className="filters noprint">
        <div className="seg"><button type="button" className={`chip${mode === "client" ? " on" : ""}`} onClick={() => setMode("client")}>By client</button><button type="button" className={`chip${mode === "team" ? " on" : ""}`} onClick={() => setMode("team")}>By team member</button></div>
        {mode === "client" && <ClientSelect list={C} value={rc} onChange={v => setSel(s => ({ ...s, rc: v }))} />}
        <select value={rp} onChange={e => setSel(s => ({ ...s, rp: e.target.value }))} aria-label="Period">
          {["week", "lweek", "month", "lmonth"].map(k => <option key={k} value={k}>{k.includes("month") ? "Monthly" : "Weekly"}: {PER[k].toLowerCase()} ({fds(period(k)[0])} to {fds(period(k)[1])})</option>)}
          {mode === "client" && <option value="all">Full report since day 1</option>}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => window.print()}>Download PDF</button>
        {mode === "client" && c && <button type="button" className="btn wa" onClick={shareWa}>Share summary on WhatsApp</button>}
      </div>
      {mode === "client"
        ? (c ? <ClientReport D={D} c={c} P={P} rp={rp} person={person} /> : <div className="empty">No client.</div>)
        : <TeamReport D={D} P={rp === "all" ? period("month") : P} rp={rp} who={who} client={client} av={av} mineC={mineC} />}
    </>
  );
}

function Logo({ src, size = 46 }) {
  return src ? <img src={src} alt="Nakshatra Namaha Creations" style={{ height: size, maxWidth: 180, objectFit: "contain" }} /> : <div className="lg" style={{ width: size, height: size }}>NNC</div>;
}

function ClientReport({ D, c, P, rp, person }) {
  const W = D.work.filter(w => w.cid === c.id && inP(w, P));
  const A = D.ads.filter(r => r.cid === c.id && inP(r, P));
  const s = adsAgg(A);
  const isAll = rp === "all", isM = rp.includes("month");
  const f = isAll ? Math.max(1, Math.round((parse(P[1]) - parse(P[0])) / 864e5) / 30) : isM ? 1 : 0.25;
  const cnt = (k) => W.filter(w => w.type === k).length;
  const tgt = (k) => Math.round((c.targets?.[k] || 0) * f);
  const elapsed = P[1] > T(0) ? workdaysIn([P[0], T(0)]) / Math.max(1, workdaysIn(P)) : 1;
  const exp = (k) => Math.round(tgt(k) * elapsed);
  const Tile = ({ k, l }) => (
    <div className="tile"><div className="l">{l}</div><div className="v">{cnt(k)}</div>
      <div className="s">Target {tgt(k)}{elapsed < 1 ? ` · expected by today ${exp(k)}${cnt(k) >= exp(k) ? " (on track)" : " (behind)"}` : ` · ${pct(cnt(k), tgt(k))}%`}</div>
      <div className={`bar ${cnt(k) >= tgt(k) ? "ok" : "amb"}`} style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, pct(cnt(k), tgt(k)))}%` }} /></div></div>
  );
  const List = ({ k, max }) => {
    const L = W.filter(w => w.type === k).sort((a, b) => b.date.localeCompare(a.date));
    if (!L.length) return <p className="note">None in this period.</p>;
    return (
      <div className="ll">
        {L.slice(0, max).map(w => (
          <div key={w.id}><span className="d">{fds(w.date)}</span><span className="x"><b style={{ fontWeight: 500 }}>{w.title}</b>{w.kw ? ` · ${w.kw}` : ""}{w.url && <><br /><a href={w.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>{w.url}</a></>}</span>{w.da ? <span className="pill p-grey">DA {w.da}</span> : null}</div>
        ))}
        {L.length > max && <div className="note">+ {L.length - max} more (export from the Work log)</div>}
      </div>
    );
  };
  // Spend chart: daily, or weekly for long periods
  const days = [];
  for (let d = parse(P[0]); d <= parse(P[1]) && d <= parse(T(0)); d = new Date(d.getTime() + 864e5)) days.push(d);
  let per = days.map(d => { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; const r = A.filter(x => x.date === k); return { d: k, sp: r.reduce((a, x) => a + x.spend, 0), cv: r.reduce((a, x) => a + x.conv, 0) }; });
  const weekly = per.length > 45;
  if (weekly) { const g = {}; per.forEach(x => { const k = weekOf(x.d)[0]; (g[k] ||= { d: k, sp: 0, cv: 0 }); g[k].sp += x.sp; g[k].cv += x.cv; }); per = Object.values(g); }
  const mx = Math.max(1, ...per.map(x => x.sp)), mc = Math.max(1, ...per.map(x => x.cv));
  const W0 = 760, H0 = 170, bw = Math.max(3, Math.min(28, W0 / Math.max(1, per.length) - 6));
  // Same days of the previous week / month, for the % change
  let P2 = rp === "week" ? period("lweek") : rp === "month" ? period("lmonth") : null;
  if (P2 && P[1] > T(0)) { const n = Math.round((parse(T(0)) - parse(P[0])) / 864e5); P2 = [P2[0], addD(P2[0], n)]; }
  const prev = P2 ? adsAgg(D.ads.filter(r => r.cid === c.id && inP(r, P2))) : null;
  const Ch = ({ a, b, inv }) => {
    if (!prev || !b) return null;
    const d = Math.round(((a - b) / b) * 100), good = inv ? d < 0 : d > 0;
    return <span className="s" style={{ color: d === 0 ? "var(--muted)" : good ? "var(--ok)" : "var(--red)" }}>{d > 0 ? "+" : ""}{d}% vs same days last {rp.includes("month") ? "month" : "week"}</span>;
  };
  const K = (D.kws[c.id] || []).filter(e => e.hist.length);
  const krows = K.map(e => ({ e, s: kwStat(e, P) })).sort((a, b) => posVal(a.s.cur.pos) - posVal(b.s.cur.pos));
  const d0 = dist(K, x => x.first), d1 = dist(K, x => x.cur);
  const title = isAll ? "Full SEO and Google Ads report since day 1" : isM ? "Monthly SEO and Google Ads report" : "Weekly SEO and Google Ads report";
  return (
    <article className="rep" id="seo-rep">
      <div className="rh">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}><Logo src={D.logo} size={52} /><div><h2>{c.name}<span>.</span></h2><p>{title} · {fd(P[0])} to {fd(P[1])}</p></div></div>
        <div style={{ textAlign: "right" }}><p style={{ margin: 0, fontSize: 13, color: "var(--navy)", fontWeight: 600 }}>{c.site}</p>
          <p className="note" style={{ margin: 0 }}>{c.seo ? `SEO: ${person(c.seo)?.name || ""}` : ""}{c.ads ? ` · Ads: ${person(c.ads)?.name || ""}` : ""}</p></div>
      </div>
      <div className="pb"><h4>Work done</h4><div className="tiles"><Tile k="backlink" l="Backlinks built" /><Tile k="blog" l="Blogs published" /><Tile k="gmb" l="GMB posts" /><Tile k="poster" l="Posters designed" /></div></div>
      {krows.length > 0 && (
        <div className="pb"><h4>Keyword positions on Google</h4>
          <p className="note" style={{ margin: "-4px 0 10px" }}>Tracked from day 1 ({fd(c.start)}). {krows.filter(r => r.s.pgain > 0).length} of {krows.length} keywords improved during this period.</p>
          <div className="tiles">{["Top 3", "Top 10", "Top 30", "100+"].map(b => <div key={b} className="tile"><div className="l">{b === "100+" ? "Not in top 100" : b}</div><div className="v">{d1[b]}</div><div className="s">Day 1: {d0[b]}</div></div>)}</div>
          <table className="terms rt" style={{ minWidth: 0, marginTop: 10 }}><thead><tr><th>Keyword</th><th className="r">Day 1</th><th className="r">Start of period</th><th className="r">{P[1] < T(0) ? "End of period" : "Now"}</th><th className="r">This period</th><th className="r">Since day 1</th><th>Trend</th></tr></thead><tbody>
            {krows.map(({ e, s: k }) => <tr key={e.id}><td>{e.keyword}</td><td className="r num">{posTxt(k.first.pos)}</td><td className="r num">{posTxt(k.ps.pos)}</td><td className="r num b">{posTxt(k.cur.pos)}</td><td className="r"><Chg g={k.pgain} /></td><td className="r"><Chg g={k.gain} /></td><td><Spark H={e.hist} w={90} h={22} /></td></tr>)}
          </tbody></table>
        </div>
      )}
      {c.ads && (
        <div className="pb"><h4>Google Ads</h4>
          <div className="tiles">
            <div className="tile"><div className="l">Amount spent</div><div className="v">{inr(s.spend)}</div><Ch a={s.spend} b={prev?.spend} /></div>
            <div className="tile"><div className="l">Clicks</div><div className="v">{num(s.clicks)}</div><div className="s">CTR {s.ctr.toFixed(2)}%</div></div>
            <div className="tile"><div className="l">Leads</div><div className="v">{s.conv}</div><Ch a={s.conv} b={prev?.conv} /></div>
            <div className="tile"><div className="l">Cost per lead</div><div className="v">{s.conv ? inr(s.cpl) : "-"}</div><Ch a={s.cpl} b={prev?.cpl} inv /></div>
            <div className="tile"><div className="l">Avg cost per click</div><div className="v">{inr2(s.cpc)}</div></div>
          </div>
          {A.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <svg className="chart" viewBox={`0 0 ${W0} ${H0 + 30}`} role="img" aria-label="Ad spend and leads">
                <line x1="0" y1={H0} x2={W0} y2={H0} stroke="#E5E9F0" />
                {per.map((x, i) => {
                  const cx = i * (W0 / per.length) + W0 / per.length / 2, h = (x.sp / mx) * (H0 - 20);
                  return (
                    <g key={x.d}>
                      <rect x={cx - bw / 2} y={H0 - h} width={bw} height={h} rx="3" fill="#C7D7FE"><title>{fds(x.d)}: {inr(x.sp)}, {x.cv} leads</title></rect>
                      {x.cv > 0 && <circle cx={cx} cy={H0 - (x.cv / mc) * (H0 - 30) - 6} r="5" fill="#059669" />}
                      {(per.length <= 10 || i % 3 === 0) && <text x={cx} y={H0 + 18} fontSize="11" textAnchor="middle" fill="#64748B">{weekly ? fds(x.d) : parse(x.d).getDate()}</text>}
                    </g>
                  );
                })}
              </svg>
              <p className="note" style={{ margin: 0 }}>Blue bars: {weekly ? "weekly" : "daily"} spend. Green dots: leads that {weekly ? "week" : "day"}.</p>
            </div>
          )}
          <div className="g2" style={{ marginTop: 12, alignItems: "start" }}>
            <div><h4 style={{ fontSize: 13 }}>Searches that brought leads</h4><div className="ll">{s.terms.filter(t => t.conv).slice(0, 6).map(t => <div key={t.t}><span className="x">{t.t}</span><b>{t.conv} lead{t.conv > 1 ? "s" : ""}</b><span className="note">{inr(t.cost)}</span></div>)}{!s.terms.some(t => t.conv) && <div className="note">None</div>}</div></div>
            <div><h4 style={{ fontSize: 13 }}>Irrelevant searches blocked</h4><div className="ll">{s.negs.slice(0, 8).map(n => <div key={n}><span className="x">{n}</span></div>)}{!s.negs.length && <div className="note">None added</div>}</div></div>
          </div>
        </div>
      )}
      <div><h4>Backlinks ({cnt("backlink")})</h4><List k="backlink" max={isAll ? 40 : isM ? 25 : 15} /></div>
      <div className="g2" style={{ alignItems: "start" }}><div><h4>Blogs ({cnt("blog")})</h4><List k="blog" max={10} /></div><div><h4>GMB posts ({cnt("gmb")})</h4><List k="gmb" max={10} /></div></div>
      <div><h4>Posters ({cnt("poster")})</h4><List k="poster" max={10} /></div>
      <p className="note" style={{ margin: 0 }}>Prepared by Nakshatra Namaha Creations · nakshatranamahacreations.com</p>
    </article>
  );
}

function repText(c, P, rp, D) {
  const W = D.work.filter(w => w.cid === c.id && inP(w, P));
  const s = adsAgg(D.ads.filter(r => r.cid === c.id && inP(r, P)));
  const n = (k) => W.filter(w => w.type === k).length;
  const K = (D.kws[c.id] || []).filter(e => e.hist.length).map(e => kwStat(e));
  const t10 = K.filter(x => x.cur.pos != null && x.cur.pos <= 10).length, t10f = K.filter(x => x.first.pos != null && x.first.pos <= 10).length;
  return `${greet()}, here is your ${rp === "all" ? "progress" : rp.includes("month") ? "monthly" : "weekly"} summary for ${c.name} (${fds(P[0])} to ${fds(P[1])}):

SEO work done
  • Backlinks built: ${n("backlink")}
  • Blogs published: ${n("blog")}
  • GMB posts: ${n("gmb")}
  • Posters designed: ${n("poster")}
${c.ads ? `
Google Ads
  • Amount spent: ${inr(s.spend)}
  • Clicks: ${num(s.clicks)} (CTR ${s.ctr.toFixed(2)}%)
  • Leads: ${s.conv}${s.conv ? ` at ${inr(s.cpl)} per lead` : ""}
  • Top searches: ${s.terms.filter(t => t.conv).slice(0, 3).map(t => t.t).join(", ") || "none yet"}
` : ""}${K.length ? `
Keyword positions
  • ${t10} of ${K.length} agreed keywords on Google page 1 (day 1: ${t10f})
  • ${K.filter(x => x.gain > 0).length} keywords improved since we started
` : ""}
The full report with every link and the keyword positions is attached as a PDF.

Regards,
SEO and Ads team, Nakshatra Namaha Creations`;
}

function TeamReport({ D, P, rp, who, client, av, mineC }) {
  const T1 = D.team.filter(t => (who === "all" || t.id === who) && t.portal !== false && t.isActive !== false);
  const wdE = Math.max(1, workdaysIn([P[0], P[1] < T(0) ? P[1] : T(0)])), el = wdE / Math.max(1, workdaysIn(P));
  const isM = rp.includes("month");
  return (
    <article className="rep" id="seo-rep">
      <div className="rh"><div style={{ display: "flex", gap: 14, alignItems: "center" }}><Logo src={D.logo} size={46} /><div><h2>Team summary<span>.</span></h2><p>{fd(P[0])} to {fd(P[1])} · {workdaysIn(P)} working days{el < 1 ? ` (${wdE} so far)` : ""}</p></div></div></div>
      <div className="tw"><table><thead><tr><th>Team member</th><th className="r">Backlinks</th><th className="r">Blogs</th><th className="r">GMB posts</th><th className="r">Posters</th><th className="r">Ads reports</th><th className="r">Ad spend managed</th><th className="r">Leads from ads</th><th>Clients</th><th className="r">Per working day</th></tr></thead><tbody>
        {T1.map(t => {
          const W = D.work.filter(w => w.who === t.id && inP(w, P)), A = D.ads.filter(r => r.who === t.id && inP(r, P)), s = adsAgg(A);
          const n = (k) => W.filter(w => w.type === k).length;
          const cl = [...new Set(W.map(w => w.cid).concat(A.map(a => a.cid)))].map(id => client(id)?.name).filter(Boolean);
          return (
            <tr key={t.id}>
              <td><span className="who">{av(t.id)}<span><b style={{ fontWeight: 500 }}>{t.name}</b><span className="sub">{ROLE[t.role][0]}</span></span></span></td>
              <td className="r num">{n("backlink") || "-"}</td><td className="r num">{n("blog") || "-"}</td><td className="r num">{n("gmb") || "-"}</td><td className="r num">{n("poster") || "-"}</td>
              <td className="r num">{A.length || "-"}</td><td className="r num">{A.length ? inr(s.spend) : "-"}</td><td className="r num">{A.length ? s.conv : "-"}</td>
              <td style={{ maxWidth: 240 }}><span className="sub" style={{ color: "var(--text)" }}>{cl.join(", ") || "-"}</span></td>
              <td className="r num b">{((W.length + A.length) / wdE).toFixed(1)} items</td>
            </tr>
          );
        })}
        {!T1.length && <tr><td colSpan={10} className="empty">No team members yet.</td></tr>}
      </tbody></table></div>
      <div className="tiles">{D.clients.filter(c => c.isActive !== false && mineC(c)).map(c => {
        const W = D.work.filter(w => w.cid === c.id && inP(w, P)), f = isM ? 1 : 0.25;
        const tot = ["backlink", "blog", "gmb", "poster"].reduce((a, k) => a + Math.round((c.targets?.[k] || 0) * f), 0);
        const ex = Math.max(1, Math.round(tot * el)), p = pct(W.length, ex);
        return <div key={c.id} className="tile"><div className="l">{c.name}</div><div className="v">{p}%</div><div className="s">{W.length} done · {ex} expected by today · {tot} for the {isM ? "month" : "week"}</div><div className={`bar ${p >= 100 ? "ok" : p < 70 ? "red" : "amb"}`} style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, p)}%` }} /></div></div>;
      })}</div>
    </article>
  );
}

/* ───────── CLIENTS AND SETTINGS ───────── */
function ClientsView({ D, setModal, load }) {
  const save = async (c, body) => {
    try { await seoApi(`/clients/${c.id}`, { method: "PUT", body }); toast.success("Saved"); load(); }
    catch (err) { toast.error(err.message || "Save failed"); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Remove ${c.name}? If work is logged for them, they are only marked inactive.`)) return;
    try { const j = await seoApi(`/clients/${c.id}`, { method: "DELETE" }); toast.success(j.deactivated ? "Marked inactive (work kept)" : "Removed"); load(); }
    catch (err) { toast.error(err.message); }
  };
  const onLogo = (file) => {
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error("Logo must be under 500 KB"); return; }
    const rd = new FileReader();
    rd.onload = async () => {
      try { await seoApi("/settings", { method: "PUT", body: { logo: rd.result } }); toast.success("Logo saved. It appears on every report."); load(); }
      catch (err) { toast.error(err.message); }
    };
    rd.readAsDataURL(file);
  };
  const Num = ({ c, k, step = 1 }) => {
    const top = k === "budget" || k === "metaBudget";
    const v = top ? c[k] : c.targets?.[k];
    return <input className="mini num" type="number" min="0" step={step} defaultValue={v} key={`${c.id}${k}${v}`} aria-label={k}
      onBlur={e => Number(e.target.value) !== Number(v) && save(c, top ? { [k]: Number(e.target.value) } : { targets: { [k]: Number(e.target.value) } })} />;
  };
  return (
    <>
      <h2 className="t">Clients and settings<span>.</span></h2>
      <p className="lead">Monthly targets per client and who handles them. The Today checklist and reports measure against these.</p>

      <div className="card"><h3>Team <small>{D.team.filter(t => t.portal !== false && t.isActive !== false).length} active · from Employee Portal</small></h3>
        <div className="tw"><table style={{ minWidth: 560 }}><thead><tr><th>Name</th><th>Roles</th><th>Phone</th><th>Email</th><th>Status</th></tr></thead><tbody>
          {D.team.filter(t => t.portal !== false).map(t => (
            <tr key={t.id}>
              <td><span className="who"><span className="av" style={{ background: ROLE[t.role][1] }}>{initials(t.name)}</span><b style={{ fontWeight: 500 }}>{t.name}</b></span></td>
              <td>{(t.roles?.length ? t.roles : [t.role]).map(r => ROLE[r]?.[0] || r).join(" · ")}</td><td>{t.phone || "-"}</td><td>{t.email || "-"}</td>
              <td>{t.isActive !== false ? <span className="pill p-ok">Active</span> : <span className="pill p-grey">Inactive</span>}</td>
            </tr>
          ))}
          {!D.team.some(t => t.portal !== false) && <tr><td colSpan={5} className="empty">No one yet. Add employees with an SEO, Google Ads or design role in Employee Portal and they show here.</td></tr>}
        </tbody></table></div>
        <p className="sub" style={{ padding: "8px 16px 12px", margin: 0 }}>The team is everyone in Employee Portal with an SEO analyst, SEO expert, Google Ads expert or graphic designer role. Change roles there; add any of them to a client below; everyone on a client's team does its work.{D.team.some(t => !t.portal) ? ` ${D.team.filter(t => !t.portal).length} older entr${D.team.filter(t => !t.portal).length === 1 ? "y" : "ies"} without a portal login ${D.team.filter(t => !t.portal).length === 1 ? "is" : "are"} hidden; their past work is kept.` : ""}</p>
      </div>

      <div className="card"><h3>Clients <small>{D.clients.filter(c => c.isActive !== false).length} active</small><button type="button" className="btn sm pri" onClick={() => setModal({ kind: "client" })}>+ Add client</button></h3>
        <div className="tw"><table><thead><tr><th>Client</th><th style={{ minWidth: 220 }}>Team</th><th className="r">Backlinks / month</th><th className="r">Blogs / month</th><th className="r">GMB / month</th><th className="r">Posters / month</th><th className="r">Google Ads budget / month</th><th className="r">Meta Ads budget / month</th><th className="r" /></tr></thead><tbody>
          {D.clients.map(c => (
            <tr key={c.id} style={c.isActive === false ? { opacity: 0.55 } : undefined}>
              <td><b style={{ fontWeight: 500 }}>{c.name}</b><span className="sub">{c.site || "no website"} · since {fds(c.start)}{c.lead ? " · CRM lead" : ""}</span></td>
              <td><TeamPick D={D} value={c.members} onChange={v => save(c, { members: v })} compact /></td>
              <td className="r"><Num c={c} k="backlink" /></td><td className="r"><Num c={c} k="blog" /></td><td className="r"><Num c={c} k="gmb" /></td><td className="r"><Num c={c} k="poster" /></td>
              <td className="r"><Num c={c} k="budget" step={1000} /></td>
              <td className="r"><Num c={c} k="metaBudget" step={1000} /></td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                <button type="button" className="btn sm" onClick={() => setModal({ kind: "client", edit: c })}>Edit</button>{" "}
                {c.isActive === false
                  ? <button type="button" className="btn sm" onClick={() => save(c, { isActive: true })}>Reactivate</button>
                  : <button type="button" className="btn sm" onClick={() => remove(c)}>Remove</button>}
              </td>
            </tr>
          ))}
          {!D.clients.length && <tr><td colSpan={8} className="empty">No clients yet. Click “+ Add client” and pick the lead from the CRM.</td></tr>}
        </tbody></table></div>
      </div>

      <div className="card"><h3>Report branding</h3>
        <div style={{ padding: 16, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <Logo src={D.logo} size={60} />
          <label className="f" style={{ maxWidth: 360 }}><span className="flabel">Upload your logo (PNG, JPG or SVG, under 500 KB). It appears at the top of every PDF report.</span>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e => onLogo(e.target.files[0])} /></label>
          {D.logo && <button type="button" className="btn" onClick={async () => { await seoApi("/settings", { method: "PUT", body: { logo: "" } }); load(); }}>Remove logo</button>}
        </div>
      </div>
    </>
  );
}
