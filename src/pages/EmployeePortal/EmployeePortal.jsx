import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserCheck, RefreshCw, X } from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import { billingApi } from "../ProjectBilling/billingMeta";
import { T, fd, fdw, initials, waPhone, copy } from "../SeoTeam/seoUtil";
import "../SeoTeam/SeoTeam.css";
import "./EmployeePortal.css";
import PortalChat from "./PortalChat";

// Approvals and the work employees log in the NNC Employee Portal (/api/portal/admin)
const papi = (path, opts) => billingApi(`/portal/admin${path}`, opts);

const ROLES = {
  seo: ["SEO analyst", "SEO and Google Ads", "#0891B2"], ads: ["Google Ads expert", "SEO and Google Ads", "#D97706"], gfx: ["Graphic designer", "SEO and Google Ads", "#DB2777"],
  app: ["App developer", "Development", "#2563EB"], web: ["Website developer", "Development", "#0D9488"], back: ["Backend developer", "Development", "#4F46E5"], full: ["Full stack developer", "Development", "#0369A1"],
  ux: ["UI/UX designer", "Design", "#DB2777"], test: ["Tester", "Testing", "#7C3AED"], acc: ["Accountant", "Accounts", "#475569"],
};
const TEAMS = { all: ["Everyone", null], seo: ["SEO and Ads", ["seo", "ads", "gfx"]], dev: ["Development and design", ["app", "web", "back", "full", "ux", "test"]], acc: ["Accounts", ["acc"]] };
const TY = {
  backlink: "Backlinks", blog: "Blog published", gmb: "GMB post", onpage: "On-page SEO", optimise: "Campaign change", negative: "Negative keywords", newad: "New ad or campaign",
  feature: "Feature or module", page: "Page built", build: "App build", deploy: "Deployment", bugfix: "Bug fixed", screen: "Screens designed", revision: "Design revision",
  poster: "Poster or creative", test: "Test run", bug: "Bug raised", invoice: "Invoice or payment", meeting: "Meeting", other: "Other work", adsreport: "Daily ads report",
};
const TABS = [["people", "Employees"], ["messages", "Messages"], ["today", "Today"], ["work", "Work log"], ["meetings", "Meetings and MOM"], ["tasks", "Tasks"], ["settings", "Settings"]];
const RANGES = [["today", "Today", 0], ["week", "Last 7 days", -6], ["month", "Last 30 days", -29]];

const h1 = (n) => Math.round((n || 0) * 10) / 10;
const dayOf = (d) => (d ? String(new Date(d).toISOString()).slice(0, 10) : "");
const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Never");
function metaTxt(e) {
  const m = e.meta || {}, o = [];
  if (m.kw) o.push(`keyword: ${m.kw}`); if (m.da) o.push(`DA ${m.da}`); if (m.words) o.push(`${m.words} words`); if (m.camp) o.push(m.camp);
  if (m.platform) o.push(m.platform); if (m.screens) o.push(`${m.screens} screens`); if (m.ver) o.push(`v${m.ver}`);
  if (m.pass != null) o.push(`${m.pass} passed, ${m.fail} failed`); if (m.bug) o.push(`${m.bug}${m.sev ? ` · ${m.sev}` : ""}${m.assignName ? ` · to ${m.assignName}` : ""}${m.status ? ` · ${m.status}` : ""}`);
  if (m.amt) o.push(`₹${(+m.amt).toLocaleString("en-IN")}`); if (m.spend != null && e.type === "adsreport") o.push(`₹${(+m.spend).toLocaleString("en-IN")} spent · ${m.conv || 0} leads`);
  if (m.mod) o.push(m.mod); if (m.terms) o.push(m.terms);
  return o.join(" · ");
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="mscrim" onClick={onClose} />
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true">
        <div className="m-h"><h3>{title}</h3><button type="button" className="btn sm" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
        <div className="ep-mb">{children}</div>
      </div>
    </>
  );
}

function useGet(path) {
  const [st, setSt] = useState({ data: null, err: "", key: "" });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    papi(path).then(j => live && setSt({ data: j.data, err: "", key: path }),
      e => live && setSt({ data: null, err: e.status === 403 ? "You don't have access to the Employee Portal module." : e.message, key: path }));
    return () => { live = false; };
  }, [path, n]);
  const fresh = st.key === path;
  return { data: fresh ? st.data : null, err: fresh ? st.err : "", loading: !fresh, reload: useCallback(() => setN(x => x + 1), []) };
}

