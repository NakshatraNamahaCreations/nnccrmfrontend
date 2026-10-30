import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, ShieldCheck,
  User, CheckCircle2, XCircle, Search, Lock, Briefcase,
  LayoutDashboard, KanbanSquare, CalendarDays, FileText,
  BarChart3, Trophy, Building2, CreditCard, Settings,
  ClipboardList, Users, MessageSquare, Wallet, TrendingUp,
  BookOpen, UserCheck, PiggyBank, Plug,
} from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import "./UserManagement.css";

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";

const ALL_MODULES = [
  { key: "dashboard",       label: "Dashboard",          section: "Overview" },
  { key: "todays-plan",     label: "Today's Plan",       section: "Overview" },
  { key: "pipeline",        label: "Pipeline",           section: "Sales" },
  { key: "all-leads",       label: "All Leads",          section: "Sales" },
  { key: "enquiries",       label: "Enquiries",          section: "Sales" },
  { key: "calendar",        label: "Calendar",           section: "Sales" },
  { key: "integrations",    label: "Integrations",       section: "Sales" },
  { key: "documents",       label: "Documents",          section: "Documents" },
  { key: "analytics",       label: "Analytics",          section: "Analytics" },
  { key: "leaderboard",     label: "Leaderboard",        section: "Analytics" },
  { key: "branch-reports",  label: "Branch Reports",     section: "Analytics" },
  { key: "payment-tracker", label: "Payment Tracker",    section: "Analytics" },
  { key: "expense-tracker", label: "Expense Tracker",    section: "Analytics" },
  { key: "pnl",             label: "P&L Report",         section: "Analytics" },
  { key: "funds",           label: "Reserve Funds",      section: "Analytics" },
  { key: "accounting",      label: "Accounting",         section: "Analytics" },
  { key: "attendance",      label: "Attendance & Salary",section: "HR" },
  { key: "settings",        label: "Settings",           section: "Settings" },
];

const MODULE_ICONS = {
  "dashboard":       LayoutDashboard,
  "todays-plan":     ClipboardList,
  "pipeline":        KanbanSquare,
  "all-leads":       Users,
  "enquiries":       MessageSquare,
  "calendar":        CalendarDays,
  "integrations":    Plug,
  "documents":       FileText,
  "analytics":       BarChart3,
  "leaderboard":     Trophy,
  "branch-reports":  Building2,
  "payment-tracker": CreditCard,
  "expense-tracker": Wallet,
  "pnl":             TrendingUp,
  "funds":           PiggyBank,
  "accounting":      BookOpen,
  "attendance":      UserCheck,
  "settings":        Settings,
};

const SECTIONS = [...new Set(ALL_MODULES.map(m => m.section))];

const PRESET_ROLES = ["Accountant", "BDM", "Operations Manager", "HR", "Sales Rep", "Branch Manager"];

const ROLE_COLORS = {
  Accountant: { bg: "#eff6ff", color: "#2563eb" },
  "Operations Manager": { bg: "#f0fdf4", color: "#16a34a" },
  BDM: { bg: "#fdf4ff", color: "#9333ea" },
  "Sales Rep": { bg: "#fff7ed", color: "#ea580c" },
  HR: { bg: "#fef2f2", color: "#dc2626" },
  User: { bg: "#f8fafc", color: "#64748b" },
};

function getRoleStyle(role) {
  return ROLE_COLORS[role] || { bg: "#f1f5f9", color: "#475569" };
}

const EMPTY_FORM = {
  name: "", username: "", password: "", role: "", modules: [], isActive: true,
};

