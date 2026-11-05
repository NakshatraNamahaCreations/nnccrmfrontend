import { createElement, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Lock, FileText, AlertTriangle, Clock, Users, Pause, IndianRupee, RefreshCw, X } from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import { billingApi } from "../ProjectBilling/billingMeta";
import Pager from "../LeadTracker/Pager";
import "../LeadTracker/LeadTracker.css";
import "./OwnerDashboard.css";

// Dashboard (sidebar → Overview → Dashboard): salaries against collections, what clients owe,
// monthly services, projects and branches, all from the live records (GET /api/dashboard/owner-view).

const DAY = 864e5;
const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const days = (a, b) => Math.round((new Date(a) - new Date(b)) / DAY);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fd = (s) => { if (!s) return "-"; const d = new Date(s); return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : ""}`; };
const fdw = (s) => new Date(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const L = (n) => { n = Math.round(n || 0); const a = Math.abs(n); return (n < 0 ? "-" : "") + (a >= 1e7 ? `₹${(a / 1e7).toFixed(2)}Cr` : a >= 1e5 ? `₹${(a / 1e5).toFixed(2)}L` : inr(a)); };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ph10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const BRANCHES = ["Bangalore", "Mysore", "Mumbai"];
const OWNERS = ["Harish", "Nithin"];
const PREF = "nnc-dash-prefs";
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF) || "{}"); } catch { return {}; } };

const Ic = ({ i, c, bg }) => <span className="od-ic" style={{ color: c, background: bg }}>{createElement(i, { size: 17 })}</span>;
// one line in a card: icon, title, detail, count (and amount), opens the page behind it
const Row = ({ i, c, bg, t, s, n, v, to }) => (
  <Link className="od-nr" to={to}><Ic i={i} c={c} bg={bg} /><span className="x"><b>{t}</b><span>{s}</span></span>
    {v != null ? <span className="m"><span className="n">{n}</span><br />{v}</span> : <span className="n">{n}</span>}</Link>
);

export default function OwnerDashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState("all");          // everything | money | delivery
  const [br, setBr] = useState("all");
  const [own, setOwn] = useState("all");
  const [prefs, setPrefs] = useState(readPrefs);   // salary bill and payday, kept in this browser
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { const j = await billingApi("/dashboard/owner-view"); setD(j.data); }
    catch (e) { setErr(e.message || "Could not load the dashboard"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const savePrefs = (p) => { setPrefs(p); try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* storage blocked */ } };

  const h = new Date().getHours();
  const name = (() => { try { return (JSON.parse(localStorage.getItem("nnc_user") || "null")?.name || "").split(" ")[0]; } catch { return ""; } })();

  return (
    <div className="lt-layout">
      <Sidebar />
      <div className="lt od">
        <div className="lt-wrap">
          <header className="lt-hd">
            <h1>Dashboard<span>.</span></h1><span className="lt-sp" />
            <div className="lt-seg" role="group" aria-label="Show">{[["all", "Everything"], ["money", "Money"], ["delivery", "Delivery"]].map(([k, t]) => <button key={k} type="button" className={who === k ? "on" : ""} onClick={() => setWho(k)}>{t}</button>)}</div>
            <div className="lt-seg" role="group" aria-label="Owner">{[["all", "Both"], ...OWNERS.map(o => [o, o])].map(([k, t]) => <button key={k} type="button" className={own === k ? "on" : ""} onClick={() => setOwn(k)}>{t}</button>)}</div>
            <label className="lt-sr" htmlFor="od-br">Branch</label>
            <select id="od-br" className="lt-in sm" value={br} onChange={e => setBr(e.target.value)}><option value="all">All branches</option>{BRANCHES.map(b => <option key={b}>{b}</option>)}</select>
            <button type="button" className="lt-btn p" onClick={() => setModal(true)}>Targets and salary</button>
            <button type="button" className="lt-btn" onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw size={15} className={loading ? "lt-spin" : ""} /></button>
          </header>
          <h2 className="lt-t">{h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}{name ? `, ${name}` : ""}<span>.</span></h2>
          <p className="lt-lead">{fdw(new Date())} · collections, what clients owe, salaries and projects{br === "all" ? " across all branches" : ` · ${br}`}{own !== "all" ? ` · ${own}'s clients` : ""}</p>
          {err ? <div className="lt-card lt-empty">{err} <button type="button" className="lt-btn sm" onClick={load}>Try again</button></div>
            : !d ? <div className="lt-card lt-empty">Loading the dashboard…</div>
            : <Body d={d} who={who} br={br} own={own} prefs={prefs} />}
        </div>
      </div>
      {modal && d && <Settings d={d} prefs={prefs} onClose={() => setModal(false)} onSave={(p) => { savePrefs(p); setModal(false); load(); }} />}
    </div>
  );
}