const Role = ({ r }) => <>{ROLES[r]?.[0] || r}<span className="sub">{ROLES[r]?.[1]}</span></>;
const Av = ({ name, role }) => <span className="av" style={{ background: ROLES[role]?.[2] || "#64748B" }}>{initials(name)}</span>;

export default function EmployeePortal() {
  const [tab, setTab] = useState("people");
  const [rk, setRk] = useState(0); // bump to reload the open tab
  const [unread, setUnread] = useState(0);
  const A = useGet("/accounts");
  const pending = (A.data || []).filter(a => a.status === "pending").length;
  return (
    <div className="seo-layout ep">
      <Sidebar />
      <div className="seo"><div className="seo-app">
        <header className="hd">
          <h1><UserCheck size={20} color="#2563EB" /> Employee Portal</h1>
          <nav className="tabs" aria-label="Sections">
            {TABS.map(([k, t]) => (
              <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}{k === "people" && pending > 0 && <em>{pending}</em>}{k === "messages" && unread > 0 && <em>{unread}</em>}</button>
            ))}
          </nav>
          <span className="sp" />
          <button type="button" className="btn" onClick={() => { A.reload(); setRk(k => k + 1); }}><RefreshCw size={14} /> Refresh</button>
        </header>
        <main className="view" key={rk}>
        {A.err ? <div className="card"><div className="empty err">{A.err}</div></div> : (
          <>
            {tab === "people" && <People A={A} />}
            {tab === "messages" && <PortalChat onUnread={setUnread} />}
            {tab === "today" && <Work accounts={A.data || []} today />}
            {tab === "work" && <Work accounts={A.data || []} />}
            {tab === "meetings" && <Meetings />}
            {tab === "tasks" && <Tasks accounts={A.data || []} />}
            {tab === "settings" && <Settings />}
          </>
        )}
        </main>
      </div></div>
    </div>
  );
}