function authHeader() {
  const token = localStorage.getItem("nnc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getInitials(name) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function UserManagement() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState("");
  const [formOpen, setFormOpen]     = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId]   = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/api/users`, { headers: authHeader() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch users");
      setUsers(json.data || []);
    } catch (e) {
      toast.error(e.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowPass(false);
    setFormOpen(true);
  };

  const openEdit = (user) => {
    setEditId(user._id);
    setForm({
      name:     user.name || "",
      username: user.username || "",
      password: "",
      role:     user.role || "",
      modules:  Array.isArray(user.modules) ? [...user.modules] : [],
      isActive: user.isActive !== false,
    });
    setShowPass(false);
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditId(null); setForm(EMPTY_FORM); };

  const toggleModule = (key) => {
    setForm(prev => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter(m => m !== key)
        : [...prev.modules, key],
    }));
  };

  const toggleSection = (section) => {
    const keys = ALL_MODULES.filter(m => m.section === section).map(m => m.key);
    const allSelected = keys.every(k => form.modules.includes(k));
    setForm(prev => ({
      ...prev,
      modules: allSelected
        ? prev.modules.filter(k => !keys.includes(k))
        : [...new Set([...prev.modules, ...keys])],
    }));
  };

  const selectAll = () => setForm(prev => ({ ...prev, modules: ALL_MODULES.map(m => m.key) }));
  const clearAll  = () => setForm(prev => ({ ...prev, modules: [] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())     { toast.warning("Name is required"); return; }
    if (!form.username.trim()) { toast.warning("Username is required"); return; }
    if (!editId && !form.password.trim()) { toast.warning("Password is required"); return; }
    if (form.password && form.password.length < 6) { toast.warning("Password must be at least 6 characters"); return; }
    if (!form.role.trim())     { toast.warning("Role is required"); return; }
    if (form.modules.length === 0) { toast.warning("Select at least one module"); return; }

    try {
      setSaving(true);
      const body = {
        name:     form.name.trim(),
        username: form.username.trim(),
        role:     form.role.trim(),
        modules:  form.modules,
        isActive: form.isActive,
      };
      if (form.password.trim()) body.password = form.password.trim();

      const url    = editId ? `${API_BASE}/api/users/${editId}` : `${API_BASE}/api/users`;
      const method = editId ? "PUT" : "POST";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save user");

      toast.success(editId ? "User updated successfully" : "User created successfully");
      closeForm();
      await fetchUsers();
    } catch (e) {
      toast.error(e.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      const res  = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete");
      toast.success("User deleted");
      setConfirmId(null);
      await fetchUsers();
    } catch (e) {
      toast.error(e.message || "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = users.filter(u =>
    !search.trim() ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:  users.length,
    active: users.filter(u => u.isActive).length,
    roles:  [...new Set(users.map(u => u.role).filter(Boolean))].length,
  };

  return (
    <div className="umLayout">
      <Sidebar active="User Management" />

      <div className="umMain">
        {/* ── Topbar ── */}
        <div className="umTopbar">
          <div className="umTopLeft">
            <h1 className="umTitle">User Management</h1>
            <span className="umSuperPill"><ShieldCheck size={12}/> Super Admin</span>
          </div>
          <div className="umTopRight">
            <div className="umSearchWrap">
              <Search size={14} className="umSearchIcon"/>
              <input
                className="umSearch"
                placeholder="Search name, username, role..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="umPrimaryBtn" onClick={openCreate}>
              <Plus size={15}/> Add User
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="umStatsRow">
          <div className="umStatCard blue">
            <div className="umStatVal">{stats.total}</div>
            <div className="umStatLabel">Total Users</div>
          </div>
          <div className="umStatCard green">
            <div className="umStatVal">{stats.active}</div>
            <div className="umStatLabel">Active</div>
          </div>
          <div className="umStatCard red">
            <div className="umStatVal">{stats.total - stats.active}</div>
            <div className="umStatLabel">Inactive</div>
          </div>
          <div className="umStatCard violet">
            <div className="umStatVal">{stats.roles}</div>
            <div className="umStatLabel">Unique Roles</div>
          </div>
        </div>

        {/* ── Content Area ── */}
        <div className={`umContentArea ${formOpen ? "panelOpen" : ""}`}>

          {/* Table side */}
          <div className="umTableSide">
            <div className="umTableCard">
              {loading ? (
                <div className="umEmpty">Loading users...</div>
              ) : filtered.length === 0 ? (
                <div className="umEmpty">{search ? "No users match your search." : "No users yet — click Add User to create one."}</div>
              ) : (
                <div className="umTableScroll">
                  <table className="umTable">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Module Access</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(user => {
                        const roleStyle = getRoleStyle(user.role);
                        const mods = user.modules || [];
                        return (
                          <tr key={user._id} className={`umRow ${editId === user._id ? "umRowActive" : ""}`}>
                            <td>
                              <div className="umUserCell">
                                <div className="umAvatar">
                                  {getInitials(user.name)}
                                </div>
                                <span className="umUserName">{user.name}</span>
                              </div>
                            </td>
                            <td className="umUsername">@{user.username}</td>
                            <td>
                              <span className="umRolePill" style={{ background: roleStyle.bg, color: roleStyle.color }}>
                                {user.role || "User"}
                              </span>
                            </td>
                            <td>
                              <div className="umModuleWrap">
                                {mods.length === 0 ? (
                                  <span className="umNoMod">No access</span>
                                ) : mods.length === ALL_MODULES.length ? (
                                  <span className="umModPill all">All Modules</span>
                                ) : (
                                  <>
                                    {mods.slice(0, 3).map(k => {
                                      const m = ALL_MODULES.find(x => x.key === k);
                                      return <span key={k} className="umModPill">{m?.label || k}</span>;
                                    })}
                                    {mods.length > 3 && <span className="umModMore">+{mods.length - 3}</span>}
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              {user.isActive
                                ? <span className="umStatusPill active"><CheckCircle2 size={11}/> Active</span>
                                : <span className="umStatusPill inactive"><XCircle size={11}/> Inactive</span>}
                            </td>
                            <td className="umDate">
                              {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN") : "—"}
                            </td>
                            <td>
                              <div className="umActions">
                                <button className="umActBtn edit" title="Edit" onClick={() => openEdit(user)}>
                                  <Pencil size={13}/>
                                </button>
                                <button
                                  className="umActBtn del"
                                  title="Delete"
                                  onClick={() => setConfirmId(user._id)}
                                  disabled={deletingId === user._id}
                                >
                                  <Trash2 size={13}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Redesigned Inline Form Panel ── */}
          {formOpen && (
            <div className="umFp">

              {/* Header */}
              <div className="umFpHeader">
                <div className="umFpHeaderLeft">
                  <div className="umFpAvatar">
                    {form.name ? getInitials(form.name) : (editId ? "?" : "+")}
                  </div>
                  <div>
                    <div className="umFpHeaderTitle">
                      {editId ? "Edit User" : "New User"}
                    </div>
                    <div className="umFpHeaderSub">
                      {editId ? `Editing @${form.username || "..."}` : "Fill in details to create account"}
                    </div>
                  </div>
                </div>
                <button type="button" className="umFpClose" onClick={closeForm}>
                  <X size={15}/>
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="umFpBody">

                  {/* ── Section: Basic Info ── */}
                  <div className="umFpSection">
                    <div className="umFpSectionLabel">Basic Information</div>

                    <div className="umFpField">
                      <label>Full Name <span className="umFpReq">*</span></label>
                      <div className="umFpInputWrap">
                        <span className="umFpInputIcon"><User size={13}/></span>
                        <input
                          placeholder="e.g. Ravi Kumar"
                          value={form.name}
                          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="umFpField">
                      <label>Username <span className="umFpReq">*</span> <span className="umFpHint">used to login</span></label>
                      <div className="umFpInputWrap">
                        <span className="umFpInputIcon umFpAtSign">@</span>
                        <input
                          placeholder="ravi.kumar"
                          value={form.username}
                          onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                        />
                      </div>
                    </div>

                    <div className="umFpField">
                      <label>
                        {editId ? "New Password" : "Password"} <span className="umFpReq">{!editId && "*"}</span>
                        <span className="umFpHint">{editId ? "leave blank to keep current" : "min 6 characters"}</span>
                      </label>
                      <div className="umFpInputWrap">
                        <span className="umFpInputIcon"><Lock size={13}/></span>
                        <input
                          type={showPass ? "text" : "password"}
                          placeholder={editId ? "Leave blank to keep current" : "Enter password"}
                          value={form.password}
                          onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        />
                        <button type="button" className="umFpPassToggle" onClick={() => setShowPass(v => !v)}>
                          {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Role ── */}
                  <div className="umFpSection">
                    <div className="umFpSectionLabel">Role <span className="umFpReq">*</span></div>
                    <div className="umFpChips">
                      {PRESET_ROLES.map(r => (
                        <button
                          key={r}
                          type="button"
                          className={`umFpChip ${form.role === r ? "active" : ""}`}
                          onClick={() => setForm(p => ({ ...p, role: r }))}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="umFpField" style={{ marginTop: "10px" }}>
                      <div className="umFpInputWrap">
                        <span className="umFpInputIcon"><Briefcase size={13}/></span>
                        <input
                          placeholder="Or type a custom role…"
                          value={form.role}
                          onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Status ── */}
                  <div className="umFpSection">
                    <div className="umFpSectionLabel">Account Status</div>
                    <button
                      type="button"
                      className={`umFpStatusBar ${form.isActive ? "active" : "inactive"}`}
                      onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                    >
                      <span className={`umFpStatusDot ${form.isActive ? "active" : "inactive"}`}/>
                      <span className="umFpStatusText">
                        {form.isActive ? "Active — user can login" : "Inactive — login disabled"}
                      </span>
                      <div className={`umFpToggle ${form.isActive ? "on" : ""}`}>
                        <span className="umFpToggleThumb"/>
                      </div>
                    </button>
                  </div>

                  {/* ── Section: Module Access ── */}
                  <div className="umFpSection">
                    <div className="umFpSectionLabelRow">
                      <span className="umFpSectionLabel" style={{ marginBottom: 0 }}>
                        Module Access <span className="umFpReq">*</span>
                      </span>
                      <div className="umFpModActions">
                        <button type="button" className="umFpTextBtn" onClick={selectAll}>Select All</button>
                        <span>·</span>
                        <button type="button" className="umFpTextBtn" onClick={clearAll}>Clear</button>
                        <span className="umFpModBadge">{form.modules.length}/{ALL_MODULES.length}</span>
                      </div>
                    </div>

                    {SECTIONS.map(section => {
                      const sectionMods = ALL_MODULES.filter(m => m.section === section);
                      const allChecked  = sectionMods.every(m => form.modules.includes(m.key));
                      return (
                        <div key={section} className="umFpModSect">
                          <div className="umFpModSectHead">
                            <span className="umFpModSectName">{section}</span>
                            <button type="button" className="umFpTextBtn" onClick={() => toggleSection(section)}>
                              {allChecked ? "Deselect all" : "Select all"}
                            </button>
                          </div>
                          <div className="umFpModGrid">
                            {sectionMods.map(m => {
                              const Icon    = MODULE_ICONS[m.key] || FileText;
                              const checked = form.modules.includes(m.key);
                              return (
                                <button
                                  key={m.key}
                                  type="button"
                                  className={`umFpModCard ${checked ? "checked" : ""}`}
                                  onClick={() => toggleModule(m.key)}
                                >
                                  <span className="umFpModCardIcon"><Icon size={13}/></span>
                                  <span className="umFpModCardLabel">{m.label}</span>
                                  {checked && <CheckCircle2 size={12} className="umFpModCardCheck"/>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>{/* end umFpBody */}

                {/* Footer */}
                <div className="umFpFoot">
                  <button type="button" className="umFpCancelBtn" onClick={closeForm}>Cancel</button>
                  <button type="submit" className="umFpSaveBtn" disabled={saving}>
                    {saving ? "Saving…" : editId ? "Update User" : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>{/* end umContentArea */}
      </div>

      {/* ── Delete Confirm overlay ── */}
      {confirmId && (
        <div className="umOverlay" onClick={() => setConfirmId(null)}>
          <div className="umConfirmCard" onClick={e => e.stopPropagation()}>
            <div className="umConfirmIcon"><Trash2 size={24}/></div>
            <div className="umConfirmTitle">Delete User?</div>
            <div className="umConfirmText">This action cannot be undone. The user will lose all access immediately.</div>
            <div className="umConfirmBtns">
              <button className="umGhostBtn" onClick={() => setConfirmId(null)}>Cancel</button>
              <button
                className="umDangerBtn"
                disabled={deletingId === confirmId}
                onClick={() => handleDelete(confirmId)}
              >
                {deletingId === confirmId ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