function Body({ d, who, br, own, prefs }) {
  const today = d.today;
  const brF = (x) => br === "all" || x.branch === br;
  const owF = (x) => own === "all" || x.owner === own;
  const P = d.projects.filter(p => brF(p) && owF(p));
  const S = d.services.filter(s => brF(s) && owF(s));
  const T = br === "all" && own === "all" ? d.tracker : [];     // Payment Tracker has no branch or owner
  const m = who !== "delivery", dl = who !== "money";

  // money in, for a month (branch: project advances and monthly services only, the Payment Tracker has no branch)
  const inOf = (k) => { const x = d.inflow[k]; if (!x) return 0; return br === "all" ? x.adv + x.rec + x.svc : x.byBranch[br] || 0; };
  const late = (p) => p.balance > 0 && (p.completed || (p.finalDue && p.finalDue < today) || (p.endDate && p.endDate < today));
  return (
    <>
      {m && <Salary d={d} P={P} S={S} inOf={inOf} prefs={prefs} br={br} late={late} />}
      {m && <div className="od-g od-g2"><Collect P={P} T={T} today={today} late={late} /><OnlyYou d={d} P={P} br={br} /></div>}
      {m && <div className="od-g od-g11"><Ladder P={P} today={today} /><Unpaid P={P} /></div>}
      {m && <Services S={S} today={today} />}
      {m && <div className="od-g od-g11"><Bills d={d} /><Tds d={d} /></div>}
      {dl && <div className="od-g od-g2"><Projects P={P} today={today} /><Leaks d={d} P={P} late={late} /></div>}
      {m && <Branches d={d} own={own} />}
      <Trust d={d} />
      <p className="lt-note">Every figure comes from the CRM: Projects (deal value, GST and advance received), Payment Tracker, Monthly services, Expenses, Salary and Quotations.</p>
    </>
  );
}