/* ───────── Employees and approvals ───────── */
function People({ A }) {
  const [f, setF] = useState("all");
  const [ask, setAsk] = useState(null);
  const [tmp, setTmp] = useState(null);
  const L = A.data || [];
  const shown = L.filter(a => f === "all" || a.status === f);
  const upd = async (a, body, ok) => {
    try { await papi(`/accounts/${a.id}`, { method: "PUT", body }); toast.success(ok); A.reload(); } catch (ex) { toast.error(ex.message); }
  };
  const reset = async (a) => {
    try { const j = await papi(`/accounts/${a.id}/reset`, { method: "POST" }); setTmp({ a, pw: j.tempPassword }); A.reload(); } catch (ex) { toast.error(ex.message); }
  };
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="l">Accounts</span><span className="v">{L.length}</span><span className="s">{L.filter(a => a.status === "active").length} active</span></div>
        <div className="kpi"><span className="l">Waiting for approval</span><span className={`v ${L.some(a => a.status === "pending") ? "amb" : ""}`}>{L.filter(a => a.status === "pending").length}</span><span className="s">approve them below</span></div>
        <div className="kpi"><span className="l">Signed in today</span><span className="v">{L.filter(a => dayOf(a.lastLogin) === T(0)).length}</span></div>
        <div className="kpi"><span className="l">Disabled</span><span className="v">{L.filter(a => a.status === "disabled").length}</span></div>
      </div>
      <div className="filters">{[["all", "All"], ["pending", "Waiting for approval"], ["active", "Active"], ["disabled", "Disabled"]].map(([k, t]) => (
        <button key={k} type="button" className={`chip ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{t}</button>
      ))}</div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Employee</th><th>Role</th><th>Contact</th><th>Works on</th><th>Last sign in</th><th>Status</th><th /></tr></thead>
        <tbody>
          {A.loading ? <tr><td colSpan={7}><div className="empty">Loading…</div></td></tr> : shown.length ? shown.map(a => (
            <tr key={a.id}>
              <td><div className="ep-who"><Av name={a.name} role={a.role} /><span><b>{a.name}</b><span className="sub">joined {fd(dayOf(a.created))}</span></span></div></td>
              <td><Role r={a.role} /></td>
              <td>{a.email}<span className="sub">{a.phone}</span></td>
              <td className="ep-works">{a.worksOn || (a.status === "active" ? <span className="sub">Not assigned yet · <Link to={["seo", "ads", "gfx"].includes(a.role) ? "/seo-team" : "/leads"}>assign</Link></span> : "-")}</td>
              <td>{when(a.lastLogin)}<span className="sub">{a.logins} sign ins</span></td>
              <td>{a.status === "active" ? <span className="pill p-ok">Active</span> : a.status === "pending" ? <span className="pill p-amb">Waiting</span> : <span className="pill p-red">Disabled</span>}
                {a.mustChange && <span className="sub">temporary password</span>}</td>
              <td className="ep-act">
                {a.status === "pending" && <button type="button" className="btn sm pri" onClick={() => upd(a, { status: "active" }, `${a.name} approved`)}>Approve</button>}
                {a.status === "disabled" && <button type="button" className="btn sm" onClick={() => upd(a, { status: "active" }, "Account enabled")}>Enable</button>}
                {a.status !== "pending" && <button type="button" className="btn sm" onClick={() => setAsk({ kind: "reset", a })}>Reset password</button>}
                {a.status !== "disabled" && <button type="button" className="btn sm late" onClick={() => setAsk({ kind: "disable", a })}>{a.status === "pending" ? "Reject" : "Disable"}</button>}
              </td>
            </tr>
          )) : <tr><td colSpan={7}><div className="empty">{L.length ? "Nobody in this list." : "No employees yet. When someone creates an account in the Employee Portal, they appear here to approve."}</div></td></tr>}
        </tbody>
      </table></div></div>
      <p className="hint">Approving an account adds the person to the CRM automatically: SEO, Ads and design staff to the SEO & Ads Team, developers, designers and testers to Developers.
        They see only the clients (SEO & Ads Team → Clients and settings) or projects (the project's developers) you assign them.</p>

      {ask && (
        <Modal title={ask.kind === "reset" ? `Reset ${ask.a.name}'s password?` : `${ask.a.status === "pending" ? "Reject" : "Disable"} ${ask.a.name}?`} onClose={() => setAsk(null)}>
          <p>{ask.kind === "reset" ? "You get a temporary password to share. They choose a new one when they sign in." : "They can no longer sign in to the Employee Portal. Their logged work stays."}</p>
          <div className="ep-row">
            <button type="button" className="btn" onClick={() => setAsk(null)}>Cancel</button>
            <button type="button" className={`btn ${ask.kind === "reset" ? "pri" : "late"}`} onClick={() => { const { kind, a } = ask; setAsk(null); if (kind === "reset") reset(a); else upd(a, { status: "disabled" }, "Account disabled"); }}>
              {ask.kind === "reset" ? "Reset password" : ask.a.status === "pending" ? "Reject" : "Disable"}</button>
          </div>
        </Modal>
      )}
      {tmp && (
        <Modal title="Temporary password" onClose={() => setTmp(null)}>
          <p>Share this with <b>{tmp.a.name}</b>. They will be asked to choose a new password when they sign in.</p>
          <div className="ep-pw">{tmp.pw}</div>
          <div className="ep-row">
            <button type="button" className="btn pri" onClick={() => { copy(tmp.pw); toast.success("Copied"); }}>Copy</button>
            {tmp.a.phone && <a className="btn wa" target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/${waPhone(tmp.a.phone)}?text=${encodeURIComponent(`Hi ${tmp.a.name}, your NNC Employee Portal temporary password is ${tmp.pw}. Sign in with ${tmp.a.email} and choose a new password.`)}`}>Send on WhatsApp</a>}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ───────── Today and the work log ───────── */
function Work({ accounts, today }) {
  const [rg, setRg] = useState(today ? "today" : "week");
  const [team, setTeam] = useState("all");
  const [who, setWho] = useState("");
  const [assign, setAssign] = useState(null);
  const from = T(RANGES.find(r => r[0] === (today ? "today" : rg))[2]);
  const W = useGet(`/work?from=${from}&to=${T(0)}`);
  const d = W.data || { accounts: [], work: [], days: [], blockers: [] };
  const roles = TEAMS[team][1];
  const accs = d.accounts.filter(a => !roles || roles.includes(a.role));
  const ids = new Set(accs.map(a => a.id));
  const acc = (id) => d.accounts.find(a => a.id === String(id));
  const work = d.work.filter(w => ids.has(String(w.account)) && (!who || String(w.account) === who));
  const days = d.days.filter(x => ids.has(String(x.account)));
  const bl = d.blockers.filter(b => ids.has(String(b.account)));
  const active = accs.filter(a => a.status === "active");
  const per = active.map(a => {
    const L = work.filter(w => String(w.account) === a.id);
    const day = days.find(x => String(x.account) === a.id && x.date === T(0));
    return { a, hrs: L.reduce((s, w) => s + (w.hrs || 0), 0), n: L.length, sub: days.filter(x => String(x.account) === a.id).length, day };
  }).sort((x, y) => y.hrs - x.hrs);
  const resolve = async (id) => { try { await papi(`/blockers/${id}/resolve`, { method: "PUT" }); toast.success("Marked as sorted"); W.reload(); } catch (ex) { toast.error(ex.message); } };
  const tw = work.filter(w => w.date === T(0));

  return (
    <>
      <div className="filters">
        {!today && RANGES.map(([k, l]) => <button key={k} type="button" className={`chip ${rg === k ? "on" : ""}`} onClick={() => setRg(k)}>{l}</button>)}
        <select value={team} onChange={e => { setTeam(e.target.value); setWho(""); }} aria-label="Team">{Object.entries(TEAMS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={who} onChange={e => setWho(e.target.value)} aria-label="Employee"><option value="">All employees</option>{accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <span className="sp" />
        <button type="button" className="btn pri" disabled={!active.length} onClick={() => setAssign({ account: who })}>Assign a task</button>
      </div>
      {W.err && <div className="card"><div className="empty err">{W.err}</div></div>}
      <div className="kpis">
        <div className="kpi"><span className="l">Items logged today</span><span className="v">{tw.length}</span></div>
        <div className="kpi"><span className="l">Hours logged today</span><span className="v">{h1(tw.reduce((s, w) => s + (w.hrs || 0), 0))}</span></div>
        <div className="kpi"><span className="l">Days submitted today</span><span className="v">{days.filter(x => x.date === T(0)).length} / {active.length}</span></div>
        <div className="kpi"><span className="l">Open blockers</span><span className={`v ${bl.length ? "red" : ""}`}>{bl.length}</span></div>
      </div>
      {bl.length > 0 && (
        <div className="card"><h3>Blockers <small>employees waiting on something</small></h3>
          <div className="ll flat">{bl.map(b => (
            <div key={b._id}><span className="d">{fd(b.date)}</span><span className="x"><b>{acc(b.account)?.name}</b> · {b.text}{b.refName ? ` · ${b.refName}` : ""}</span>
              <button type="button" className="btn sm" onClick={() => resolve(b._id)}>Sorted</button></div>
          ))}</div></div>
      )}
      <div className="ep-grid">
        <div className="card"><h3>{today ? "Logged today" : "Work logged"} <small>{work.length} items · {h1(work.reduce((s, w) => s + (w.hrs || 0), 0))} h</small></h3>
          {W.loading ? <div className="empty">Loading…</div> : work.length ? (
            <div className="ll flat">{work.slice(0, 300).map(e => (
              <div key={e._id}>
                <span className="d">{today ? <Av name={acc(e.account)?.name} role={acc(e.account)?.role} /> : fd(e.date)}</span>
                <span className="x"><span className="pill p-other">{TY[e.type] || e.type}</span> <b>{e.title}</b>
                  <span className="sub">{[acc(e.account)?.name, e.refName, metaTxt(e)].filter(Boolean).join(" · ")}</span>
                  {e.url && <a className="url" href={e.url} target="_blank" rel="noopener noreferrer">{e.url.replace(/^https?:\/\//, "")}</a>}</span>
                <span className="num">{h1(e.hrs)} h</span>
              </div>
            ))}</div>
          ) : <div className="empty">Nothing logged {today ? "today yet" : "in this period"}.</div>}
        </div>
        <div className="card"><h3>By person <small>{today ? "today" : RANGES.find(r => r[0] === rg)[1].toLowerCase()}</small></h3>
          {per.length ? (
            <div className="ll flat">{per.map(p => (
              <div key={p.a.id}>
                <Av name={p.a.name} role={p.a.role} />
                <span className="x"><b>{p.a.name}</b><span className="sub">{ROLES[p.a.role]?.[0]} · {p.n} items{today ? "" : ` · ${p.sub} days submitted`}</span>
                  {p.day && (p.day.note || p.day.plan) && <span className="sub">{p.day.note}{p.day.plan ? ` · Tomorrow: ${p.day.plan}` : ""}</span>}</span>
                <span className="num">{h1(p.hrs)} h</span>
                {p.day ? <span className="pill p-ok">Day sent {p.day.at}</span> : <span className="pill p-amb">Today open</span>}
              </div>
            ))}</div>
          ) : <div className="empty">No active employees in this team yet.</div>}
        </div>
      </div>
      {assign && <AssignTask accounts={accounts.filter(a => a.status === "active" && (!roles || roles.includes(a.role)))} init={assign} onClose={() => setAssign(null)} onDone={() => setAssign(null)} />}
    </>
  );
}

function AssignTask({ accounts, init, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const submit = async (ev) => {
    ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    setBusy(true);
    try { await papi("/tasks", { method: "POST", body: { account: f.account, title: f.title.trim(), refName: f.refName.trim(), due: f.due } }); toast.success("Task assigned"); onDone(); }
    catch (ex) { toast.error(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Assign a task" onClose={onClose}>
      <form onSubmit={submit} className="ep-form">
        <label className="f"><span className="flabel">Employee</span><select name="account" required defaultValue={init.account || ""}>
          <option value="">Choose</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {ROLES[a.role]?.[0]}</option>)}</select></label>
        <label className="f"><span className="flabel">Task</span><input name="title" type="text" required /></label>
        <div className="g2">
          <label className="f"><span className="flabel">Client or project (optional)</span><input name="refName" type="text" /></label>
          <label className="f"><span className="flabel">Due</span><input name="due" type="date" required defaultValue={T(0)} min={T(0)} /></label>
        </div>
        <div className="ep-row"><button className="btn pri" disabled={busy}>{busy ? "Saving…" : "Assign"}</button></div>
      </form>
    </Modal>
  );
}

/* ───────── Tasks ───────── */
function Tasks({ accounts }) {
  const Tk = useGet("/tasks");
  const [f, setF] = useState("open");
  const [assign, setAssign] = useState(false);
  const L = (Tk.data || []).filter(t => (f === "open" ? t.status !== "done" : t.status === "done"));
  return (
    <>
      <div className="filters">
        <button type="button" className={`chip ${f === "open" ? "on" : ""}`} onClick={() => setF("open")}>Open</button>
        <button type="button" className={`chip ${f === "done" ? "on" : ""}`} onClick={() => setF("done")}>Done</button>
        <span className="sp" />
        <button type="button" className="btn pri" onClick={() => setAssign(true)}>Assign a task</button>
      </div>
      <div className="card"><h3>Tasks assigned from the CRM <small>{L.length}</small></h3>
        <div className="tw"><table><thead><tr><th>Task</th><th>Employee</th><th>Client or project</th><th>Due</th><th>Status</th><th>By</th></tr></thead>
          <tbody>{Tk.loading ? <tr><td colSpan={6}><div className="empty">Loading…</div></td></tr> : L.length ? L.map(t => (
            <tr key={t._id}><td><b>{t.title}</b></td><td>{t.account?.name || "-"}</td><td>{t.refName || "-"}</td><td>{fd(t.due)}</td>
              <td>{t.status === "done" ? <span className="pill p-ok">Done {t.doneOn ? fd(t.doneOn) : ""}</span> : t.due < T(0) ? <span className="pill p-red">Overdue</span> : t.status === "doing" ? <span className="pill p-blue">Doing</span> : <span className="pill p-other">To do</span>}</td>
              <td>{t.from}</td></tr>
          )) : <tr><td colSpan={6}><div className="empty">No tasks here.</div></td></tr>}</tbody></table></div></div>
      {assign && <AssignTask accounts={accounts.filter(a => a.status === "active")} init={{}} onClose={() => setAssign(false)} onDone={() => { setAssign(false); Tk.reload(); }} />}
    </>
  );
}

/* ───────── Meetings ───────── */
function Meetings() {
  const M = useGet("/meetings");
  const [open, setOpen] = useState(null);
  const L = M.data || [];
  const sent = (m) => m.sentWa || m.sentMail;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="l">Meetings</span><span className="v">{L.length}</span></div>
        <div className="kpi"><span className="l">MOM sent</span><span className="v ok">{L.filter(sent).length}</span></div>
        <div className="kpi"><span className="l">MOM written, not sent</span><span className="v">{L.filter(m => m.momTxt && !sent(m)).length}</span></div>
        <div className="kpi"><span className="l">Notes only</span><span className="v amb">{L.filter(m => !m.momTxt).length}</span></div>
      </div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Meeting</th><th>Client or project</th><th>By</th><th>When</th><th>MOM</th><th /></tr></thead>
        <tbody>{M.loading ? <tr><td colSpan={6}><div className="empty">Loading…</div></td></tr> : M.err ? <tr><td colSpan={6}><div className="empty err">{M.err}</div></td></tr> : L.length ? L.map(m => (
          <tr key={m._id}>
            <td><b>{m.title}</b><span className="sub">{m.mode}</span></td>
            <td>{m.refName || "Internal"}</td>
            <td>{m.account?.name || "-"}<span className="sub">{ROLES[m.account?.role]?.[0]}</span></td>
            <td>{fdw(m.date)}{m.time ? `, ${m.time}` : ""}</td>
            <td>{!m.momTxt ? <span className="pill p-amb">Notes only</span> : sent(m) ? <span className="pill p-ok">Sent{m.sentWa ? " · WhatsApp" : ""}{m.sentMail ? " · Email" : ""}</span> : <span className="pill p-blue">Not sent</span>}</td>
            <td className="r"><button type="button" className="btn sm" onClick={() => setOpen(m)}>View</button></td>
          </tr>
        )) : <tr><td colSpan={6}><div className="empty">No meetings yet. Meetings logged by employees appear here.</div></td></tr>}</tbody>
      </table></div></div>
      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <p className="sub">{[open.refName || "Internal", fdw(open.date), open.account?.name].filter(Boolean).join(" · ")}</p>
          <pre className="ep-mom">{open.momTxt || open.notes}</pre>
          {open.images?.length > 0 && <div className="ep-thumbs">{open.images.map((s, i) => (
            <a key={i} href={s} target="_blank" rel="noopener noreferrer"><img src={s} alt={`Attachment ${i + 1}`} /></a>
          ))}</div>}
        </Modal>
      )}
    </>
  );
}

/* ───────── Settings ───────── */
function Settings() {
  const S = useGet("/settings");
  const [busy, setBusy] = useState(false);
  const s = S.data;
  const tog = (k) => async (e) => {
    setBusy(true);
    try { await papi("/settings", { method: "PUT", body: { [k]: e.target.checked } }); toast.success("Saved"); S.reload(); }
    catch (ex) { toast.error(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="card"><h3>Employee Portal rules</h3>
      {!s ? <div className={`empty ${S.err ? "err" : ""}`}>{S.err || "Loading…"}</div> : (
        <div className="ep-set">
          <label><input type="checkbox" checked={!!s.approval} disabled={busy} onChange={tog("approval")} />
            <span><b>New accounts need approval</b><span className="sub">New sign-ups wait on the Employees tab until you approve them.</span></span></label>
          <label><input type="checkbox" checked={!!s.domainOnly} disabled={busy} onChange={tog("domainOnly")} />
            <span><b>Only @{s.domain} emails can sign up</b><span className="sub">Blocks personal Gmail and other addresses.</span></span></label>
          <label><input type="checkbox" checked={s.showSecrets !== false} disabled={busy} onChange={tog("showSecrets")} />
            <span><b>Developers can see integration passwords</b><span className="sub">On a project's Integrations tab, assigned developers can show the keys and passwords saved in the Credential Vault. Every view is logged with their name.</span></span></label>
        </div>
      )}
    </div>
  );
}
