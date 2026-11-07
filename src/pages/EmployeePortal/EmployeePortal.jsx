import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserCheck, RefreshCw, X, Trash2, Eye, EyeOff, UserPlus, Pencil, FolderKanban, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import Linkify from "../../components/Linkify";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import { billingApi, API } from "../ProjectBilling/billingMeta";
import { T, fd, fdw, initials, waPhone, copy } from "../SeoTeam/seoUtil";
import "../SeoTeam/SeoTeam.css";
import "./EmployeePortal.css";
import PortalChat from "./PortalChat";
import Pager from "../LeadTracker/Pager";
import { markSeen, fetchPortalCounts } from "../../utils/portalSeen";

// Approvals and the work employees log in the NNC Employee Portal (/api/portal/admin)
const papi = (path, opts) => billingApi(`/portal/admin${path}`, opts);

const ROLES = {
  seo: ["SEO analyst", "Digital Marketing", "#0891B2"], seox: ["SEO expert", "Digital Marketing", "#0E7490"], ads: ["Google Ads expert", "Digital Marketing", "#D97706"], gfx: ["Graphic designer", "Design", "#DB2777"],
  app: ["App developer", "Development", "#2563EB"], web: ["Website developer", "Development", "#0D9488"], back: ["Backend developer", "Development", "#4F46E5"], full: ["Full stack developer", "Development", "#0369A1"],
  ux: ["UI/UX designer", "Design", "#DB2777"], test: ["Tester", "Testing", "#7C3AED"], other: ["Team member", "Development", "#64748B"], acc: ["Accountant", "Accounts", "#475569"],
};
const TEAMS = { all: ["Everyone", null], seo: ["Digital Marketing", ["seo", "seox", "ads", "gfx"]], dev: ["Development and design", ["app", "web", "back", "full", "ux", "test", "other"]], acc: ["Accounts", ["acc"]] };
const PROJECT_ROLES = ["app", "web", "back", "full", "ux", "test", "other"];   // put on projects
const SEO_ROLES = ["seo", "seox", "ads", "gfx"];                             // put on SEO clients
const DEPTS = ["Development", "Design", "Testing", "Digital Marketing", "Accounts"];
const BRANCHES = ["Bangalore", "Mysore", "Mumbai"];
const TY = {
  backlink: "Backlinks", blog: "Blog published", gmb: "GMB post", onpage: "On-page SEO", optimise: "Campaign or ad changes", negative: "Negative keywords", newad: "New ad or ad group",
  feature: "Feature or module", page: "Page built", build: "App build", deploy: "Deployment", bugfix: "Bug fixed", screen: "Screens designed", revision: "Design revision",
  poster: "Poster or creative", test: "Test run", bug: "Bug raised", invoice: "Invoice or payment", meeting: "Meeting", other: "Other work", adsreport: "Daily ads report",
  webcontent: "Website content", blogcontent: "Blog content written", landing: "Landing page content", campaign: "Campaign setup",
  social: "Social media posts", position: "Position tracking", monthly: "Monthly report", docs: "Documentation or reporting",
  kwresearch: "Keyword research", metaads: "Meta Ads",
};
const TABS = [["people", "Employees"], ["messages", "Messages"], ["plans", "Plans for today"], ["today", "Today"], ["work", "Work log"], ["meetings", "Meetings and MOM"], ["docs", "Documents"], ["tasks", "Tasks"], ["settings", "Settings"]];
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
  if (m.pages) o.push(`${m.pages} page${m.pages > 1 ? "s" : ""}`); if (m.posts) o.push(`${m.posts} post${m.posts > 1 ? "s" : ""}`);
  if (m.kws) o.push(`${m.kws} keywords`); if (m.month) o.push(m.month);
  if (m.files?.length) o.push(`${m.files.length} attachment${m.files.length > 1 ? "s" : ""}`);
  return o.join(" · ");
}

// Screenshots, videos or files attached to a logged piece of work
function WorkFiles({ e }) {
  const L = e.meta?.files || [];
  if (!L.length) return null;
  return <span className="ep-wfiles">{L.map(f => <a key={f.url} href={/^https?:/.test(f.url) ? f.url : `${API}${f.url}`} target="_blank" rel="noopener noreferrer" title={f.name}>{f.name}</a>)}</span>;
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
    if (!path) return undefined;
    let live = true;
    papi(path).then(j => live && setSt({ data: j.data, err: "", key: path }),
      e => live && setSt({ data: null, err: e.status === 403 ? "You don't have access to the Employee Portal module." : e.message, key: path }));
    return () => { live = false; };
  }, [path, n]);
  const fresh = st.key === path;
  return { data: fresh ? st.data : null, err: fresh ? st.err : "", loading: !!path && !fresh, reload: useCallback(() => setN(x => x + 1), []) };
}

// Every role an employee has: the main role first, then the extra ones
const rolesOf = (a) => [...new Set([a?.role, ...(a?.roles || [])].filter(r => ROLES[r]))];
const anyRole = (a, list) => rolesOf(a).some(r => list.includes(r));
const roleNames = (a) => rolesOf(a).map(r => ROLES[r][0]).join(" · ");
const Role = ({ a }) => <>{roleNames(a) || a.role}<span className="sub">{[...new Set(rolesOf(a).map(r => ROLES[r][1]))].join(" · ")}</span></>;
const Av = ({ name, role }) => <span className="av" style={{ background: ROLES[role]?.[2] || "#64748B" }}>{initials(name)}</span>;