/* ───────── salaries vs collections ───────── */
function Salary({ d, P, S, inOf, prefs, br, late }) {
  const now = new Date();
  const payDay = Math.min(28, Math.max(1, Number(prefs.payday) || 1));
  const pd = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= payDay ? 1 : 0), payDay);
  const payday = ymd(pd), left = days(payday, d.today);
  const lastCost = d.cost[d.lastYm] || { salary: 0, byBranch: {} };
  const run = d.lastRun ? d.salaryRuns[d.lastRun]?.net || 0 : 0;
  const autoSal = lastCost.salary || run;
  const salAll = Number(prefs.salary) || autoSal;
  const sal = br === "all" ? salAll : Math.round(salAll * ((lastCost.byBranch[br] || 0) / Math.max(1, Object.values(lastCost.byBranch).reduce((a, x) => a + x, 0))));
  const collected = inOf(d.thisYm);
  const expectP = P.filter(p => p.balance > 0 && p.finalDue && p.finalDue >= d.today && p.finalDue <= payday);
  const expectS = S.filter(s => s.started && !s.paidThis);
  const expected = expectP.reduce((a, p) => a + p.balance, 0) + expectS.reduce((a, s) => a + s.fee, 0);
  const have = collected + expected, gap = sal - have;
  const top10 = [...P].sort((a, b) => b.balance - a.balance).slice(0, 10);
  const hold = P.filter(p => p.stage === "On Hold" && p.balance > 0);
  const target = d.target?.revenue || 0;
  return (
    <section className="lt-card od-sal">
      <div className="a">
        <div className="od-row">
          <div><span className="od-cap">Salaries on {fdw(payday)} · {left} day{left === 1 ? "" : "s"} away</span>
            <div className="od-big">{L(sal)} <small>needed</small></div>
            <span className="lt-note">{prefs.salary ? "Set by you" : lastCost.salary ? `Salaries paid in ${MON[new Date(`${d.lastYm}-15`).getMonth()]} (Expenses)` : d.lastRun ? `Last salary run, ${d.lastRun}` : "Set it under Targets and salary"}{br !== "all" ? ` · ${br}'s share` : ""}</span></div>
          <span className={`lt-pill ${gap <= 0 ? "p-ok" : "p-red"} od-badge`}>{gap <= 0 ? "Covered" : `Short by ${L(gap)}`}</span>
        </div>
        <div className="od-prog"><i style={{ width: `${Math.min(100, pct(collected, sal))}%` }} /><i className="exp" style={{ left: `${Math.min(100, pct(collected, sal))}%`, width: `${Math.max(0, Math.min(100 - Math.min(100, pct(collected, sal)), pct(expected, sal)))}%` }} /></div>
        <div className="od-leg"><span style={{ "--c": "#2563EB" }}>Collected this month: {L(collected)}</span><span style={{ "--c": "#93C5FD" }}>Due before payday: {L(expected)}</span>{gap > 0 && <span style={{ "--c": "#DC2626" }}>Gap: {L(gap)}</span>}</div>
        <p className="lt-note" style={{ margin: "10px 0 0" }}>"Due before payday" counts project balances with a final payment date before payday and monthly services not yet paid this month.{target ? ` This month's revenue target is ${L(target)}: ${pct(collected, target)}% collected.` : ""}</p>
      </div>
      <div className="b">
        <span className="od-cap">How to close the gap before payday</span>
        <a className="od-nr" href="#od-collect"><Ic i={Phone} c="#DC2626" bg="#FEF2F2" /><span className="x"><b>Call the 10 biggest balances</b><span>{L(top10.reduce((a, p) => a + p.balance, 0))} between them</span></span></a>
        <Link className="od-nr" to="/leads"><Ic i={Lock} c="#D97706" bg="#FFF4E5" /><span className="x"><b>Finish and bill completed projects</b><span>{P.filter(late).length} projects done or past their date still owe {L(P.filter(late).reduce((a, p) => a + p.balance, 0))}</span></span></Link>
        <Link className="od-nr" to="/monthly-billing"><Ic i={FileText} c="#2563EB" bg="#EFF4FF" /><span className="x"><b>Collect this month's monthly services</b><span>{expectS.length} not paid yet · {L(expectS.reduce((a, s) => a + s.fee, 0))}{hold.length ? ` · ${hold.length} on hold projects owe ${L(hold.reduce((a, p) => a + p.balance, 0))}` : ""}</span></span></Link>
      </div>
    </section>
  );
}

