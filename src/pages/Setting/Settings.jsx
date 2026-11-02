import { Fragment, useCallback, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import {
  User, Users, Building2, DollarSign, Target,
  FileBarChart2, Save, Plus, Trash2, Edit3, Eye, EyeOff,
  CheckCircle2, XCircle, RefreshCcw, Send, Shield, X, UserCheck, Receipt, Landmark, Code2,
} from "lucide-react";
import { PROJECT_STAGE_COLOR, projectStageLabel } from "../../Leads/projectStages";
import "./Settings.css";

const API   = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const BRANCHES    = ["Mysore","Bangalore","Mumbai"];
const ALL_MODULES = [
  "dashboard","todays-plan","pipeline","all-leads","enquiries","calendar",
  "documents","analytics","leaderboard","branch-reports","payment-tracker",
  "expense-tracker","pnl","funds","accounting","attendance","settings",
];

const MODULE_LABELS = {
  "dashboard":       "Dashboard",
  "todays-plan":     "Today's Plan",
  "pipeline":        "Pipeline",
  "all-leads":       "All Leads",
  "enquiries":       "Enquiries",
  "calendar":        "Calendar",
  "documents":       "Documents",
  "analytics":       "Analytics / BI",
  "leaderboard":     "Leaderboard",
  "branch-reports":  "Branch Reports",
  "payment-tracker": "Payment Tracker",
  "expense-tracker": "Expense Tracker",
  "pnl":             "P&L Report",
  "funds":           "Reserve Funds",
  "accounting":      "Accounting",
  "attendance":      "Attendance & Salary",
  "settings":        "Settings",
};

/* Permission helpers — encode as "module:level" strings in modules[] array */
const getLevel = (mods, key) => {
  if (!mods) return "none";
  if (mods.includes(`${key}:edit`)) return "edit";
  if (mods.includes(`${key}:view`)) return "view";
  if (mods.includes(key)) return "edit"; // legacy bare key = full edit
  return "none";
};
const setLevel = (mods, key, level) => {
  const base = (mods || []).filter(m => m !== key && m !== `${key}:view` && m !== `${key}:edit`);
  return level === "none" ? base : [...base, `${key}:${level}`];
};

function auth() {
  const t = localStorage.getItem("nnc_token");
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: auth(), body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`st-toast st-toast-${type}`}>
      {type === "success" ? <CheckCircle2 size={15}/> : <XCircle size={15}/>}
      {msg}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div className="st-section">
      <div className="st-section-head">
        <div className="st-section-title">{title}</div>
        {sub && <div className="st-section-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Field helpers ──────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return <div className="st-field"><label>{label}</label>{children}</div>;
}
function Input(props) { return <input className="st-input" {...props}/>; }
function Select({ children, ...props }) { return <select className="st-select" {...props}>{children}</select>; }

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Profile
// ══════════════════════════════════════════════════════════════════════════════
function ProfileTab({ toast }) {
  const user = JSON.parse(localStorage.getItem("nnc_user") || "{}");
  const [pw, setPw] = useState({ cur:"", next:"", confirm:"" });
  const [show, setShow] = useState({ cur:false, next:false, confirm:false });
  const [saving, setSaving] = useState(false);

  // Forgot password / OTP flow
  const [fpStep, setFpStep] = useState(0); // 0=hidden, 1=enter email, 2=enter OTP+new pw
  const [fpEmail, setFpEmail] = useState(user.email || "");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPw, setFpNewPw] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpShowPw, setFpShowPw] = useState(false);

  const save = async () => {
    if (!pw.cur || !pw.next || !pw.confirm) return toast("error","All fields are required");
    if (pw.next.length < 6)                 return toast("error","New password must be at least 6 characters");
    if (pw.next !== pw.confirm)             return toast("error","Passwords do not match");
    setSaving(true);
    try {
      const j = await api("PUT","/api/auth/change-password",{ currentPassword:pw.cur, newPassword:pw.next });
      if (!j.success) throw new Error(j.message);
      toast("success","Password changed successfully");
      setPw({ cur:"", next:"", confirm:"" });
    } catch(e) { toast("error", e.message || "Failed"); }
    finally { setSaving(false); }
  };

  const sendOtp = async () => {
    if (!fpEmail.trim()) return toast("error", "Email is required");
    setFpLoading(true);
    try {
      const j = await api("POST", "/api/auth/forgot-password", { email: fpEmail.trim() });
      if (!j.success) throw new Error(j.message);
      toast("success", "OTP sent to your email");
      setFpStep(2);
    } catch(e) { toast("error", e.message || "Failed to send OTP"); }
    finally { setFpLoading(false); }
  };

  const resetWithOtp = async () => {
    if (!fpOtp.trim())       return toast("error", "OTP is required");
    if (!fpNewPw.trim())     return toast("error", "New password is required");
    if (fpNewPw.length < 6)  return toast("error", "Password must be at least 6 characters");
    if (fpNewPw !== fpConfirm) return toast("error", "Passwords do not match");
    setFpLoading(true);
    try {
      const j = await api("POST", "/api/auth/reset-password", {
        email: fpEmail.trim(), otp: fpOtp.trim(), newPassword: fpNewPw,
      });
      if (!j.success) throw new Error(j.message);
      toast("success", "Password reset successfully");
      setFpStep(0); setFpOtp(""); setFpNewPw(""); setFpConfirm("");
    } catch(e) { toast("error", e.message || "Failed to reset password"); }
    finally { setFpLoading(false); }
  };

  return (
    <div className="st-tab-body">
      <Section title="Account Info" sub="Your current login details">
        <div className="st-info-grid">
          <div className="st-info-row"><span>Name</span><strong>{user.name || "—"}</strong></div>
          <div className="st-info-row"><span>Email</span><strong>{user.email || "—"}</strong></div>
          <div className="st-info-row"><span>Role</span>
            <span className={`st-role-badge st-role-${user.role}`}>{user.role?.replace(/_/g," ")}</span>
          </div>
          <div className="st-info-row"><span>Status</span>
            <span className="st-badge-green">Active</span>
          </div>
        </div>
      </Section>

      <Section title="Change Password" sub="Use a strong password with at least 6 characters">
        <div className="st-form-grid">
          <Field label="Current Password">
            <div className="st-pw-wrap">
              <input className="st-input" type={show.cur?"text":"password"} placeholder="Current password" value={pw.cur} onChange={e=>setPw(p=>({...p,cur:e.target.value}))}/>
              <button className="st-eye" onClick={()=>setShow(s=>({...s,cur:!s.cur}))}>{show.cur?<EyeOff size={15}/>:<Eye size={15}/>}</button>
            </div>
          </Field>
          <Field label="New Password">
            <div className="st-pw-wrap">
              <input className="st-input" type={show.next?"text":"password"} placeholder="New password" value={pw.next} onChange={e=>setPw(p=>({...p,next:e.target.value}))}/>
              <button className="st-eye" onClick={()=>setShow(s=>({...s,next:!s.next}))}>{show.next?<EyeOff size={15}/>:<Eye size={15}/>}</button>
            </div>
          </Field>
          <Field label="Confirm New Password">
            <div className="st-pw-wrap">
              <input className="st-input" type={show.confirm?"text":"password"} placeholder="Confirm password" value={pw.confirm} onChange={e=>setPw(p=>({...p,confirm:e.target.value}))}/>
              <button className="st-eye" onClick={()=>setShow(s=>({...s,confirm:!s.confirm}))}>{show.confirm?<EyeOff size={15}/>:<Eye size={15}/>}</button>
            </div>
          </Field>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:12, flexWrap:"wrap"}}>
          <button className="st-btn-primary" onClick={save} disabled={saving}>
            {saving ? <RefreshCcw size={14} className="st-spin"/> : <Save size={14}/>}
            {saving ? "Saving…" : "Update Password"}
          </button>
          <button className="st-btn-ghost" type="button" onClick={() => { setFpStep(fpStep ? 0 : 1); setFpOtp(""); setFpNewPw(""); setFpConfirm(""); }}>
            {fpStep ? "Cancel Reset" : "Forgot Password?"}
          </button>
        </div>
      </Section>

      {fpStep > 0 && (
        <Section title="Reset Password via OTP" sub={fpStep === 1 ? "Enter your email to receive an OTP" : "Enter the OTP and your new password"}>
          {fpStep === 1 && (
            <>
              <div className="st-form-grid" style={{maxWidth:420}}>
                <Field label="Email Address">
                  <Input type="email" value={fpEmail} onChange={e=>setFpEmail(e.target.value)} placeholder="your@email.com"/>
                </Field>
              </div>
              <button className="st-btn-primary" onClick={sendOtp} disabled={fpLoading}>
                {fpLoading ? <RefreshCcw size={14} className="st-spin"/> : <Send size={14}/>}
                {fpLoading ? "Sending…" : "Send OTP"}
              </button>
            </>
          )}
          {fpStep === 2 && (
            <>
              <div className="st-form-grid">
                <Field label="OTP Code">
                  <Input placeholder="Enter the OTP from your email" value={fpOtp} onChange={e=>setFpOtp(e.target.value)} maxLength={6}/>
                </Field>
                <Field label="New Password">
                  <div className="st-pw-wrap">
                    <input className="st-input" type={fpShowPw?"text":"password"} placeholder="Min 6 characters" value={fpNewPw} onChange={e=>setFpNewPw(e.target.value)}/>
                    <button className="st-eye" onClick={()=>setFpShowPw(v=>!v)}>{fpShowPw?<EyeOff size={15}/>:<Eye size={15}/>}</button>
                  </div>
                </Field>
                <Field label="Confirm New Password">
                  <div className="st-pw-wrap">
                    <input className="st-input" type={fpShowPw?"text":"password"} placeholder="Confirm password" value={fpConfirm} onChange={e=>setFpConfirm(e.target.value)}/>
                  </div>
                </Field>
              </div>
              <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                <button className="st-btn-primary" onClick={resetWithOtp} disabled={fpLoading}>
                  {fpLoading ? <RefreshCcw size={14} className="st-spin"/> : <Save size={14}/>}
                  {fpLoading ? "Resetting…" : "Reset Password"}
                </button>
                <button className="st-btn-ghost" onClick={sendOtp} disabled={fpLoading}>Resend OTP</button>
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — User Management
// ══════════════════════════════════════════════════════════════════════════════
function UsersTab({ toast }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | {mode:"create"|"edit", data:{}}
  const [del,     setDel]     = useState(null); // user to delete

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await api("GET","/api/users");
      if (j.success) setUsers(j.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => setModal({ mode:"create", data:{ name:"", username:"", password:"", role:"viewer", modules:[], isActive:true } });
  const openEdit   = u  => setModal({ mode:"edit",   data:{ ...u, password:"" } });

  const save = async (data) => {
    if (!data.name?.trim())     return toast("error", "Name is required");
    if (!data.username?.trim()) return toast("error", "Username is required");
    if (modal.mode === "create" && !data.password?.trim()) return toast("error", "Password is required");
    if (data.password && data.password.length < 6) return toast("error", "Password must be at least 6 characters");
    if (!data.role?.trim())     return toast("error", "Role is required");

    const path  = modal.mode === "create" ? "/api/users" : `/api/users/${data._id}`;
    const method= modal.mode === "create" ? "POST" : "PUT";
    const payload = { ...data };
    if (!payload.password) delete payload.password;
    try {
      const j = await api(method, path, payload);
      if (!j.success) throw new Error(j.message);
      toast("success", modal.mode === "create" ? "User created" : "User updated");
      setModal(null); load();
    } catch(e) { toast("error", e.message || "Failed"); }
  };

  const confirmDel = async () => {
    try {
      const j = await api("DELETE", `/api/users/${del._id}`);
      if (!j.success) throw new Error(j.message);
      toast("success","User deleted");
      setDel(null); load();
    } catch(e) { toast("error", e.message || "Failed"); }
  };

  return (
    <div className="st-tab-body">
      <Section title="Managed Users" sub="Users created by master admin with restricted module access">
        <div className="st-table-toolbar">
          <span className="st-count">{users.length} users</span>
          <button className="st-btn-primary" onClick={openCreate}><Plus size={14}/> Add User</button>
        </div>

        {loading ? <div className="st-loading"><RefreshCcw size={18} className="st-spin"/> Loading…</div> :
         users.length === 0 ? <div className="st-empty">No managed users yet.</div> :
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr>
              <th>Name</th><th>Username</th><th>Role</th><th>Modules</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td className="st-mono">{u.username}</td>
                  <td>{u.role}</td>
                  <td><div className="st-pill-row">{(() => {
                    const mods = u.modules || [];
                    const editCount = mods.filter(m => m.endsWith(":edit") || !m.includes(":")).length;
                    const viewCount = mods.filter(m => m.endsWith(":view")).length;
                    if (editCount === 0 && viewCount === 0) return <span className="st-pill-none">No access</span>;
                    return <>{editCount > 0 && <span className="st-pill-edit">{editCount} edit</span>}{viewCount > 0 && <span className="st-pill-view">{viewCount} view</span>}</>;
                  })()}</div></td>
                  <td><span className={u.isActive?"st-badge-green":"st-badge-red"}>{u.isActive?"Active":"Inactive"}</span></td>
                  <td>
                    <div className="st-row-actions">
                      <button className="st-icon-btn" onClick={()=>openEdit(u)}><Edit3 size={14}/></button>
                      <button className="st-icon-btn red" onClick={()=>setDel(u)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </Section>

      {modal && <UserModal modal={modal} onClose={()=>setModal(null)} onSave={save}/>}
      {del && (
        <div className="st-overlay" onClick={()=>setDel(null)}>
          <div className="st-confirm-box" onClick={e=>e.stopPropagation()}>
            <div className="st-confirm-title">Delete User</div>
            <p>Delete <strong>{del.name}</strong>? This cannot be undone.</p>
            <div className="st-confirm-actions">
              <button className="st-btn-ghost" onClick={()=>setDel(null)}>Cancel</button>
              <button className="st-btn-danger" onClick={confirmDel}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserModal({ modal, onClose, onSave }) {
  const [d, setD] = useState(modal.data);
  const [showPw, setShowPw] = useState(false);
  const set = (k,v) => setD(p=>({...p,[k]:v}));
  const setModLevel = (key, level) => setD(p => ({ ...p, modules: setLevel(p.modules, key, level) }));
  const setAll = (level) => setD(p => ({
    ...p,
    modules: level === "none" ? [] : ALL_MODULES.map(m => `${m}:${level}`),
  }));

  return (
    <div className="st-overlay" onClick={onClose}>
      <div className="st-modal st-modal-wide" onClick={e=>e.stopPropagation()}>
        <div className="st-modal-header">
          <span>{modal.mode === "create" ? "Add User" : "Edit User"}</span>
          <button className="st-modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="st-modal-body">
          <div className="st-form-grid2">
            <Field label="Full Name"><Input placeholder="John Doe" value={d.name} onChange={e=>set("name",e.target.value)}/></Field>
            <Field label="Username (login ID)"><Input placeholder="john.doe" value={d.username} onChange={e=>set("username",e.target.value)}/></Field>
            <Field label={modal.mode==="create" ? "Password" : "New Password (leave blank to keep)"}>
              <div className="st-pw-wrap">
                <input className="st-input" type={showPw?"text":"password"} placeholder="••••••••" value={d.password} onChange={e=>set("password",e.target.value)}/>
                <button className="st-eye" onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button>
              </div>
            </Field>
            <Field label="Role"><Input placeholder="e.g. Sales Manager" value={d.role} onChange={e=>set("role",e.target.value)}/></Field>
          </div>
          <Field label="Status">
            <div className="st-toggle-row">
              <button className={`st-toggle ${d.isActive?"active":""}`} onClick={()=>set("isActive",true)}>Active</button>
              <button className={`st-toggle ${!d.isActive?"active":""}`} onClick={()=>set("isActive",false)}>Inactive</button>
            </div>
          </Field>
          <div className="st-perm-section">
            <div className="st-perm-section-head">
              <span className="st-perm-section-label">Module Permissions</span>
              <div className="st-perm-quick">
                <button className="st-perm-quick-btn green" onClick={()=>setAll("edit")}>All Edit</button>
                <button className="st-perm-quick-btn blue"  onClick={()=>setAll("view")}>All View</button>
                <button className="st-perm-quick-btn red"   onClick={()=>setAll("none")}>Clear All</button>
              </div>
            </div>
            <div className="st-perm-table">
              <div className="st-perm-header">
                <span className="st-perm-col-name">Module</span>
                <span className="st-perm-col-opt">No Access</span>
                <span className="st-perm-col-opt">View Only</span>
                <span className="st-perm-col-opt">Edit</span>
              </div>
              {ALL_MODULES.map(m => {
                const level = getLevel(d.modules, m);
                return (
                  <div key={m} className="st-perm-row">
                    <span className="st-perm-col-name">{MODULE_LABELS[m] || m}</span>
                    {["none","view","edit"].map(lv => (
                      <button key={lv}
                        className={`st-perm-col-opt st-perm-opt${level === lv ? ` active-${lv}` : ""}`}
                        onClick={() => setModLevel(m, lv)}>
                        {level === lv
                          ? <CheckCircle2 size={13}/>
                          : <span className="st-perm-circle"/>}
                        <span>{lv === "none" ? "None" : lv === "view" ? "View" : "Edit"}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="st-modal-footer">
          <button className="st-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="st-btn-primary" onClick={()=>onSave(d)}><Save size={14}/> Save</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Branch & Rent Config
// ══════════════════════════════════════════════════════════════════════════════
function BranchTab({ toast }) {
  const [rents,   setRents]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api("GET","/api/expenses/rent-config").then(j => {
      if (j.success) {
        const map = {};
        (j.data || []).forEach(r => { map[r.branch] = r; });
        // ensure all branches exist
        BRANCHES.forEach(b => { if (!map[b]) map[b] = { branch:b, amount:0, dueDay:1, notes:"" }; });
        setRents(map);
      }
    }).finally(() => setLoading(false));
  }, []);

  const set = (branch, field, val) => setRents(p => ({ ...p, [branch]: { ...p[branch], [field]: val } }));

  const save = async (branch) => {
    setSaving(branch);
    try {
      const j = await api("PUT", `/api/expenses/rent-config/${branch}`, rents[branch]);
      if (!j.success) throw new Error(j.message);
      toast("success", `${branch} rent config saved`);
    } catch(e) { toast("error", e.message || "Failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="st-loading"><RefreshCcw size={18} className="st-spin"/> Loading…</div>;

  return (
    <div className="st-tab-body">
      <Section title="Branch Rent Configuration" sub="Set monthly rent amount and due date for each office">
        <div className="st-branch-grid">
          {BRANCHES.map(branch => {
            const r = rents[branch] || {};
            return (
              <div key={branch} className="st-branch-card">
                <div className="st-branch-card-head">
                  <Building2 size={16}/> <strong>{branch}</strong>
                </div>
                <div className="st-form-col">
                  <Field label="Monthly Rent (₹)">
                    <Input type="number" min="0" value={r.amount||""} placeholder="0" onChange={e=>set(branch,"amount",Number(e.target.value))}/>
                  </Field>
                  <Field label="Due Day of Month">
                    <Select value={r.dueDay||1} onChange={e=>set(branch,"dueDay",Number(e.target.value))}>
                      {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
                    </Select>
                  </Field>
                  <Field label="Notes (optional)">
                    <Input value={r.notes||""} placeholder="e.g. Co-working space" onChange={e=>set(branch,"notes",e.target.value)}/>
                  </Field>
                  <button className="st-btn-primary" onClick={()=>save(branch)} disabled={saving===branch}>
                    {saving===branch?<RefreshCcw size={14} className="st-spin"/>:<Save size={14}/>}
                    {saving===branch?"Saving…":"Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Financial Config (mirrors BI config)
// ══════════════════════════════════════════════════════════════════════════════
function FinancialTab({ toast }) {
  const [cfg,    setCfg]    = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("GET","/api/bi/config").then(j => { if (j.success) setCfg(j.data); });
  }, []);

  const set = (k,v) => setCfg(p=>({...p,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const j = await api("POST","/api/bi/config", cfg);
      if (!j.success) throw new Error(j.message);
      toast("success","Financial config saved");
    } catch(e) { toast("error", e.message||"Failed"); }
    finally { setSaving(false); }
  };

  if (!cfg) return <div className="st-loading"><RefreshCcw size={18} className="st-spin"/> Loading…</div>;

  return (
    <div className="st-tab-body">
      <Section title="Cost Structure" sub="Defines how revenue is broken down for P&L calculations">
        <div className="st-form-grid">
          <Field label="COGS % (Cost of Goods Sold)">
            <div className="st-suffix-input">
              <Input type="number" min="0" max="100" value={cfg.cogsPercent||30} onChange={e=>set("cogsPercent",Number(e.target.value))}/>
              <span>%</span>
            </div>
            <div className="st-field-hint">Direct cost to deliver a project — design tools, freelancers, hosting setup, etc.</div>
          </Field>
          <Field label="Tax Rate (%)">
            <div className="st-suffix-input">
              <Input type="number" min="0" max="100" value={cfg.taxRatePercent||30} onChange={e=>set("taxRatePercent",Number(e.target.value))}/>
              <span>%</span>
            </div>
            <div className="st-field-hint">Effective corporate / LLP tax rate applied on EBITDA for provisioning.</div>
          </Field>
        </div>
      </Section>

      <Section title="Reserve Fund Targets" sub="Recommended allocation of net profit into safety buffers">
        <div className="st-form-grid">
          <Field label="Operating Buffer (months of OpEx)">
            <div className="st-suffix-input">
              <Input type="number" min="1" max="24" value={cfg.bufferMonths||5} onChange={e=>set("bufferMonths",Number(e.target.value))}/>
              <span>mo</span>
            </div>
            <div className="st-field-hint">Target = bufferMonths × average monthly operating expenses.</div>
          </Field>
          <Field label="Emergency Fund (% of annual revenue)">
            <div className="st-suffix-input">
              <Input type="number" min="0" max="100" value={cfg.emergencyPct||15} onChange={e=>set("emergencyPct",Number(e.target.value))}/>
              <span>%</span>
            </div>
            <div className="st-field-hint">One-time fund for business emergencies — legal, equipment failure, etc.</div>
          </Field>
          <Field label="Growth Fund (% of net profit)">
            <div className="st-suffix-input">
              <Input type="number" min="0" max="100" value={cfg.growthFundPct||15} onChange={e=>set("growthFundPct",Number(e.target.value))}/>
              <span>%</span>
            </div>
            <div className="st-field-hint">Reinvested into hiring, marketing, or new service lines.</div>
          </Field>
        </div>
      </Section>

      <button className="st-btn-primary" onClick={save} disabled={saving}>
        {saving?<RefreshCcw size={14} className="st-spin"/>:<Save size={14}/>}
        {saving?"Saving…":"Save Financial Config"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5 — Performance Targets
// ══════════════════════════════════════════════════════════════════════════════
function TargetsTab({ toast }) {
  const now   = new Date();
  const [month,  setMonth]  = useState(now.getMonth()+1);
  const [year,   setYear]   = useState(now.getFullYear());
  const [branch, setBranch] = useState("");
  const [targets, setTargets] = useState({});
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    const j = await api("GET", `/api/analytics/targets?year=${year}&branch=${branch}`);
    if (j.success) {
      const map = {};
      (j.data||[]).forEach(t => { map[t.month] = t; });
      setTargets(map);
    }
  }, [year, branch]);

  useEffect(() => { load(); }, [load]);

  const set = (m, field, val) => setTargets(p => ({ ...p, [m]: { ...(p[m]||{month:m}), [field]: val } }));

  const save = async (m) => {
    const t = targets[m] || { month:m };
    setSaving(m);
    try {
      const j = await api("POST","/api/analytics/targets",{
        month:m, year, branch,
        revenueTarget:    Number(t.revenueTarget||0),
        leadsTarget:      Number(t.leadsTarget||0),
        closedDealsTarget:Number(t.closedDealsTarget||0),
        advanceTarget:    Number(t.advanceTarget||0),
      });
      if (!j.success) throw new Error(j.message);
      toast("success",`${MONTH_NAMES[m-1]} ${year} target saved`);
      load();
    } catch(e) { toast("error",e.message||"Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="st-tab-body">
      <Section title="Monthly Performance Targets" sub="Set revenue, lead, deals and advance collection targets per month">
        <div className="st-target-filters">
          <Select value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
          </Select>
          <Select value={branch} onChange={e=>setBranch(e.target.value)}>
            <option value="">Company-wide</option>
            {BRANCHES.map(b=><option key={b}>{b}</option>)}
          </Select>
        </div>

        <div className="st-targets-grid">
          {MONTH_NAMES.map((mn,i) => {
            const m = i+1;
            const t = targets[m] || {};
            const isSaving = saving === m;
            return (
              <div key={m} className={`st-target-card ${m===month?"active":""}`}>
                <div className="st-target-card-head" onClick={()=>setMonth(m)}>
                  <span className="st-target-month">{mn}</span>
                  {t.revenueTarget > 0 && <span className="st-badge-green">Set</span>}
                </div>
                {m === month && (
                  <div className="st-target-body">
                    <Field label="Revenue Target (₹)">
                      <Input type="number" min="0" value={t.revenueTarget||""} placeholder="0" onChange={e=>set(m,"revenueTarget",e.target.value)}/>
                    </Field>
                    <Field label="Leads Target">
                      <Input type="number" min="0" value={t.leadsTarget||""} placeholder="0" onChange={e=>set(m,"leadsTarget",e.target.value)}/>
                    </Field>
                    <Field label="Closed Deals">
                      <Input type="number" min="0" value={t.closedDealsTarget||""} placeholder="0" onChange={e=>set(m,"closedDealsTarget",e.target.value)}/>
                    </Field>
                    <Field label="Advance Collection (₹)">
                      <Input type="number" min="0" value={t.advanceTarget||""} placeholder="0" onChange={e=>set(m,"advanceTarget",e.target.value)}/>
                    </Field>
                    <button className="st-btn-primary st-btn-sm" onClick={()=>save(m)} disabled={isSaving}>
                      {isSaving?<RefreshCcw size={12} className="st-spin"/>:<Save size={12}/>}
                      {isSaving?"Saving…":"Save"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6 — Report Settings
// ══════════════════════════════════════════════════════════════════════════════
function ReportTab({ toast }) {
  const [sending, setSending] = useState(false);
  const [email,   setEmail]   = useState("nn.creations7@gmail.com");

  const sendNow = async () => {
    setSending(true);
    try {
      const j = await api("POST","/api/bi/report/send",{ to: email });
      if (!j.success) throw new Error(j.message);
      toast("success","BI report sent to " + email);
    } catch(e) { toast("error", e.message||"Failed to send"); }
    finally { setSending(false); }
  };

  return (
    <div className="st-tab-body">
      <Section title="Automated BI Report" sub="Comprehensive 10–15 page PDF report sent automatically every fortnight">
        <div className="st-report-info-grid">
          <div className="st-report-info-item">
            <div className="st-report-info-label">Schedule</div>
            <div className="st-report-info-val">1st &amp; 16th of every month at 8:00 AM IST</div>
          </div>
          <div className="st-report-info-item">
            <div className="st-report-info-label">Recipient</div>
            <div className="st-report-info-val">nn.creations7@gmail.com</div>
          </div>
          <div className="st-report-info-item">
            <div className="st-report-info-label">Includes</div>
            <div className="st-report-info-val">P&amp;L Statement · Unit Economics · Reserve Funds · 12-Month Trend · Alerts · Recommendations</div>
          </div>
          <div className="st-report-info-item">
            <div className="st-report-info-label">Format</div>
            <div className="st-report-info-val">Rich HTML email + PDF attachment</div>
          </div>
        </div>
      </Section>

      <Section title="Send Report Now" sub="Manually trigger the BI report to any email address">
        <div className="st-form-grid" style={{maxWidth:420}}>
          <Field label="Recipient Email">
            <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com"/>
          </Field>
        </div>
        <button className="st-btn-primary" onClick={sendNow} disabled={sending}>
          {sending?<RefreshCcw size={14} className="st-spin"/>:<Send size={14}/>}
          {sending?"Sending Report…":"Send Report Now"}
        </button>
      </Section>

      <Section title="What's in the Report" sub="Every report covers 13 sections">
        <div className="st-report-sections-grid">
          {[
            ["Cover Page","Period, company name, generated timestamp"],
            ["Executive Summary","Revenue, gross profit, EBITDA, net profit at a glance"],
            ["P&L Statement","Full income statement with YTD comparison"],
            ["Expense Breakdown","OpEx by category with trend"],
            ["Unit Economics","Contribution margin, break-even analysis, profit per deal"],
            ["Reserve Funds","Buffer, Emergency, Tax Reserve, Growth Fund status"],
            ["Revenue by Source","Website, referral, walk-in, social media split"],
            ["Team Performance","Top reps by revenue and deals closed"],
            ["12-Month Trend","Revenue, gross profit, net profit trend chart"],
            ["Month-on-Month","MoM change for all KPIs"],
            ["YTD Summary","Year-to-date cumulative totals"],
            ["Alerts","Automated flags for missed targets or low funds"],
            ["Recommendations","AI-generated action items based on data"],
          ].map(([title, desc]) => (
            <div key={title} className="st-report-section-item">
              <CheckCircle2 size={14} color="#16a34a"/>
              <div><strong>{title}</strong><p>{desc}</p></div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 7 — Sales Reps
// ══════════════════════════════════════════════════════════════════════════════
function RepsTab({ toast }) {
  const [reps,    setReps]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [del,     setDel]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await api("GET", "/api/reps/all");
      if (j.success) setReps(j.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => setModal({ mode:"create", data:{ name:"", branches:[], email:"", phone:"", isActive:true } });
  const openEdit   = r  => setModal({ mode:"edit",   data:{ ...r, branches: r.branches?.length ? r.branches : (r.branch ? [r.branch] : []) } });

  const save = async (data) => {
    const isCreate = modal.mode === "create";
    const path   = isCreate ? "/api/reps" : `/api/reps/${data._id}`;
    const method = isCreate ? "POST" : "PUT";
    try {
      const j = await api(method, path, data);
      if (!j.success) throw new Error(j.message);
      toast("success", isCreate ? "Rep added" : "Rep updated");
      setModal(null); load();
    } catch(e) { toast("error", e.message || "Failed"); }
  };

  const confirmDel = async () => {
    try {
      const j = await api("DELETE", `/api/reps/${del._id}`);
      if (!j.success) throw new Error(j.message);
      toast("success","Rep removed");
      setDel(null); load();
    } catch(e) { toast("error", e.message || "Failed"); }
  };

  return (
    <div className="st-tab-body">
      <Section title="Sales Representatives" sub="Manage the reps who are assigned to leads across all branches">
        <div className="st-table-toolbar">
          <span className="st-count">{reps.length} reps</span>
          <button className="st-btn-primary" onClick={openCreate}><Plus size={14}/> Add Rep</button>
        </div>

        {loading ? <div className="st-loading"><RefreshCcw size={18} className="st-spin"/> Loading…</div> :
         reps.length === 0 ? <div className="st-empty">No reps found.</div> :
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr>
              <th>Name</th><th>Branch</th><th>Email</th><th>Phone</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {reps.map(r => {
                const repBranches = r.branches?.length ? r.branches : (r.branch ? [r.branch] : []);
                return (
                <tr key={r._id}>
                  <td><strong>{r.name}</strong></td>
                  <td>
                    {repBranches.length === 0 ? "—" :
                     repBranches.length === 3 ? <span className="st-badge-green">All Branches</span> :
                     <div className="st-pill-row">{repBranches.map(b=><span key={b} className="st-pill">{b}</span>)}</div>}
                  </td>
                  <td className="st-mono">{r.email || "—"}</td>
                  <td>{r.phone || "—"}</td>
                  <td><span className={r.isActive!==false?"st-badge-green":"st-badge-red"}>{r.isActive!==false?"Active":"Inactive"}</span></td>
                  <td>
                    <div className="st-row-actions">
                      <button className="st-icon-btn" onClick={()=>openEdit(r)}><Edit3 size={14}/></button>
                      <button className="st-icon-btn red" onClick={()=>setDel(r)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>}
      </Section>

      {modal && (
        <div className="st-overlay" onClick={()=>setModal(null)}>
          <div className="st-modal" onClick={e=>e.stopPropagation()}>
            <div className="st-modal-header">
              <span>{modal.mode==="create"?"Add Rep":"Edit Rep"}</span>
              <button className="st-modal-close" onClick={()=>setModal(null)}><X size={16}/></button>
            </div>
            <div className="st-modal-body">
              <div className="st-form-grid2">
                <Field label="Full Name"><Input placeholder="e.g. Ravi Kumar" value={modal.data.name} onChange={e=>setModal(m=>({...m,data:{...m.data,name:e.target.value}}))}/></Field>
                <Field label="Email (optional)"><Input type="email" placeholder="rep@nnc.in" value={modal.data.email||""} onChange={e=>setModal(m=>({...m,data:{...m.data,email:e.target.value}}))}/></Field>
                <Field label="Phone (optional)"><Input placeholder="+91 98765 43210" value={modal.data.phone||""} onChange={e=>setModal(m=>({...m,data:{...m.data,phone:e.target.value}}))}/></Field>
              </div>
              <Field label="Branches (select all that apply)">
                <div className="st-branch-check-row">
                  {BRANCHES.map(b => {
                    const checked = (modal.data.branches||[]).includes(b);
                    const toggle  = () => setModal(m => {
                      const cur = m.data.branches || [];
                      return { ...m, data: { ...m.data, branches: checked ? cur.filter(x=>x!==b) : [...cur, b] } };
                    });
                    return (
                      <label key={b} className={`st-branch-check ${checked?"checked":""}`} onClick={toggle}>
                        <span className="st-branch-check-box">{checked ? <CheckCircle2 size={14}/> : <span className="st-check-empty"/>}</span>
                        {b}
                      </label>
                    );
                  })}
                  <label
                    className={`st-branch-check all ${(modal.data.branches||[]).length===3?"checked":""}`}
                    onClick={()=>setModal(m=>({ ...m, data:{ ...m.data, branches: m.data.branches?.length===3 ? [] : [...BRANCHES] } }))}
                  >
                    <span className="st-branch-check-box">
                      {(modal.data.branches||[]).length===3 ? <CheckCircle2 size={14}/> : <span className="st-check-empty"/>}
                    </span>
                    All Branches
                  </label>
                </div>
              </Field>
              <Field label="Status">
                <div className="st-toggle-row">
                  <button className={`st-toggle ${modal.data.isActive!==false?"active":""}`} onClick={()=>setModal(m=>({...m,data:{...m.data,isActive:true}}))}>Active</button>
                  <button className={`st-toggle ${modal.data.isActive===false?"active":""}`} onClick={()=>setModal(m=>({...m,data:{...m.data,isActive:false}}))}>Inactive</button>
                </div>
              </Field>
            </div>
            <div className="st-modal-footer">
              <button className="st-btn-ghost" onClick={()=>setModal(null)}>Cancel</button>
              <button className="st-btn-primary" onClick={()=>save(modal.data)}><Save size={14}/> Save</button>
            </div>
          </div>
        </div>
      )}

      {del && (
        <div className="st-overlay" onClick={()=>setDel(null)}>
          <div className="st-confirm-box" onClick={e=>e.stopPropagation()}>
            <div className="st-confirm-title">Remove Rep</div>
            <p>Remove <strong>{del.name}</strong> from the system? Leads assigned to this rep will keep the rep name but won't be re-assignable to them.</p>
            <div className="st-confirm-actions">
              <button className="st-btn-ghost" onClick={()=>setDel(null)}>Cancel</button>
              <button className="st-btn-danger" onClick={confirmDel}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — Developers (who works on which project)
// ══════════════════════════════════════════════════════════════════════════════
const DEV_ROLES = ["Full Stack","Frontend","Backend","Mobile App","UI/UX Designer","WordPress / CMS","Tester / QA","Other"];
const isDone = p => p.projectCompleted || p.projectStage === "Project Completed";

function StagePill({ p }) {
  const c = PROJECT_STAGE_COLOR[p.projectStage || ""] || PROJECT_STAGE_COLOR[""];
  return <span className="st-dev-stage" style={{ background:c.bg, color:c.color }}>{projectStageLabel(p.projectStage)}</span>;
}

function DevelopersTab({ toast }) {
  const [devs,     setDevs]     = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);
  const [del,      setDel]      = useState(null);
  const [open,     setOpen]     = useState(null);   // expanded developer id
  const [pSearch,  setPSearch]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([api("GET", "/api/developers"), api("GET", "/api/leads?limit=200")]);
      if (d.success) setDevs(d.data || []);
      if (p.success) setProjects((p.data || []).sort((a, b) => String(a.name).localeCompare(String(b.name))));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const blank = { name:"", role:"Full Stack", email:"", phone:"", branch:"", skills:"", isActive:true, projectIds:[] };
  const openCreate = () => { setPSearch(""); setModal({ mode:"create", data:blank }); };
  const openEdit   = d  => { setPSearch(""); setModal({ mode:"edit", data:{ ...d, projectIds: d.projects.map(p => p._id) } }); };
  const setData    = patch => setModal(m => ({ ...m, data:{ ...m.data, ...patch } }));
  const toggleProject = id => setModal(m => {
    const cur = m.data.projectIds;
    return { ...m, data:{ ...m.data, projectIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] } };
  });

  const save = async (data) => {
    if (!data.name.trim()) return toast("error", "Name is required");
    const isCreate = modal.mode === "create";
    try {
      const j = await api(isCreate ? "POST" : "PUT", isCreate ? "/api/developers" : `/api/developers/${data._id}`, data);
      if (!j.success) throw new Error(j.message);
      toast("success", isCreate ? "Developer added" : "Developer updated");
      setModal(null); load();
    } catch(e) { toast("error", e.message || "Failed"); }
  };

  const confirmDel = async () => {
    try {
      const j = await api("DELETE", `/api/developers/${del._id}`);
      if (!j.success) throw new Error(j.message);
      toast("success", "Developer removed");
      setDel(null); load();
    } catch(e) { toast("error", e.message || "Failed"); }
  };

  const q = pSearch.trim().toLowerCase();
  const pickList = modal ? projects
    .filter(p => !q || `${p.name} ${p.business || ""}`.toLowerCase().includes(q))
    // assigned first
    .sort((a, b) => Number(modal.data.projectIds.includes(b._id)) - Number(modal.data.projectIds.includes(a._id))) : [];

  return (
    <div className="st-tab-body">
      <Section title="Developers" sub="Add developers and assign them to projects — see who is working on what">
        <div className="st-table-toolbar">
          <span className="st-count">{devs.length} developers · {devs.reduce((s, d) => s + d.activeProjects, 0)} active assignments</span>
          <button className="st-btn-primary" onClick={openCreate}><Plus size={14}/> Add Developer</button>
        </div>

        {loading ? <div className="st-loading"><RefreshCcw size={18} className="st-spin"/> Loading…</div> :
         devs.length === 0 ? <div className="st-empty">No developers yet. Click “Add Developer”.</div> :
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr>
              <th>Name</th><th>Role</th><th>Contact</th><th>Projects</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {devs.map(d => (
                <Fragment key={d._id}>
                  <tr className="st-dev-row" onClick={() => setOpen(o => o === d._id ? null : d._id)}>
                    <td>
                      <strong>{d.name}</strong>
                      {d.skills && <div className="st-dev-skills">{d.skills}</div>}
                    </td>
                    <td><span className="st-pill">{d.role}</span></td>
                    <td>
                      <div>{d.phone || "—"}</div>
                      {d.email && <div className="st-mono st-dev-skills">{d.email}</div>}
                    </td>
                    <td>
                      {d.projects.length === 0 ? <span className="st-pill-none">Not assigned</span> : (
                        <div className="st-pill-row">
                          <span className="st-badge-green">{d.activeProjects} active</span>
                          <span className="st-pill-more">{d.projects.length} total</span>
                          {d.projects.slice(0, 2).map(p => <span key={p._id} className="st-pill">{p.name}</span>)}
                          {d.projects.length > 2 && <span className="st-pill-more">+{d.projects.length - 2} more</span>}
                        </div>
                      )}
                    </td>
                    <td><span className={d.isActive ? "st-badge-green" : "st-badge-red"}>{d.isActive ? "Active" : "Inactive"}</span></td>
                    <td>
                      <div className="st-row-actions" onClick={e => e.stopPropagation()}>
                        <button className="st-icon-btn" title="Edit / assign projects" onClick={() => openEdit(d)}><Edit3 size={14}/></button>
                        <button className="st-icon-btn red" title="Remove" onClick={() => setDel(d)}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                  {open === d._id && (
                    <tr className="st-dev-expand"><td colSpan={6}>
                      {d.projects.length === 0 ? <span className="st-dev-skills">No projects assigned. Click edit to assign.</span> : (
                        <div className="st-dev-projects">
                          {[...d.projects].sort((a, b) => Number(isDone(a)) - Number(isDone(b))).map(p => (
                            <div key={p._id} className={`st-dev-project ${isDone(p) ? "done" : ""}`}>
                              <div>
                                <strong>{p.name}</strong>
                                {(p.business || p.company) && <span className="st-dev-skills"> · {p.business || p.company}</span>}
                              </div>
                              <StagePill p={p}/>
                            </div>
                          ))}
                        </div>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>}
      </Section>

      {modal && (
        <div className="st-overlay" onClick={() => setModal(null)}>
          <div className="st-modal" onClick={e => e.stopPropagation()}>
            <div className="st-modal-header">
              <span>{modal.mode === "create" ? "Add Developer" : "Edit Developer"}</span>
              <button className="st-modal-close" onClick={() => setModal(null)}><X size={16}/></button>
            </div>
            <div className="st-modal-body">
              <div className="st-form-grid2">
                <Field label="Full Name"><Input placeholder="e.g. Kiran Kumar" value={modal.data.name} onChange={e => setData({ name:e.target.value })}/></Field>
                <Field label="Role">
                  <Select value={modal.data.role} onChange={e => setData({ role:e.target.value })}>
                    {DEV_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
                <Field label="Phone (optional)"><Input placeholder="+91 98765 43210" value={modal.data.phone || ""} onChange={e => setData({ phone:e.target.value })}/></Field>
                <Field label="Email (optional)"><Input type="email" placeholder="dev@nnc.in" value={modal.data.email || ""} onChange={e => setData({ email:e.target.value })}/></Field>
                <Field label="Branch (optional)">
                  <Select value={modal.data.branch || ""} onChange={e => setData({ branch:e.target.value })}>
                    <option value="">—</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Skills (optional)"><Input placeholder="React, Node, Flutter…" value={modal.data.skills || ""} onChange={e => setData({ skills:e.target.value })}/></Field>
              </div>

              <Field label={`Assigned Projects (${modal.data.projectIds.length})`}>
                <Input placeholder="Search projects…" value={pSearch} onChange={e => setPSearch(e.target.value)}/>
                <div className="st-dev-pick">
                  {pickList.length === 0 && <div className="st-dev-skills" style={{ padding:10 }}>No projects found.</div>}
                  {pickList.map(p => {
                    const checked = modal.data.projectIds.includes(p._id);
                    return (
                      <label key={p._id} className={`st-dev-pick-item ${checked ? "checked" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleProject(p._id)}/>
                        <span className="st-dev-pick-name">
                          <strong>{p.name}</strong>
                          {(p.business || p.company) && <span className="st-dev-skills"> · {p.business || p.company}</span>}
                        </span>
                        <StagePill p={p}/>
                      </label>
                    );
                  })}
                </div>
              </Field>

              <Field label="Status">
                <div className="st-toggle-row">
                  <button className={`st-toggle ${modal.data.isActive ? "active" : ""}`} onClick={() => setData({ isActive:true })}>Active</button>
                  <button className={`st-toggle ${!modal.data.isActive ? "active" : ""}`} onClick={() => setData({ isActive:false })}>Inactive</button>
                </div>
              </Field>
            </div>
            <div className="st-modal-footer">
              <button className="st-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="st-btn-primary" onClick={() => save(modal.data)}><Save size={14}/> Save</button>
            </div>
          </div>
        </div>
      )}

      {del && (
        <div className="st-overlay" onClick={() => setDel(null)}>
          <div className="st-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="st-confirm-title">Remove Developer</div>
            <p>Remove <strong>{del.name}</strong>? They will be unassigned from {del.projects.length} project{del.projects.length === 1 ? "" : "s"}. To keep the history, set them Inactive instead.</p>
            <div className="st-confirm-actions">
              <button className="st-btn-ghost" onClick={() => setDel(null)}>Cancel</button>
              <button className="st-btn-danger" onClick={confirmDel}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 8 — Invoice Series
// ══════════════════════════════════════════════════════════════════════════════
// ── Company Info Tab ──────────────────────────────────────────────────────────
function CompanyInfoTab({ toast }) {
  const [form, setForm] = useState({
    gstin:   localStorage.getItem("nnc_gstin")   || "",
    pan:     localStorage.getItem("nnc_pan")     || "",
    cin:     localStorage.getItem("nnc_cin")     || "",
    website: localStorage.getItem("nnc_website") || "nakshatranamahacreations.com",
    email:   localStorage.getItem("nnc_email_id")|| "info@nakshatranamahacreations.com",
    phone:   localStorage.getItem("nnc_phone")   || "+91 99005 66466",
  });
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    Object.entries(form).forEach(([k, v]) => localStorage.setItem(`nnc_${k === "email" ? "email_id" : k === "website" ? "website" : k}`, v));
    localStorage.setItem("nnc_gstin",    form.gstin);
    localStorage.setItem("nnc_pan",      form.pan);
    localStorage.setItem("nnc_cin",      form.cin);
    localStorage.setItem("nnc_website",  form.website);
    localStorage.setItem("nnc_email_id", form.email);
    localStorage.setItem("nnc_phone",    form.phone);
    setTimeout(() => { setSaving(false); toast("success", "Company info saved."); }, 400);
  };

  const F = ({ label, k, placeholder }) => (
    <div className="st-field">
      <label className="st-label">{label}</label>
      <input className="st-input" value={form[k]} placeholder={placeholder} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}/>
    </div>
  );

  return (
    <Section title="Company Information" sub="These details appear on quotations, proposals and invoices">
      <div className="st-grid-2">
        <F label="GSTIN" k="gstin" placeholder="e.g. 29AABCN1234F1Z5"/>
        <F label="PAN" k="pan" placeholder="e.g. AABCN1234F"/>
        <F label="CIN" k="cin" placeholder="e.g. U72900KA2015PTC082801"/>
        <F label="Phone" k="phone" placeholder="+91 99005 66466"/>
        <F label="Email" k="email" placeholder="info@nakshatranamahacreations.com"/>
        <F label="Website" k="website" placeholder="nakshatranamahacreations.com"/>
      </div>
      <div style={{ marginTop:20 }}>
        <button className="st-btn-primary" onClick={save} disabled={saving}>
          <Save size={14}/> {saving ? "Saving…" : "Save Company Info"}
        </button>
      </div>
    </Section>
  );
}

function BankAccountsTab({ toast }) {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" });

  const authH = () => {
    const t = localStorage.getItem("nnc_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/payment-tracker/bank-accounts`, { headers: authH() });
      const json = await res.json();
      if (json.success) setAccounts(json.data || []);
      else toast("error", json.message || "Failed to load accounts");
    } catch { toast("error", "Failed to load accounts"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast("error", "Account label is required");
    setSaving(true);
    try {
      const url    = editId ? `${API}/api/payment-tracker/bank-accounts/${editId}` : `${API}/api/payment-tracker/bank-accounts`;
      const method = editId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { ...authH(), "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json   = await res.json();
      if (!res.ok || !json.success) return toast("error", json.message || "Save failed");
      toast("success", editId ? "Account updated" : "Account added");
      setForm({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" });
      setEditId(null);
      fetchAccounts();
    } catch { toast("error", "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this bank account?")) return;
    try {
      await fetch(`${API}/api/payment-tracker/bank-accounts/${id}`, { method: "DELETE", headers: authH() });
      toast("success", "Account removed");
      fetchAccounts();
    } catch { toast("error", "Failed to remove"); }
  };

  const startEdit = (a) => {
    setEditId(a._id);
    setForm({ name: a.name, bankName: a.bankName || "", accountNumber: a.accountNumber || "", ifsc: a.ifsc || "", branch: a.branch || "" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" });
  };

  return (
    <div className="st-tab-body">
      <Section title="Bank Accounts" sub="Manage company bank accounts used in payment tracking">
        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}><RefreshCcw size={22} style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : (
          <>
            {/* Existing accounts list */}
            {accounts.length > 0 && (
              <div className="st-table-wrap" style={{ marginBottom: 24 }}>
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Account Label</th>
                      <th>Bank Name</th>
                      <th>Account Number</th>
                      <th>IFSC</th>
                      <th>Branch</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a, i) => (
                      <tr key={a._id}>
                        <td style={{ color: "#94a3b8", fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontWeight: 700, color: "#0f172a" }}>{a.name}</td>
                        <td>{a.bankName || "—"}</td>
                        <td style={{ fontFamily: "monospace" }}>{a.accountNumber || "—"}</td>
                        <td style={{ fontFamily: "monospace" }}>{a.ifsc || "—"}</td>
                        <td>{a.branch || "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="st-action-btn edit" onClick={() => startEdit(a)}>
                              <Edit3 size={13} /> Edit
                            </button>
                            <button className="st-action-btn delete" onClick={() => remove(a._id)}>
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add / Edit form */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 14 }}>
                {editId ? "Edit Account" : "Add New Bank Account"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="st-field">
                  <label className="st-label">Account Label *</label>
                  <input className="st-input" placeholder="e.g. NNC Main Account" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Bank Name</label>
                  <input className="st-input" placeholder="e.g. HDFC Bank" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Account Number</label>
                  <input className="st-input" placeholder="Account number" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">IFSC Code</label>
                  <input className="st-input" placeholder="IFSC" value={form.ifsc} onChange={e => setForm(f => ({ ...f, ifsc: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Branch / Office</label>
                  <input className="st-input" placeholder="e.g. Mysore" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="st-save-btn" onClick={save} disabled={saving}>
                  <Save size={14} /> {saving ? "Saving…" : editId ? "Update Account" : "Add Account"}
                </button>
                {editId && (
                  <button className="st-cancel-btn" onClick={cancelEdit}>
                    <X size={14} /> Cancel
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function InvoiceTab({ toast }) {
  const [cfg,     setCfg]     = useState({ proformaPrefix:"NNC/PRF", taxPrefix:"NNC/TAX", paddingLength:4, includeFiscalYear:true });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api("GET", "/api/invoices/config").then(j => {
      if (j.success && j.data) setCfg(p => ({ ...p, ...j.data }));
    }).finally(() => setLoading(false));
  }, []);

  const preview = (prefix) => {
    const p = prefix || "PREFIX";
    const pad = String(1).padStart(cfg.paddingLength, "0");
    if (cfg.includeFiscalYear) {
      const yr = new Date().getFullYear();
      const fy = new Date().getMonth() >= 3
        ? `${String(yr).slice(-2)}${String(yr+1).slice(-2)}`
        : `${String(yr-1).slice(-2)}${String(yr).slice(-2)}`;
      return `${p}/${fy}/${pad}`;
    }
    return `${p}/${pad}`;
  };

  const save = async () => {
    if (!cfg.proformaPrefix?.trim()) return toast("error", "Proforma prefix is required");
    if (!cfg.taxPrefix?.trim())      return toast("error", "Tax invoice prefix is required");
    setSaving(true);
    try {
      const j = await api("PUT", "/api/invoices/config", cfg);
      if (!j.success) throw new Error(j.message);
      toast("success", "Invoice series configuration saved");
    } catch(e) { toast("error", e.message || "Failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="st-loading"><RefreshCcw size={18} className="st-spin"/> Loading…</div>;

  return (
    <div className="st-tab-body">
      <Section title="Proforma Invoice Series" sub="Prefix used when generating proforma / quotation invoice numbers">
        <div className="st-inv-series-row">
          <Field label="Series Prefix">
            <Input value={cfg.proformaPrefix} placeholder="e.g. NNC/PRF"
              onChange={e=>setCfg(p=>({...p,proformaPrefix:e.target.value}))}/>
          </Field>
          <div className="st-inv-preview">
            <div className="st-inv-preview-label">Sample Number</div>
            <div className="st-inv-preview-val">{preview(cfg.proformaPrefix)}</div>
          </div>
        </div>
      </Section>

      <Section title="Tax Invoice Series" sub="Prefix used when generating GST tax invoice numbers">
        <div className="st-inv-series-row">
          <Field label="Series Prefix">
            <Input value={cfg.taxPrefix} placeholder="e.g. NNC/TAX"
              onChange={e=>setCfg(p=>({...p,taxPrefix:e.target.value}))}/>
          </Field>
          <div className="st-inv-preview">
            <div className="st-inv-preview-label">Sample Number</div>
            <div className="st-inv-preview-val">{preview(cfg.taxPrefix)}</div>
          </div>
        </div>
      </Section>

      <Section title="Number Formatting" sub="Configure how sequential numbers are formatted">
        <div className="st-form-grid">
          <Field label="Sequence Digits (zero-padding)">
            <Select value={cfg.paddingLength} onChange={e=>setCfg(p=>({...p,paddingLength:Number(e.target.value)}))}>
              <option value={3}>3 digits — e.g. 001</option>
              <option value={4}>4 digits — e.g. 0001</option>
              <option value={5}>5 digits — e.g. 00001</option>
              <option value={6}>6 digits — e.g. 000001</option>
            </Select>
          </Field>
          <Field label="Include Fiscal Year">
            <div className="st-toggle-row">
              <button className={`st-toggle ${cfg.includeFiscalYear?"active":""}`}  onClick={()=>setCfg(p=>({...p,includeFiscalYear:true}))}>Yes — /2526/</button>
              <button className={`st-toggle ${!cfg.includeFiscalYear?"active":""}`} onClick={()=>setCfg(p=>({...p,includeFiscalYear:false}))}>No</button>
            </div>
          </Field>
        </div>
        <div className="st-inv-examples">
          <span className="st-inv-examples-label">Both series will look like:</span>
          <span className="st-inv-example-chip proforma">{preview(cfg.proformaPrefix)}</span>
          <span className="st-inv-example-chip tax">{preview(cfg.taxPrefix)}</span>
        </div>
      </Section>

      <div>
        <button className="st-btn-primary" onClick={save} disabled={saving}>
          {saving?<RefreshCcw size={14} className="st-spin"/>:<Save size={14}/>}
          {saving?"Saving…":"Save Configuration"}
        </button>
        <p className="st-inv-note">Changing the series prefix only affects new invoices. Existing invoice numbers are never renumbered.</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key:"profile",   label:"Profile",          icon:User         },
  { key:"users",     label:"User Management",  icon:Users        },
  { key:"reps",      label:"Sales Reps",       icon:UserCheck    },
  { key:"developers",label:"Developers",       icon:Code2        },
  { key:"branch",    label:"Branch & Rent",    icon:Building2    },
  { key:"financial", label:"Financial Config", icon:DollarSign   },
  { key:"targets",   label:"Targets",          icon:Target       },
  { key:"company",   label:"Company Info",     icon:Shield       },
  { key:"bank",      label:"Bank Accounts",    icon:Landmark     },
  { key:"invoices",  label:"Invoice Series",   icon:Receipt      },
  { key:"reports",   label:"Report Settings",  icon:FileBarChart2},
];

export default function Settings() {
  const [tab,    setTab]    = useState("profile");
  const [toasts, setToasts] = useState([]);

  const user = JSON.parse(localStorage.getItem("nnc_user") || "{}");
  const isMaster = user.role === "master_admin";

  const toast = useCallback((type, msg) => {
    const id = Date.now();
    setToasts(p => [...p, { id, type, msg }]);
  }, []);
  const removeToast = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);

  const visibleTabs = isMaster ? TABS : TABS.filter(t => t.key === "profile");

  return (
    <div className="st-layout">
      <Sidebar/>
      <div className="st-main">

        {/* ── Page Header ── */}
        <div className="st-page-header">
          <div>
            <h1 className="st-page-title">Settings</h1>
            <p className="st-page-sub">Manage your CRM configuration, users, branches, financial parameters and targets</p>
          </div>
          <div className="st-role-chip"><Shield size={13}/> {user.role?.replace(/_/g," ")}</div>
        </div>

        <div className="st-body">
          {/* ── Sidebar nav ── */}
          <div className="st-nav">
            {visibleTabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  className={`st-nav-item ${tab === t.key ? "active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  <Icon size={16}/> {t.label}
                </button>
              );
            })}
          </div>

          {/* ── Content ── */}
          <div className="st-content">
            {tab === "profile"   && <ProfileTab   toast={toast}/>}
            {tab === "users"     && <UsersTab      toast={toast}/>}
            {tab === "reps"      && <RepsTab       toast={toast}/>}
            {tab === "developers"&& <DevelopersTab toast={toast}/>}
            {tab === "branch"    && <BranchTab     toast={toast}/>}
            {tab === "financial" && <FinancialTab  toast={toast}/>}
            {tab === "targets"   && <TargetsTab    toast={toast}/>}
            {tab === "company"   && <CompanyInfoTab   toast={toast}/>}
            {tab === "bank"      && <BankAccountsTab toast={toast}/>}
            {tab === "invoices"  && <InvoiceTab    toast={toast}/>}
            {tab === "reports"   && <ReportTab     toast={toast}/>}
          </div>
        </div>
      </div>

      {/* ── Toasts ── */}
      <div className="st-toast-stack">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/>)}
      </div>
    </div>
  );
}