export default function EmployeePortal() {
  const [tab, setTab] = useState("people");
  const [rk, setRk] = useState(0); // bump to reload the open tab
  const [unread, setUnread] = useState(null);
  const [cnt, setCnt] = useState({});
  const A = useGet("/accounts");
  const pending = (A.data || []).filter(a => a.status === "pending").length;
  // new things in each tab since it was last opened; refreshed every 30 s and when a tab is opened
  useEffect(() => {
    let live = true;
    const load = () => fetchPortalCounts().then(r => live && setCnt(r.data), () => {});
    load();
    const id = setInterval(load, 30000);
    window.addEventListener("nnc-portal-seen", load);
    return () => { live = false; clearInterval(id); window.removeEventListener("nnc-portal-seen", load); };
  }, []);
  const open = (k) => { setTab(k); markSeen(k); };
  const badge = (k) => k === "people" ? pending : k === "messages" ? (unread ?? cnt.messages ?? 0) : tab === k ? 0 : (cnt[k] || 0);
  return (
    <div className="seo-layout ep">
      <Sidebar />
      <div className="seo"><div className="seo-app">
        <header className="hd">
          <h1><UserCheck size={20} color="#2563EB" /> Employee Portal</h1>
          <nav className="tabs" aria-label="Sections">
            {TABS.map(([k, t]) => (
              <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => open(k)}>{t}{badge(k) > 0 && <em>{badge(k) > 99 ? "99+" : badge(k)}</em>}</button>
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
            {tab === "plans" && <Plans accounts={A.data || []} />}
            {tab === "today" && <Work accounts={A.data || []} today />}
            {tab === "work" && <Work accounts={A.data || []} />}
            {tab === "meetings" && <Meetings />}
            {tab === "docs" && <SharedDocs />}
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
  const all = L.filter(a => f === "all" || a.status === f);
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(10);
  const pages = Math.max(1, Math.ceil(all.length / per)), cur = Math.min(page, pages - 1);
  const shown = all.slice(cur * per, cur * per + per);
  const upd = async (a, body, ok) => {
    try { await papi(`/accounts/${a.id}`, { method: "PUT", body }); toast.success(ok); A.reload(); } catch (ex) { toast.error(ex.message); }
  };
  const reset = async (a) => {
    try { const j = await papi(`/accounts/${a.id}/reset`, { method: "POST" }); setTmp({ a, pw: j.tempPassword }); A.reload(); } catch (ex) { toast.error(ex.message); }
  };
  const remove = async (a) => {
    try { await papi(`/accounts/${a.id}`, { method: "DELETE" }); toast.success(`${a.name} deleted`); A.reload(); } catch (ex) { toast.error(ex.message); }
  };
  const [adding, setAdding] = useState(false);
  const [editFor, setEditFor] = useState(null);
  const [worksFor, setWorksFor] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [pw, setPw] = useState({ v: "", show: false, busy: false });
  const savePw = async (ev) => {
    ev.preventDefault();
    setPw(p => ({ ...p, busy: true }));
    try {
      await papi(`/accounts/${pwFor.id}/password`, { method: "PUT", body: { password: pw.v } });
      toast.success(`Password set for ${pwFor.name}`);
      setTmp({ a: pwFor, pw: pw.v, set: true }); setPwFor(null); setPw({ v: "", show: false, busy: false });
    } catch (ex) { toast.error(ex.message); setPw(p => ({ ...p, busy: false })); }
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
        <button key={k} type="button" className={`chip ${f === k ? "on" : ""}`} onClick={() => { setF(k); setPage(0); }}>{t}</button>
      ))}<span className="sp" /><button type="button" className="btn pri" onClick={() => setAdding(true)}><UserPlus size={14} /> Add employee</button></div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Employee</th><th>Role</th><th>Contact</th><th>Branch</th><th>Works on</th><th>Last sign in</th><th>Status</th><th /></tr></thead>
        <tbody>
          {A.loading ? <tr><td colSpan={8}><div className="empty">Loading…</div></td></tr> : shown.length ? shown.map(a => (
            <tr key={a.id}>
              <td><div className="ep-who"><Av name={a.name} role={a.role} /><span><b>{a.name}</b><span className="sub">joined {fd(dayOf(a.created))}</span></span></div></td>
              <td><Role a={a} /></td>
              <td>{a.email}<span className="sub">{a.phone}</span></td>
              <td>{a.branch || "-"}</td>
              <td className="ep-works">{a.orphan ? <span className="pill p-red">Removed from the CRM team</span>
                : a.role === "acc" ? <span className="sub">All projects (accounts)</span>
                : a.works.length ? <button type="button" className="btn sm" onClick={() => setWorksFor(a)}><FolderKanban size={13} /> {a.works.length} {a.works[0].kind === "client" ? "client" : "project"}{a.works.length > 1 ? "s" : ""} · View</button>
                : a.status !== "active" ? "-"
                : anyRole(a, SEO_ROLES) ? <span className="sub">Not assigned yet · <Link to="/seo-team">assign</Link></span>
                : <span className="sub">Not assigned yet · <button type="button" className="link" onClick={() => setWorksFor(a)}>assign</button></span>}</td>
              <td>{when(a.lastLogin)}<span className="sub">{a.logins} sign ins</span></td>
              <td>{a.status === "active" ? <span className="pill p-ok">Active</span> : a.status === "pending" ? <span className="pill p-amb">Waiting</span> : <span className="pill p-red">Disabled</span>}
                {a.mustChange && <span className="sub">temporary password</span>}</td>
              <td className="ep-act">
                {a.status === "pending" && <button type="button" className="btn sm pri" onClick={() => upd(a, { status: "active" }, `${a.name} approved`)}>Approve</button>}
                {a.status === "disabled" && <button type="button" className="btn sm" onClick={() => upd(a, { status: "active" }, "Account enabled")}>Enable</button>}
                <button type="button" className="btn sm" title="Edit" aria-label={`Edit ${a.name}`} onClick={() => setEditFor(a)}><Pencil size={13} /></button>
                {a.status !== "pending" && <button type="button" className="btn sm" onClick={() => { setPw({ v: "", show: false, busy: false }); setPwFor(a); }}>Set password</button>}
                {a.status !== "pending" && <button type="button" className="btn sm" onClick={() => setAsk({ kind: "reset", a })}>Reset</button>}
                {a.status !== "disabled" && <button type="button" className="btn sm late" onClick={() => setAsk({ kind: "disable", a })}>{a.status === "pending" ? "Reject" : "Disable"}</button>}
                <button type="button" className="btn sm late" title="Delete" aria-label={`Delete ${a.name}`} onClick={() => setAsk({ kind: "delete", a })}><Trash2 size={13} /></button>
              </td>
            </tr>
          )) : <tr><td colSpan={8}><div className="empty">{L.length ? "Nobody in this list." : "No employees yet. When someone creates an account in the Employee Portal, they appear here to approve."}</div></td></tr>}
        </tbody>
      </table></div>
        {all.length > 10 && <Pager total={all.length} page={cur} per={per} onPage={setPage} onPer={setPer} sizes={[10, 25, 50]} label="employees" />}
      </div>
      <p className="hint">Add employees here, or approve the ones who sign up in the portal. Each employee is listed once. Developers, designers and testers are put on projects with
        the projects button; Digital Marketing staff get their clients in SEO & Ads Team. They see only the projects or clients you assign them.</p>

      {adding && <EmployeeForm onClose={() => setAdding(false)} onDone={(pwShown) => { setAdding(false); A.reload(); if (pwShown) setTmp(pwShown); }} />}
      {editFor && <EmployeeForm a={editFor} onClose={() => setEditFor(null)} onDone={() => { setEditFor(null); A.reload(); }} />}
      {worksFor && <WorksModal a={worksFor} onClose={() => setWorksFor(null)} onDone={() => { setWorksFor(null); A.reload(); }} />}

      {ask && (
        <Modal title={ask.kind === "reset" ? `Reset ${ask.a.name}'s password?` : ask.kind === "delete" ? `Delete ${ask.a.name}?` : `${ask.a.status === "pending" ? "Reject" : "Disable"} ${ask.a.name}?`} onClose={() => setAsk(null)}>
          <p>{ask.kind === "reset" ? "You get a temporary password to share. They choose a new one when they sign in."
            : ask.kind === "delete" ? `Their Employee Portal login is deleted, and they are removed from ${["seo", "seox", "ads", "gfx"].includes(ask.a.role) ? "the SEO & Ads Team (marked inactive, taken off clients)" : "every project they are on"}. Work they already logged stays in the history. This cannot be undone.`
              : "They can no longer sign in to the Employee Portal. Their logged work stays."}</p>
          <div className="ep-row">
            <button type="button" className="btn" onClick={() => setAsk(null)}>Cancel</button>
            <button type="button" className={`btn ${ask.kind === "reset" ? "pri" : "late"}`} onClick={() => { const { kind, a } = ask; setAsk(null); if (kind === "reset") reset(a); else if (kind === "delete") remove(a); else upd(a, { status: "disabled" }, "Account disabled"); }}>
              {ask.kind === "reset" ? "Reset password" : ask.kind === "delete" ? "Delete" : ask.a.status === "pending" ? "Reject" : "Disable"}</button>
          </div>
        </Modal>
      )}
      {tmp && (
        <Modal title={tmp.set ? "Password set" : "Temporary password"} onClose={() => setTmp(null)}>
          <p>{tmp.set ? <>Share this with <b>{tmp.a.name}</b>. They sign in with <b>{tmp.a.email}</b> and this password. It is not shown again.</>
            : <>Share this with <b>{tmp.a.name}</b>. They will be asked to choose a new password when they sign in.</>}</p>
          <div className="ep-pw">{tmp.pw}</div>
          <div className="ep-row">
            <button type="button" className="btn pri" onClick={() => { copy(tmp.pw); toast.success("Copied"); }}>Copy</button>
            {tmp.a.phone && <a className="btn wa" target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/${waPhone(tmp.a.phone)}?text=${encodeURIComponent(tmp.set ? `Hi ${tmp.a.name}, your NNC Employee Portal login: ${tmp.a.email} / ${tmp.pw}` : `Hi ${tmp.a.name}, your NNC Employee Portal temporary password is ${tmp.pw}. Sign in with ${tmp.a.email} and choose a new password.`)}`}>Send on WhatsApp</a>}
          </div>
        </Modal>
      )}
      {pwFor && (
        <Modal title={`Set ${pwFor.name}'s password`} onClose={() => setPwFor(null)}>
          <form onSubmit={savePw} className="ep-form">
            <p className="sub">They sign in to the Employee Portal with <b>{pwFor.email}</b> and this password. Passwords are stored encrypted, so the current one cannot be shown: set a new one here.</p>
            <label className="f"><span className="flabel">New password</span>
              <span className="ep-pwin"><input type={pw.show ? "text" : "password"} value={pw.v} onChange={e => setPw(p => ({ ...p, v: e.target.value }))} minLength={8} required autoComplete="new-password" />
                <button type="button" onClick={() => setPw(p => ({ ...p, show: !p.show }))} aria-label={pw.show ? "Hide password" : "Show password"}>{pw.show ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            <span className="sub">At least 8 characters, with a number.</span>
            <div className="ep-row"><button type="button" className="btn" onClick={() => setPwFor(null)}>Cancel</button><button className="btn pri" disabled={pw.busy}>{pw.busy ? "Saving…" : "Set password"}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// Ticks the projects an employee is on: theirs first, then every other project
function ProjectChecks({ list, value, onChange }) {
  const [q, setQ] = useState("");
  const all = [...(list?.mine || []), ...(list?.others || [])];
  const shown = all.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => Number(value.includes(y.id)) - Number(value.includes(x.id)));
  const flip = (id) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  return (
    <>
      <input type="text" placeholder="Search projects…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="ep-pick">
        {!list ? <div className="empty">Loading…</div> : shown.length ? shown.map(p => (
          <label key={p.id} className={value.includes(p.id) ? "on" : ""}>
            <input type="checkbox" checked={value.includes(p.id)} onChange={() => flip(p.id)} />
            <span>{p.name}</span>{p.stage && <span className="pill p-other">{p.stage}</span>}
          </label>
        )) : <div className="empty">No projects found.</div>}
      </div>
    </>
  );
}

// Add an employee (active straight away, with a password) or edit one's details
function EmployeeForm({ a, onClose, onDone }) {
  const isNew = !a;
  const [d, setD] = useState({ name: a?.name || "", email: a?.email || "", phone: a?.phone === "-" ? "" : a?.phone || "", branch: a?.branch || "Bangalore", password: "" });
  const [roles, setRoles] = useState(() => (a ? rolesOf(a) : ["full"]));   // the first one is the main role
  const main = roles[0] || "";
  const togRole = (k) => setRoles(L => (L.includes(k) ? L.filter(x => x !== k) : [...L, k]));
  const onProjects = roles.some(r => PROJECT_ROLES.includes(r));
  const [ids, setIds] = useState([]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const Pj = useGet(isNew && onProjects ? "/accounts/new/projects" : "");
  const set = (k) => (e) => setD(x => ({ ...x, [k]: e.target.value }));
  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    if (!roles.length) { toast.error("Pick at least one role"); return; }
    setBusy(true);
    try {
      if (isNew) {
        await papi("/accounts", { method: "POST", body: { ...d, role: main, roles: roles.slice(1), projectIds: onProjects ? ids : [] } });
        toast.success(`${d.name} added. They can sign in to the Employee Portal now`);
        onDone({ a: { name: d.name, email: d.email, phone: d.phone }, pw: d.password, set: true });
      } else {
        await papi(`/accounts/${a.id}`, { method: "PUT", body: { name: d.name, phone: d.phone, branch: d.branch, role: main, roles: roles.slice(1) } });
        toast.success("Employee updated"); onDone();
      }
    } catch (ex) { toast.error(ex.message); setBusy(false); }
  };
  return (
    <Modal title={isNew ? "Add employee" : `Edit ${a.name}`} onClose={onClose} wide={isNew}>
      <form onSubmit={submit} className="ep-form">
        <div className="g2">
          <label className="f"><span className="flabel">Full name</span><input type="text" required value={d.name} onChange={set("name")} /></label>
          <label className="f"><span className="flabel">Main role</span><select value={main} onChange={e => setRoles(L => [e.target.value, ...L.filter(x => x !== e.target.value)])}>
            {DEPTS.map(g => <optgroup key={g} label={g}>{Object.entries(ROLES).filter(([, r]) => r[1] === g).map(([k, r]) => <option key={k} value={k}>{r[0]}</option>)}</optgroup>)}
          </select></label>
          <label className="f"><span className="flabel">Email (their portal login)</span><input type="email" required disabled={!isNew} value={d.email} onChange={set("email")} /></label>
          <label className="f"><span className="flabel">Mobile number</span><input type="tel" value={d.phone} onChange={set("phone")} /></label>
          <label className="f"><span className="flabel">Branch</span><select value={d.branch} onChange={set("branch")}>{BRANCHES.map(b => <option key={b}>{b}</option>)}</select></label>
        </div>
        <div className="f"><span className="flabel">All their roles ({roles.length}) · tick every kind of work they do</span>
          <div className="ep-roles">{DEPTS.map(g => (
            <div key={g} className="ep-rg"><b>{g}</b>
              {Object.entries(ROLES).filter(([, r]) => r[1] === g).map(([k, r]) => (
                <label key={k} className={`ep-rc ${roles.includes(k) ? "on" : ""}`}><input type="checkbox" checked={roles.includes(k)} onChange={() => togRole(k)} />{r[0]}{k === main && <em>main</em>}</label>
              ))}
              {Object.entries(ROLES).filter(([, r]) => r[1] === g).length > 1 && (
                <button type="button" className="link" onClick={() => { const K = Object.entries(ROLES).filter(([, r]) => r[1] === g).map(([k]) => k); const all = K.every(k => roles.includes(k)); setRoles(L => (all ? L.filter(x => !K.includes(x)) : [...L, ...K.filter(k => !L.includes(k))])); }}>
                  {Object.entries(ROLES).filter(([, r]) => r[1] === g).every(([k]) => roles.includes(k)) ? "Clear" : "All"}</button>
              )}
            </div>
          ))}</div>
          <span className="sub">Their portal shows the pages and work types of every role ticked. The main role decides their colour and title.</span>
        </div>
        {isNew && (
          <label className="f"><span className="flabel">Password</span>
            <span className="ep-pwin"><input type={show ? "text" : "password"} value={d.password} onChange={set("password")} minLength={8} required autoComplete="new-password" />
              <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
            <span className="sub">At least 8 characters, with a number. Share it with them after saving.</span></label>
        )}
        {isNew && onProjects && (
          <div className="f"><span className="flabel">Projects ({ids.length})</span><ProjectChecks list={Pj.data} value={ids} onChange={setIds} /></div>
        )}
        {isNew && roles.some(r => SEO_ROLES.includes(r)) && <p className="sub">Assign their clients in SEO &amp; Ads Team after adding them.</p>}
        <div className="ep-row"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={busy}>{busy ? "Saving…" : isNew ? "Add employee" : "Save"}</button></div>
      </form>
    </Modal>
  );
}

// Everything an employee works on; developers, designers and testers can be moved between projects here
function WorksModal({ a, onClose, onDone }) {
  const canEdit = PROJECT_ROLES.includes(a.role);
  const [editing, setEditing] = useState(!a.works.length && canEdit);
  const [ids, setIds] = useState(a.works.filter(w => w.kind === "project").map(w => w.id));
  const [busy, setBusy] = useState(false);
  const Pj = useGet(editing ? `/accounts/${a.id}/projects` : "");
  const save = async () => {
    setBusy(true);
    try { await papi(`/accounts/${a.id}/projects`, { method: "PUT", body: { projectIds: ids } }); toast.success("Projects updated"); onDone(); }
    catch (ex) { toast.error(ex.message); setBusy(false); }
  };
  const kind = a.works[0]?.kind === "client" ? "Clients" : "Projects";
  return (
    <Modal title={`${a.name} · ${editing ? "choose projects" : kind.toLowerCase()}`} onClose={onClose} wide={editing}>
      {editing ? (
        <>
          <ProjectChecks list={Pj.data} value={ids} onChange={setIds} />
          <div className="ep-row"><button type="button" className="btn" onClick={() => (a.works.length ? setEditing(false) : onClose())}>Cancel</button>
            <button type="button" className="btn pri" disabled={busy} onClick={save}>{busy ? "Saving…" : `Save ${ids.length} project${ids.length === 1 ? "" : "s"}`}</button></div>
        </>
      ) : (
        <>
          <div className="ep-pick ro">{a.works.map(w => (
            <div key={w.id} className="row"><span>{w.name}</span>{w.stage && <span className={`pill ${w.stage === "Project Completed" ? "p-ok" : "p-blue"}`}>{w.stage}</span>}</div>
          ))}</div>
          <div className="ep-row">
            {canEdit ? <button type="button" className="btn pri" onClick={() => setEditing(true)}>Change projects</button>
              : <Link className="btn" to="/seo-team">Change clients in SEO &amp; Ads Team</Link>}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ───────── Today and the work log ───────── */
// "In 9:40 am · Out 6:05 pm · 8h 25m", or "· still in" while checked in
const tm = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
function attTxt(L) {
  const open = L.find(x => !x.out), last = [...L].reverse().find(x => x.out);
  const m = L.reduce((a, x) => a + ((x.out ? new Date(x.out) : new Date()) - new Date(x.in)) / 60000, 0);
  return `In ${tm(L[0].in)}${open ? " · still in" : last ? ` · Out ${tm(last.out)}` : ""} · ${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m${L.length > 1 ? ` (${L.length} sessions)` : ""}`;
}

function Work({ accounts, today }) {
  const [rg, setRg] = useState(today ? "today" : "week");
  const [team, setTeam] = useState("all");
  const [who, setWho] = useState("");
  const [assign, setAssign] = useState(null);
  const [person, setPerson] = useState(null);   // Work log: the employee whose work is open
  const from = T(RANGES.find(r => r[0] === (today ? "today" : rg))[2]);
  const W = useGet(`/work?from=${from}&to=${T(0)}`);
  const d = W.data || { accounts: [], work: [], days: [], blockers: [], attendance: [] };
  const roles = TEAMS[team][1];
  const accs = d.accounts.filter(a => !roles || anyRole(a, roles));
  const ids = new Set(accs.map(a => a.id));
  const acc = (id) => d.accounts.find(a => a.id === String(id));
  const work = d.work.filter(w => ids.has(String(w.account)) && (!who || String(w.account) === who));
  const days = d.days.filter(x => ids.has(String(x.account)));
  const bl = d.blockers.filter(b => ids.has(String(b.account)));
  const active = accs.filter(a => a.status === "active");
  const per = active.map(a => {
    const L = work.filter(w => String(w.account) === a.id);
    const day = days.find(x => String(x.account) === a.id && x.date === T(0));
    const att = (d.attendance || []).find(x => String(x.account) === a.id && x.date === T(0));
    return { a, hrs: L.reduce((s, w) => s + (w.hrs || 0), 0), extra: L.filter(w => w.meta?.extra).reduce((s, w) => s + (w.hrs || 0), 0), n: L.length, sub: days.filter(x => String(x.account) === a.id).length, day, att };
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
        <div className="kpi"><span className="l">Checked in today</span><span className="v">{(d.attendance || []).filter(x => x.date === T(0) && ids.has(String(x.account)) && x.sessions?.length).length} / {active.length}</span></div>
        <div className="kpi"><span className="l">Open blockers</span><span className={`v ${bl.length ? "red" : ""}`}>{bl.length}</span></div>
      </div>
      {bl.length > 0 && (
        <div className="card"><h3>Blockers <small>employees waiting on something</small></h3>
          <div className="ll flat">{bl.map(b => (
            <div key={b._id}><span className="d">{fd(b.date)}</span><span className="x"><b>{acc(b.account)?.name}</b> · {b.text}{b.refName ? ` · ${b.refName}` : ""}</span>
              <button type="button" className="btn sm" onClick={() => resolve(b._id)}>Sorted</button></div>
          ))}</div></div>
      )}
      {today ? (
      <div className="ep-grid">
        <div className="card"><h3>{today ? "Logged today" : "Work logged"} <small>{work.length} items · {h1(work.reduce((s, w) => s + (w.hrs || 0), 0))} h</small></h3>
          {W.loading ? <div className="empty">Loading…</div> : work.length ? (
            <div className="ll flat">{work.slice(0, 300).map(e => (
              <div key={e._id}>
                <span className="d">{today ? <Av name={acc(e.account)?.name} role={acc(e.account)?.role} /> : fd(e.date)}</span>
                <span className="x"><span className="pill p-other">{TY[e.type] || e.type}</span>{e.meta?.extra && <> <span className="pill p-amb">Extra work</span></>} <b>{e.title}</b>
                  <span className="sub">{[acc(e.account)?.name, e.refName, metaTxt(e)].filter(Boolean).join(" · ")}</span>
                  {e.url && <a className="url" href={e.url} target="_blank" rel="noopener noreferrer">{e.url.replace(/^https?:\/\//, "")}</a>}<WorkFiles e={e} /></span>
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
                <span className="x"><b>{p.a.name}</b><span className="sub">{roleNames(p.a)} · {p.n} items{p.extra ? ` · ${h1(p.extra)} h extra` : ""}{today ? "" : ` · ${p.sub} days submitted`}</span>
                  {p.att?.sessions?.length > 0 && <span className="sub">{attTxt(p.att.sessions)}</span>}
                  {p.day && (p.day.note || p.day.plan) && <span className="sub">{p.day.note}{p.day.plan ? ` · Tomorrow: ${p.day.plan}` : ""}</span>}</span>
                <span className="num">{h1(p.hrs)} h</span>
                {p.day ? <span className="pill p-ok">Day sent {p.day.at}</span> : <span className="pill p-amb">Today open</span>}
              </div>
            ))}</div>
          ) : <div className="empty">No active employees in this team yet.</div>}
        </div>
      </div>
      ) : (
        <div className="card"><h3>People <small>{RANGES.find(r => r[0] === rg)[1].toLowerCase()} · click a person to see all their work</small></h3>
          {W.loading ? <div className="empty">Loading…</div> : per.length ? (
            <div className="tw"><table className="ep-people">
              <thead><tr><th>Employee</th><th>Check in today</th><th>Check out today</th><th className="n">Items</th><th className="n">Days submitted</th><th className="n">Hours</th><th>Today</th><th /></tr></thead>
              <tbody>{per.filter(p => !who || p.a.id === who).map(p => {
                const S = p.att?.sessions || [], open = S.find(x => !x.out), last = [...S].reverse().find(x => x.out);
                return (
                  <tr key={p.a.id} onClick={() => setPerson(p.a.id)}>
                    <td><div className="ep-who"><Av name={p.a.name} role={p.a.role} /><span><b>{p.a.name}</b><span className="sub">{roleNames(p.a)}</span></span></div></td>
                    <td>{S.length ? <b>{tm(S[0].in)}</b> : <span className="sub">Not checked in</span>}</td>
                    <td>{open ? <span className="pill p-ok">Still in</span> : last ? <b>{tm(last.out)}</b> : <span className="sub">-</span>}
                      {S.length > 0 && <span className="sub">{attTxt(S).split(" · ").pop()}</span>}</td>
                    <td className="n">{p.n}</td>
                    <td className="n">{p.sub}</td>
                    <td className="n"><b>{h1(p.hrs)} h</b>{p.extra > 0 && <span className="sub">{h1(p.extra)} h extra</span>}</td>
                    <td>{p.day ? <span className="pill p-ok">Sent {p.day.at}</span> : <span className="pill p-amb">Open</span>}</td>
                    <td className="r"><button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); setPerson(p.a.id); }}>View <ChevronRight size={14} /></button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          ) : <div className="empty">No active employees in this team yet.</div>}
        </div>
      )}
      {person && <PersonWork a={acc(person)} work={work.filter(w => String(w.account) === person)} days={days.filter(x => String(x.account) === person)}
        attendance={(d.attendance || []).filter(x => String(x.account) === person)} period={RANGES.find(r => r[0] === rg)[1]} onClose={() => setPerson(null)} />}
      {assign && <AssignTask accounts={accounts.filter(a => a.status === "active" && (!roles || anyRole(a, roles)))} init={assign} onClose={() => setAssign(null)} onDone={() => setAssign(null)} />}
    </>
  );
}

// Everything one employee logged in the period, day by day, with their check in / out and day note
function PersonWork({ a, work, days, attendance, period, onClose }) {
  const dates = [...new Set([...work.map(w => w.date), ...days.map(x => x.date), ...attendance.filter(x => x.sessions?.length).map(x => x.date)])].sort().reverse();
  const hrs = work.reduce((s, w) => s + (w.hrs || 0), 0), extra = work.filter(w => w.meta?.extra).reduce((s, w) => s + (w.hrs || 0), 0);
  if (!a) return null;
  return (
    <Modal title={`${a.name} · ${period}`} onClose={onClose} wide>
      <p className="sub" style={{ marginTop: 0 }}>{roleNames(a)} · {work.length} items · {h1(hrs)} h{extra ? ` (${h1(extra)} h extra)` : ""} · {days.length} days submitted</p>
      {dates.length ? dates.map(dt => {
        const L = work.filter(w => w.date === dt), day = days.find(x => x.date === dt), att = attendance.find(x => x.date === dt);
        return (
          <div key={dt} className="ep-pday">
            <div className="ep-pday-h"><b>{fd(dt)}</b>
              <span className="sub">{h1(L.reduce((s, w) => s + (w.hrs || 0), 0))} h · {L.length} items{att?.sessions?.length ? ` · ${attTxt(att.sessions)}` : ""}</span>
              {day ? <span className="pill p-ok">Sent {day.at}</span> : <span className="pill p-amb">Not submitted</span>}</div>
            {day && (day.note || day.plan) && <div className="sub ep-pnote">{day.note}{day.plan ? `${day.note ? " · " : ""}Tomorrow: ${day.plan}` : ""}</div>}
            <div className="ll flat">{L.map(e => (
              <div key={e._id}>
                <span className="x"><span className="pill p-other">{TY[e.type] || e.type}</span>{e.meta?.extra && <> <span className="pill p-amb">Extra work</span></>} <b>{e.title}</b>
                  <span className="sub">{[e.refName, metaTxt(e)].filter(Boolean).join(" · ")}</span>
                  {e.url && <a className="url" href={e.url} target="_blank" rel="noopener noreferrer">{e.url.replace(/^https?:\/\//, "")}</a>}<WorkFiles e={e} /></span>
                <span className="num">{h1(e.hrs)} h</span>
              </div>
            ))}{!L.length && <div className="empty">Nothing logged.</div>}</div>
          </div>
        );
      }) : <div className="empty">Nothing logged in this period.</div>}
    </Modal>
  );
}

function AssignTask({ accounts, init, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState(init.account || "");
  const Pj = useGet(who ? `/accounts/${who}/projects` : "");
  const submit = async (ev) => {
    ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    const ref = f.refId === "__other" ? "" : f.refId || "";
    setBusy(true);
    try { await papi("/tasks", { method: "POST", body: { account: f.account, title: f.title.trim(), refId: ref, refName: (f.refName || "").trim(), due: f.due } }); toast.success("Task assigned"); onDone(); }
    catch (ex) { toast.error(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Assign a task" onClose={onClose}>
      <form onSubmit={submit} className="ep-form">
        <label className="f"><span className="flabel">Employee</span><select name="account" required value={who} onChange={e => setWho(e.target.value)}>
          <option value="">Choose</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {roleNames(a)}</option>)}</select></label>
        <label className="f"><span className="flabel">Task</span><input name="title" type="text" required /></label>
        <div className="g2">
          <ProjectPick key={who} who={who} loading={Pj.loading} list={Pj.data} />
          <label className="f"><span className="flabel">Due</span><input name="due" type="date" required defaultValue={T(0)} min={T(0)} /></label>
        </div>
        <div className="ep-row"><button className="btn pri" disabled={busy}>{busy ? "Saving…" : "Assign"}</button></div>
      </form>
    </Modal>
  );
}

// Project (or SEO client) the task is for: the employee's own first, then every other project
function ProjectPick({ who, loading, list }) {
  const [v, setV] = useState("");
  const mine = list?.mine || [], others = list?.others || [];
  const isClient = mine[0]?.kind === "client";
  const opt = p => <option key={p.id} value={p.id}>{p.name}{p.stage ? ` · ${p.stage}` : ""}</option>;
  return (
    <label className="f"><span className="flabel">{isClient ? "Client" : "Project"} (optional)</span>
      <select name="refId" value={v} onChange={e => setV(e.target.value)} disabled={!who || loading}>
        <option value="">{!who ? "Choose the employee first" : loading ? "Loading…" : "Not for a project"}</option>
        {mine.length > 0 && <optgroup label={isClient ? "Their clients" : "Their projects"}>{mine.map(opt)}</optgroup>}
        {others.length > 0 && <optgroup label="Other projects">{others.map(opt)}</optgroup>}
        <option value="__other">Something else (type it)</option>
      </select>
      {v === "__other" && <input name="refName" type="text" placeholder="Client or project name" style={{ marginTop: 8 }} />}
    </label>
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

/* ───────── Plans for today ───────── */
// What each employee planned for the day in the portal, and how much of it is ticked off
function Plans({ accounts }) {
  const [date, setDate] = useState(T(0));
  const [team, setTeam] = useState("all");
  const [q, setQ] = useState("");
  const D = useGet(`/plans?date=${date}`);
  const inTeam = (a) => team === "all" || anyRole(a, TEAMS[team][1]);
  const match = (a) => !q.trim() || String(a?.name || "").toLowerCase().includes(q.trim().toLowerCase());
  const withItems = (D.data?.plans || []).filter(p => p.items.length);
  const shown = withItems.filter(p => inTeam(p.account) && match(p.account));
  const has = new Set(withItems.map(p => String(p.account._id)));
  const missing = accounts.filter(a => a.status === "active" && !has.has(a.id) && inTeam(a) && match(a));
  const items = shown.flatMap(p => p.items), done = items.filter(i => i.done).length;
  const tm = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");
  const isToday = date === T(0);
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="l">Employees with a plan</span><span className="v">{shown.length}</span></div>
        <div className="kpi"><span className="l">Plans</span><span className="v">{items.length}</span></div>
        <div className="kpi"><span className="l">Done</span><span className="v ok">{done}</span></div>
        <div className="kpi"><span className="l">{isToday ? "Not added yet" : "No plan that day"}</span><span className="v amb">{missing.length}</span></div>
      </div>
      <div className="filters ep-mfil">
        <label>Day <input type="date" value={date} max={T(0)} onChange={e => e.target.value && setDate(e.target.value)} /></label>
        {!isToday && <button type="button" className="btn sm" onClick={() => setDate(T(0))}>Today</button>}
        {Object.entries(TEAMS).map(([k, [t]]) => <button key={k} type="button" className={`chip ${team === k ? "on" : ""}`} onClick={() => setTeam(k)}>{t}</button>)}
        <input type="search" placeholder="Search employee" value={q} onChange={e => setQ(e.target.value)} aria-label="Search employee" />
      </div>
      {D.loading ? <div className="card"><div className="empty">Loading…</div></div>
        : D.err ? <div className="card"><div className="empty err">{D.err}</div></div> : (
        <>
          {shown.length ? (
            <div className="ep-plans">
              {shown.map(p => {
                const n = p.items.filter(i => i.done).length;
                return (
                  <section key={p._id} className="card ep-plan">
                    <div className="ep-plan-h">
                      <Av name={p.account.name} role={p.account.role} />
                      <div className="nm"><b>{p.account.name}</b><span className="sub">{roleNames(p.account)}{p.account.branch ? ` · ${p.account.branch}` : ""}</span></div>
                      <span className={`pill ${n === p.items.length ? "p-ok" : "p-other"}`}>{n} of {p.items.length} done</span>
                    </div>
                    <div className="ep-plan-bar"><i style={{ width: `${Math.round((n / p.items.length) * 100)}%` }} /></div>
                    <ul>
                      {p.items.map(i => (
                        <li key={i._id} className={i.done ? "done" : ""}>
                          {i.done ? <CheckCircle2 size={16} color="#16a34a" /> : <Circle size={16} color="#94a3b8" />}
                          <span className="t"><Linkify text={i.text} />{i.refName && <span className="sub">{i.refName}</span>}</span>
                          {i.done && i.doneAt && <span className="sub when">{tm(i.doneAt)}</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="sub ep-plan-f">Last change {tm(p.updatedAt)}</p>
                  </section>
                );
              })}
            </div>
          ) : <div className="card" style={{ marginBottom: 14 }}><div className="empty">{withItems.length ? "No plans match these filters." : isToday ? "No employee has added a plan for today yet." : "No plans were added that day."}</div></div>}
          {missing.length > 0 && (
            <div className="card"><h3>{isToday ? "Not added a plan yet" : "No plan that day"} <small>{missing.length}</small></h3>
              <div className="ep-miss">{missing.map(a => <span key={a.id}>{a.name}</span>)}</div></div>
          )}
        </>
      )}
    </>
  );
}

/* ───────── Meetings ───────── */
// Documents employees sent each other (for example a tester to a developer), with replies
function SharedDocs() {
  const D = useGet("/docs");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const L = (D.data || []).filter(d => !q || `${d.title} ${d.refName} ${d.fromName} ${d.toName} ${d.text}`.toLowerCase().includes(q.toLowerCase()));
  const tm = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const href = (u) => (/^https?:/.test(u) ? u : `${API}${u}`);
  const all = D.data || [];
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="l">Shared</span><span className="v">{all.length}</span></div>
        <div className="kpi"><span className="l">Not opened yet</span><span className="v amb">{all.filter(d => !d.seenAt).length}</span></div>
        <div className="kpi"><span className="l">Marked done</span><span className="v ok">{all.filter(d => d.done).length}</span></div>
        <div className="kpi"><span className="l">Files</span><span className="v">{all.reduce((a, d) => a + d.files.length, 0)}</span></div>
      </div>
      <div className="filters"><input type="search" className="ep-in" placeholder="Search title, project or person" value={q} onChange={e => setQ(e.target.value)} aria-label="Search documents" /></div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Document</th><th>From</th><th>To</th><th>Project</th><th>Sent</th><th>Status</th><th /></tr></thead>
        <tbody>{D.loading ? <tr><td colSpan={7}><div className="empty">Loading…</div></td></tr> : D.err ? <tr><td colSpan={7}><div className="empty err">{D.err}</div></td></tr> : L.length ? L.map(d => (
          <tr key={d._id}>
            <td><b>{d.title}</b><span className="sub">{d.files.length} file{d.files.length === 1 ? "" : "s"}{d.replies.length ? ` · ${d.replies.length} repl${d.replies.length === 1 ? "y" : "ies"}` : ""}</span></td>
            <td>{d.fromName}</td><td>{d.toName}</td><td>{d.refName || "-"}</td><td>{tm(d.createdAt)}</td>
            <td>{d.done ? <span className="pill p-ok">Done</span> : d.seenAt ? <span className="pill p-blue">Seen</span> : <span className="pill p-amb">Not opened</span>}</td>
            <td className="r"><button type="button" className="btn sm" onClick={() => setOpen(d)}>View</button></td>
          </tr>
        )) : <tr><td colSpan={7}><div className="empty">Nothing shared yet. Documents employees send each other from the portal appear here.</div></td></tr>}</tbody>
      </table></div></div>
      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <p className="sub">{open.fromName} to {open.toName}{open.refName ? ` · ${open.refName}` : ""} · {tm(open.createdAt)}{open.seenAt ? ` · seen ${tm(open.seenAt)}` : " · not opened yet"}</p>
          {open.text && <pre className="ep-mom">{open.text}</pre>}
          {open.files.length > 0 && <div className="ep-docs">{open.files.map(f => <a key={f.url} href={href(f.url)} target="_blank" rel="noopener noreferrer" className="btn sm">{f.name}</a>)}</div>}
          {open.replies.map((r, i) => (
            <div key={i} style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
              <b>{r.name}</b> <span className="sub" style={{ display: "inline" }}>{tm(r.at)}</span>
              {r.text && <pre className="ep-mom">{r.text}</pre>}
              {r.files?.length > 0 && <div className="ep-docs">{r.files.map(f => <a key={f.url} href={href(f.url)} target="_blank" rel="noopener noreferrer" className="btn sm">{f.name}</a>)}</div>}
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}

function Meetings() {
  const M = useGet("/meetings");
  const [open, setOpen] = useState(null);
  const all = M.data || [];
  const sent = (m) => m.sentWa || m.sentMail;
  const [fl, setFl] = useState({ q: "", who: "", mom: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(10);
  const setF = (k) => (e) => { setFl(s => ({ ...s, [k]: e.target.value })); setPage(0); };
  const people = [...new Map(all.filter(m => m.account?._id).map(m => [m.account._id, m.account.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const momOf = (m) => (!m.momTxt ? "notes" : sent(m) ? "sent" : "unsent");
  const L = all.filter(m => {
    const d = dayOf(m.date);
    if (fl.who && m.account?._id !== fl.who) return false;
    if (fl.mom && momOf(m) !== fl.mom) return false;
    if (fl.from && d < fl.from) return false;
    if (fl.to && d > fl.to) return false;
    const q = fl.q.trim().toLowerCase();
    return !q || [m.title, m.refName, m.account?.name, m.mode].some(v => String(v || "").toLowerCase().includes(q));
  });
  const pages = Math.max(1, Math.ceil(L.length / per)), cur = Math.min(page, pages - 1);
  const shown = L.slice(cur * per, cur * per + per);
  const filtered = !!(fl.q || fl.who || fl.mom || fl.from || fl.to);
  const del = async (m) => {
    if (!window.confirm(`Delete the meeting "${m.title}" by ${m.account?.name || "this employee"}? Its notes, MOM and timesheet entry are deleted too.`)) return;
    try { await papi(`/meetings/${m._id}`, { method: "DELETE" }); toast.success("Meeting deleted"); setOpen(null); M.reload(); }
    catch (ex) { toast.error(ex.message); }
  };
  // The list leaves photos out to stay fast; load them when a meeting is opened
  const view = (m) => {
    setOpen(m);
    papi(`/meetings/${m._id}`).then(j => setOpen(o => (o?._id === m._id ? j.data : o)), (ex) => toast.error(ex.message));
  };
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="l">Meetings</span><span className="v">{L.length}</span></div>
        <div className="kpi"><span className="l">MOM sent</span><span className="v ok">{L.filter(sent).length}</span></div>
        <div className="kpi"><span className="l">MOM written, not sent</span><span className="v">{L.filter(m => m.momTxt && !sent(m)).length}</span></div>
        <div className="kpi"><span className="l">Notes only</span><span className="v amb">{L.filter(m => !m.momTxt).length}</span></div>
      </div>
      <div className="filters ep-mfil">
        <input type="search" placeholder="Search meeting, client or employee" value={fl.q} onChange={setF("q")} aria-label="Search meetings" />
        <select value={fl.who} onChange={setF("who")} aria-label="Employee"><option value="">All employees</option>{people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select value={fl.mom} onChange={setF("mom")} aria-label="MOM"><option value="">Any MOM status</option><option value="sent">MOM sent</option><option value="unsent">MOM written, not sent</option><option value="notes">Notes only</option></select>
        <label>From <input type="date" value={fl.from} max={fl.to || undefined} onChange={setF("from")} /></label>
        <label>To <input type="date" value={fl.to} min={fl.from || undefined} onChange={setF("to")} /></label>
        {filtered && <button type="button" className="btn sm" onClick={() => { setFl({ q: "", who: "", mom: "", from: "", to: "" }); setPage(0); }}>Clear</button>}
      </div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Meeting</th><th>Client or project</th><th>By</th><th>When</th><th>MOM</th><th /></tr></thead>
        <tbody>{M.loading ? <tr><td colSpan={6}><div className="empty">Loading…</div></td></tr> : M.err ? <tr><td colSpan={6}><div className="empty err">{M.err}</div></td></tr> : shown.length ? shown.map(m => (
          <tr key={m._id}>
            <td><b>{m.title}</b><span className="sub">{m.mode}</span></td>
            <td>{m.refName || "Internal"}</td>
            <td>{m.account?.name || "-"}<span className="sub">{ROLES[m.account?.role]?.[0]}</span></td>
            <td>{fdw(m.date)}{m.time ? `, ${m.time}` : ""}</td>
            <td>{!m.momTxt ? <span className="pill p-amb">Notes only</span> : sent(m) ? <span className="pill p-ok">Sent{m.sentWa ? " · WhatsApp" : ""}{m.sentMail ? " · Email" : ""}</span> : <span className="pill p-blue">Not sent</span>}</td>
            <td className="r" style={{ whiteSpace: "nowrap" }}><button type="button" className="btn sm" onClick={() => view(m)}>View</button>{" "}
              <button type="button" className="btn sm late" title="Delete" aria-label={`Delete ${m.title}`} onClick={() => del(m)}><Trash2 size={13} /></button></td>
          </tr>
        )) : <tr><td colSpan={6}><div className="empty">{all.length ? "No meetings match these filters." : "No meetings yet. Meetings logged by employees appear here."}</div></td></tr>}</tbody>
      </table></div>
        {L.length > 10 && <Pager total={L.length} page={cur} per={per} onPage={setPage} onPer={setPer} sizes={[10, 25, 50]} label="meetings" />}
      </div>
      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <p className="sub">{[open.refName || "Internal", fdw(open.date), open.account?.name].filter(Boolean).join(" · ")}
            <button type="button" className="btn sm late" style={{ float: "right" }} onClick={() => del(open)}><Trash2 size={13} /> Delete</button></p>
          <pre className="ep-mom">{open.momTxt || open.notes}</pre>
          {open.files?.length > 0 && <div className="ep-docs">{open.files.map(f => (
            <a key={f.url} href={/^https?:/.test(f.url) ? f.url : `${API}${f.url}`} target="_blank" rel="noopener noreferrer" className="btn sm">{f.name}</a>
          ))}</div>}
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