/* ───────── what clients owe ───────── */
function Collect({ P, T, today, late }) {
  const [tab, setTab] = useState("over");
  const [page, setPage] = useState(0), [per, setPer] = useState(10);
  const rows = {
    over: P.filter(late).sort((a, b) => b.balance - a.balance),
    week: P.filter(p => p.balance > 0 && p.finalDue && p.finalDue >= today && days(p.finalDue, today) <= 7).sort((a, b) => a.finalDue.localeCompare(b.finalDue)),
    all: P.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance),
    tracker: [...T].sort((a, b) => b.balance - a.balance),
  };
  const A = rows[tab], sum = (L0) => L0.reduce((x, r) => x + r.balance, 0);
  const V = A.slice(page * per, page * per + per);
  const wa = (r) => {
    const t = `Hi ${String(r.name).split(" ")[0]}, a gentle reminder from Nakshatra Namaha Creations: ${inr(r.balance)} is pending for ${r.company || r.project || "your project"}. Kindly clear it and share the payment reference. Thank you.`;
    window.open(`https://wa.me/${ph10(r.phone) ? `91${ph10(r.phone)}` : ""}?text=${encodeURIComponent(t)}`, "_blank", "noopener");
  };
  return (
    <section className="lt-card" id="od-collect">
      <h4>Balances to collect <small>projects and Payment Tracker</small></h4>
      <div className="lt-chips" style={{ padding: "10px 16px 0" }}>
        {[["over", "Done or past date"], ["week", "Due in 7 days"], ["all", "All project balances"], ...(T.length ? [["tracker", "Payment Tracker"]] : [])].map(([k, t]) => (
          <button type="button" key={k} className={`lt-chip ${tab === k ? "on" : ""}`} onClick={() => { setTab(k); setPage(0); }}>{t} · {rows[k].length} · {L(sum(rows[k]))}</button>
        ))}
      </div>
      <div className="lt-tw" style={{ marginTop: 10 }}><table>
        <thead><tr><th>Client</th><th>{tab === "tracker" ? "Status" : "Project"}</th><th className="r">Pending</th><th>{tab === "week" ? "Due" : tab === "tracker" ? "Last follow-up" : "Since"}</th><th>{tab === "tracker" ? "" : "Owner"}</th><th /></tr></thead>
        <tbody>
          {V.map(r => tab === "tracker" ? (
            <tr key={r.id}><td className="nm"><b>{r.name}</b><span className="lt-sub">{r.project || r.contact}</span></td><td><span className="lt-pill p-amb">{r.status}</span></td>
              <td className="r num"><b>{L(r.balance)}</b><span className="lt-sub">of {L(r.total)}</span></td><td className="num">{fd(r.lastFollowUp)}</td><td />
              <td className="r"><Link className="lt-btn sm" to="/payment-tracker">Open</Link></td></tr>
          ) : (
            <tr key={r.id}><td className="nm"><b>{r.company || r.name}</b><span className="lt-sub">{r.company ? r.name : r.branch}</span></td>
              <td><span className={`lt-pill ${r.completed ? "p-ok" : r.stage === "On Hold" ? "p-red" : "p-blue"}`}>{r.completed ? "Completed" : r.stage || "Not started"}</span></td>
              <td className="r num"><b style={{ color: r.balance >= 100000 ? "var(--red)" : "var(--navy)" }}>{L(r.balance)}</b><span className="lt-sub">{pct(r.received, r.total)}% paid of {L(r.total)}</span></td>
              <td className="num">{tab === "week" ? fd(r.finalDue) : r.finalDue && r.finalDue < today ? <span className="lt-pill p-red">Due {fd(r.finalDue)}</span> : fd(r.advanceDate || r.onboarded || r.created)}</td>
              <td><span className="lt-av" style={{ background: r.owner === "Harish" ? "#2563EB" : r.owner === "Nithin" ? "#7C3AED" : "#94A3B8" }} title={r.owner}>{r.owner[0]}</span></td>
              <td className="r"><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><button type="button" className="lt-btn sm g" onClick={() => wa(r)}>Remind</button><Link className="lt-btn sm" to="/leads">Open</Link></div></td></tr>
          ))}
          {!A.length && <tr><td colSpan={6} className="lt-empty">Nothing here.</td></tr>}
        </tbody>
      </table></div>
      {A.length > 10 && <Pager total={A.length} page={page} per={per} onPage={setPage} onPer={setPer} sizes={[10, 25, 50]} label="clients" top />}
    </section>
  );
}

function OnlyYou({ d, P, br }) {
  const big = P.filter(p => p.balance >= 100000);
  const done = P.filter(p => p.completed && p.balance > 0);
  const hold = P.filter(p => p.stage === "On Hold");
  const past = P.filter(p => !p.completed && p.endDate && p.endDate < d.today);
  return (
    <section className="lt-card"><h4>Only you can do these today</h4>
      <Row i={Phone} c="#DC2626" bg="#FEF2F2" t="Call: balances of ₹1L or more" s={big.slice(0, 3).map(p => p.company || p.name).join(", ") + (big.length > 3 ? " and others" : "") || "None"} n={big.length} v={L(big.reduce((a, p) => a + p.balance, 0))} to="/leads" />
      <Row i={AlertTriangle} c="#DC2626" bg="#FEF2F2" t="Completed, not fully paid" s="Work delivered, balance still open" n={done.length} v={L(done.reduce((a, p) => a + p.balance, 0))} to="/leads" />
      <Row i={Pause} c="#7C3AED" bg="#F3EEFF" t="Decide: projects on hold" s="Restart, bill what is done, or close them" n={hold.length} v={L(hold.reduce((a, p) => a + p.balance, 0))} to="/leads" />
      <Row i={Clock} c="#D97706" bg="#FFF4E5" t="Past their end date" s="Not marked completed yet" n={past.length} v={L(past.reduce((a, p) => a + p.balance, 0))} to="/leads" />
      {br === "all" && <Row i={FileText} c="#2563EB" bg="#EFF4FF" t="Quotations with no reply 3+ days" s="Sent or in negotiation" n={d.leadsDesk.quoteWait} v={L(d.leadsDesk.quoteWaitVal)} to="/quotations" />}
      {br === "all" && <Row i={Users} c="#059669" bg="#ECFDF5" t="New enquiries to call" s="Last 14 days, never contacted" n={d.leadsDesk.newEnq} to="/lead-tracker" />}
    </section>
  );
}

function Ladder({ P, today }) {
  const B = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["91–180 days", 91, 180], ["Over 180 days", 181, 1e6]];
  const owe = P.filter(p => p.balance > 0);
  const age = (p) => days(today, p.advanceDate || p.onboarded || p.created);
  const cols = B.map(b => { const A = owe.filter(p => age(p) >= b[1] && age(p) <= b[2]); return [b, A.length, A.reduce((a, p) => a + p.balance, 0)]; });
  const mx = Math.max(1, ...cols.map(c => c[2]));
  return (
    <section className="lt-card"><h4>How long balances have been open <small>since the advance was paid</small></h4>
      <div className="od-pad"><div className="od-ladder">
        {cols.map(([b, n, v], i) => (
          <div key={b[0]} className="od-step"><span className="lt-note">{b[0]}</span><b style={{ color: i >= 3 ? "var(--red)" : "var(--navy)" }}>{n}</b><span className="lt-note">{L(v)}</span>
            <div className="lt-sbar" style={{ marginTop: 6 }}><i style={{ width: `${(v / mx) * 100}%`, background: i >= 3 ? "#DC2626" : i >= 2 ? "#D97706" : "#2563EB" }} /></div></div>
        ))}
      </div><p className="lt-note" style={{ margin: "10px 0 0" }}>The longer a balance stays open, the harder it is to collect. Over 90 days needs a call from you.</p></div>
    </section>
  );
}

function Unpaid({ P }) {
  const R = P.filter(p => !p.completed && p.stage !== "On Hold" && p.total > 0 && p.received / p.total < 0.5).sort((a, b) => b.balance - a.balance);
  return (
    <section className="lt-card"><h4>Working with less than half paid <small>projects in progress</small></h4>
      <div className="od-pad od-stats"><div><span className="lt-note">Still owed</span><div className="od-big sm" style={{ color: "var(--red)" }}>{L(R.reduce((a, p) => a + p.balance, 0))}</div></div><div><span className="lt-note">Projects</span><div className="od-big sm">{R.length}</div></div><div><span className="lt-note">Average paid</span><div className="od-big sm">{R.length ? pct(R.reduce((a, p) => a + p.received, 0), R.reduce((a, p) => a + p.total, 0)) : 0}%</div></div></div>
      <table><thead><tr><th>Client</th><th className="r">Owed</th><th className="r">Paid</th><th>Stage</th></tr></thead>
        <tbody>{R.slice(0, 6).map(p => <tr key={p.id}><td className="nm"><b>{p.company || p.name}</b><span className="lt-sub">{p.owner} · {p.branch}</span></td><td className="r num" style={{ color: "var(--red)" }}>{L(p.balance)}</td><td className="r num">{pct(p.received, p.total)}%</td><td><span className="lt-sub" style={{ color: "var(--text)" }}>{p.stage || "Not started"}</span></td></tr>)}
          {!R.length && <tr><td colSpan={4} className="lt-empty">No one. Good.</td></tr>}</tbody></table>
    </section>
  );
}

function Services({ S, today }) {
  const mrr = S.reduce((a, s) => a + s.fee, 0);
  return (
    <section className="lt-card od-mb"><h4>Monthly services <small>{S.length} clients · {L(mrr)} a month · {L(mrr * 12)} a year</small><span className="lt-sp" /><Link className="lt-btn sm" to="/monthly-billing">Open Monthly and Extras</Link></h4>
      <div className="lt-tw"><table><thead><tr><th>Client</th><th>Service</th><th className="r">Fee</th><th>Bills on</th><th>This month</th><th className="r">Months paid</th></tr></thead>
        <tbody>{S.map(s => <tr key={s.id}><td className="nm"><b>{s.name}</b><span className="lt-sub">{s.branch} · {s.owner}</span></td><td>{s.service}</td><td className="r num">{L(s.fee)}</td><td className="num">{fd(s.dueDate)}</td>
          <td>{s.paidThis ? <span className="lt-pill p-ok">Paid</span> : !s.started ? <span className="lt-pill p-gr">Not started</span> : s.dueDate < today ? <span className="lt-pill p-red">Overdue</span> : <span className="lt-pill p-blue">Due</span>}</td><td className="r num">{s.months}</td></tr>)}
          {!S.length && <tr><td colSpan={6} className="lt-empty">No monthly services. Add them in Monthly and Extras.</td></tr>}</tbody></table></div>
    </section>
  );
}

function Bills({ d }) {
  return (
    <section className="lt-card"><h4>Invoices and quotations</h4>
      <Link className="od-nr" to="/accounting"><Ic i={FileText} c="#D97706" bg="#FFF4E5" /><span className="x"><b>Draft invoices older than 7 days</b><span>Never sent to the client</span></span><span className="n">{d.invoices.draftOld}</span></Link>
      <Link className="od-nr" to="/accounting"><Ic i={IndianRupee} c="#2563EB" bg="#EFF4FF" /><span className="x"><b>Invoices sent, not paid</b><span>{L(d.invoices.sentVal)} in total</span></span><span className="n">{d.invoices.sent}</span></Link>
      <Link className="od-nr" to="/quotations"><Ic i={Clock} c="#7C3AED" bg="#F3EEFF" /><span className="x"><b>Quotations waiting 3+ days</b><span>{L(d.leadsDesk.quoteWaitVal)} waiting on a yes</span></span><span className="n">{d.leadsDesk.quoteWait}</span></Link>
    </section>
  );
}

function Tds({ d }) {
  const ded = d.tds.reduce((a, t) => a + t.tds, 0), pend = d.tds.filter(t => /pending/i.test(t.status));
  return (
    <section className="lt-card"><h4>TDS, kept apart from real dues</h4>
      <div className="od-pad">
        <div className="od-stats"><div><span className="lt-note">TDS deducted by clients</span><div className="od-big sm">{L(ded)}</div><span className="lt-note">{d.tds.length} payments</span></div>
          <div><span className="lt-note">Certificate pending</span><div className="od-big sm" style={{ color: pend.length ? "var(--red)" : "var(--ok)" }}>{L(pend.reduce((a, t) => a + t.tds, 0))}</div><span className="lt-note">{pend.length} payments</span></div></div>
        {pend.length > 0 && <table style={{ marginTop: 10 }}><tbody>{pend.slice(0, 5).map((t, i) => <tr key={i}><td>{t.client}</td><td className="num">{fd(t.date)}</td><td className="r num">{inr(t.tds)}</td></tr>)}</tbody></table>}
        <p className="lt-note" style={{ margin: "8px 0 0" }}>TDS is recorded in Payment Tracker. Ask the client for the Form 16A certificate, not the money.</p>
      </div>
    </section>
  );
}

/* ───────── delivery ───────── */
function Projects({ P, today }) {
  const live = P.filter(p => !p.completed);
  const groups = [["Onboarded", "#2563EB"], ["Development in Progress", "#0891B2"], ["On Hold", "#DC2626"], ["", "#94A3B8"]];
  const past = live.filter(p => p.endDate && p.endDate < today);
  const longest = [...live].sort((a, b) => (a.startDate || a.onboarded || a.created || "").localeCompare(b.startDate || b.onboarded || b.created || "")).slice(0, 6);
  return (
    <section className="lt-card"><h4>Projects <small>{live.length} live · {P.length - live.length} completed</small><span className="lt-sp" /><Link className="lt-btn sm" to="/leads">Open Projects</Link></h4>
      <div className="od-ph">
        {groups.map(([g, c]) => { const A = live.filter(p => (p.stage || "") === g); return <div key={g || "none"}><b style={{ color: c }}>{A.length}</b><span>{g || "Stage not set"}</span><small>{L(A.reduce((a, p) => a + p.balance, 0))} owed</small></div>; })}
      </div>
      {past.length > 0 && <div className="lt-ins"><i>!</i><span><b>{past.length}</b> live project{past.length > 1 ? "s are" : " is"} past the end date: {past.slice(0, 3).map(p => p.company || p.name).join(", ")}.</span></div>}
      <table><thead><tr><th>Running longest</th><th>Stage</th><th className="r">Days</th><th className="r">Owed</th></tr></thead>
        <tbody>{longest.map(p => <tr key={p.id}><td className="nm"><b>{p.company || p.name}</b><span className="lt-sub">{p.owner} · {p.branch}</span></td><td><span className="lt-sub" style={{ color: "var(--text)" }}>{p.stage || "Not set"}</span></td>
          <td className="r num"><span className={`lt-pill ${days(today, p.startDate || p.onboarded || p.created) > 90 ? "p-red" : "p-amb"}`}>{days(today, p.startDate || p.onboarded || p.created)}</span></td><td className="r num">{L(p.balance)}</td></tr>)}</tbody></table>
    </section>
  );
}

function Leaks({ d, P, late }) {
  const noAdv = P.filter(p => !p.completed && p.received === 0);
  return (
    <section className="lt-card"><h4>Where project money leaks</h4>
      <Row i={AlertTriangle} c="#DC2626" bg="#FEF2F2" t="Done or past date, balance open" s={L(P.filter(late).reduce((a, p) => a + p.balance, 0))} n={P.filter(late).length} to="/leads" />
      <Row i={IndianRupee} c="#D97706" bg="#FFF4E5" t="Work started with no advance" s="Live projects with nothing received" n={noAdv.length} to="/leads" />
      <Row i={Lock} c="#7C3AED" bg="#F3EEFF" t="Closed deals with no project stage" s="Nobody knows where these stand" n={d.checks.noStage} to="/leads" />
      <Row i={FileText} c="#2563EB" bg="#EFF4FF" t="Draft invoices never sent" s="Older than 7 days" n={d.invoices.draftOld} to="/accounting" />
    </section>
  );
}

/* ───────── branches ───────── */
function Branches({ d, own }) {
  const P = d.projects.filter(p => own === "all" || p.owner === own);
  const lastCost = d.cost[d.lastYm] || { byBranch: {} };
  const rent = Object.fromEntries(d.rents.map(r => [r.branch, r.amount]));
  const rows = BRANCHES.map(b => {
    const A = P.filter(p => p.branch === b);
    const now = d.inflow[d.thisYm]?.byBranch[b] || 0, last = d.inflow[d.lastYm]?.byBranch[b] || 0, cost = lastCost.byBranch[b] || 0;
    return { b, n: A.length, val: A.reduce((a, p) => a + p.total, 0), rec: A.reduce((a, p) => a + p.received, 0), bal: A.reduce((a, p) => a + p.balance, 0), now, last, cost, rent: rent[b] || 0 };
  });
  return (
    <section className="lt-card od-mb"><h4>Branches <small>{MON[new Date().getMonth()]} so far, against last month's costs</small></h4>
      <div className="lt-tw"><table><thead><tr><th>Branch</th><th className="r">Projects</th><th className="r">Deal value</th><th style={{ minWidth: 170 }}>Received</th><th className="r">Owed</th><th className="r">Collected this month</th><th className="r">Collected last month</th><th className="r">Expenses last month</th><th className="r">Rent</th><th className="r">Paid for itself last month?</th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.b}><td><b className="nmb">{r.b}</b></td><td className="r num">{r.n}</td><td className="r num">{L(r.val)}</td>
            <td><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><b className="nmb">{L(r.rec)}</b><span className="lt-note">{pct(r.rec, r.val)}%</span></div><div className="lt-sbar" style={{ marginTop: 3 }}><i style={{ width: `${Math.min(100, pct(r.rec, r.val))}%` }} /></div></td>
            <td className="r num" style={{ color: "var(--red)" }}>{L(r.bal)}</td><td className="r num">{L(r.now)}</td><td className="r num">{L(r.last)}</td><td className="r num">{L(r.cost)}</td><td className="r num">{L(r.rent)}</td>
            <td className="r">{r.cost ? (r.last >= r.cost ? <span className="lt-pill p-ok">Yes, {L(r.last - r.cost)} over</span> : <span className="lt-pill p-red">Short {L(r.cost - r.last)}</span>) : <span className="lt-sub">No expenses entered</span>}</td></tr>
        ))}</tbody></table></div>
      <p className="lt-note" style={{ padding: "8px 16px 12px", margin: 0 }}>Collected by branch counts project advances and monthly services (Payment Tracker entries have no branch). Expenses include salaries entered in Expenses.</p>
    </section>
  );
}

function Trust({ d }) {
  const I = [["Enquiries open with no update for 30+ days", d.checks.idleEnq, "/lead-tracker"], ["Live projects past their end date", d.checks.pastEnd, "/leads"], ["Closed deals with no project stage", d.checks.noStage, "/leads"],
    ["Payments not linked to an invoice", d.checks.unlinkedPay, "/payment-tracker"], ["Projects paid with no advance date", d.checks.noAdvanceDate, "/leads"], [`Salary records not marked paid (${d.lastRun || "-"})`, d.checks.salaryUnpaid, "/accounting"]];
  return (
    <section className="lt-card od-mb"><h4>Can you trust these numbers? <small>records the team has not updated</small></h4>
      <div className="od-pad od-trust">{I.map(([t, n, to]) => <Link key={t} to={to}><b style={{ color: n > 20 ? "var(--red)" : n ? "var(--amb)" : "var(--ok)" }}>{n}</b><span>{t}</span></Link>)}</div>
    </section>
  );
}

/* ───────── targets and salary ───────── */
function Settings({ d, prefs, onClose, onSave }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setBusy(true);
    try {
      const rev = Number(f.target) || 0;
      if (rev !== (d.target?.revenue || 0)) { const n = new Date(); await billingApi("/dashboard/target", { method: "POST", body: { year: n.getFullYear(), month: n.getMonth() + 1, targetRevenue: rev, targetDeals: d.target?.deals || 0 } }); }
      onSave({ salary: Number(f.salary) || 0, payday: Number(f.payday) || 1 });
      toast.success("Saved");
    } catch (ex) { toast.error(ex.message); }
    finally { setBusy(false); }
  };
  const auto = (d.cost[d.lastYm]?.salary) || (d.lastRun ? d.salaryRuns[d.lastRun]?.net : 0) || 0;
  return (
    <>
      <div className="lt-scrim" onClick={onClose} />
      <div className="lt-modal" role="dialog" aria-modal="true" aria-label="Targets and salary">
        <div className="mh"><b>Targets and salary</b><button type="button" className="lt-xb" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <form className="mb" onSubmit={submit}>
          <div className="lt-f"><label htmlFor="od-s1">Monthly salary bill (₹)</label><input id="od-s1" name="salary" type="number" min="0" step="5000" defaultValue={prefs.salary || ""} placeholder={`From last month's salary expenses: ${Math.round(auto)}`} />
            <span className="lt-note">Leave empty to use last month's salaries from Expenses ({L(auto)}).</span></div>
          <div className="lt-f"><label htmlFor="od-s2">Salaries are paid on day</label><input id="od-s2" name="payday" type="number" min="1" max="28" defaultValue={prefs.payday || 1} /></div>
          <div className="lt-f"><label htmlFor="od-s3">This month's revenue target (₹)</label><input id="od-s3" name="target" type="number" min="0" step="10000" defaultValue={d.target?.revenue || ""} />
            <span className="lt-note">Saved for everyone, the same target as the old dashboard. Salary and payday are kept in this browser.</span></div>
          <div className="lt-row"><button className="lt-btn p" disabled={busy}>{busy ? "Saving…" : "Save"}</button><button type="button" className="lt-btn" onClick={onClose}>Cancel</button></div>
        </form>
      </div>
    </>
  );
}
