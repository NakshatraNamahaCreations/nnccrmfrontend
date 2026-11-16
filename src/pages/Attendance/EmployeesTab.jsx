import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCcw, Search, Edit2, UserX, UserCheck, Clock, Briefcase, Phone, Mail, X, TrendingUp, ChevronDown, ChevronUp, CalendarDays, Cake, BadgeCheck } from "lucide-react";
import { toast } from "../../utils/toast";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const BRANCHES = ["Bangalore", "Mysore", "Mumbai"];

const EMPTY_FORM = {
  employeeId: "", name: "", email: "", phone: "", branch: "Bangalore",
  department: "", designation: "", shiftStart: "09:30", shiftEnd: "18:30",
  gracePeriodMin: 15, monthlySalary: "", joinedDate: "", dateOfBirth: "",
  employmentType: "permanent",
  // Salary structure
  basicAmt: 0, hraAmt: 0, daAmt: 0,
  pfApplicable: true, pfFixed: "",
  esiApplicable: false, esiFixed: "",
  ptApplicable: true, ptFixed: "",
};

function authHeader() {
  const t = localStorage.getItem("nnc_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function branchBadgeClass(branch) {
  const m = { Bangalore: "att-branch-bangalore", Mysore: "att-branch-mysore", Mumbai: "att-branch-mumbai" };
  return m[branch] || "att-branch-bangalore";
}

function getInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
}

// Late only after 2 hours from the shift start (9:30 → 11:30), the same rule as the server
function lateAt(emp) {
  const [h, m] = String(emp.shiftStart || "09:30").split(":").map(Number);
  const t = h * 60 + m + Math.max(120, Number(emp.gracePeriodMin) || 0);
  const hh = Math.floor(t / 60) % 24, mm = t % 60;
  return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
}

function fmtSalary(n) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString("en-IN")}`;
}

export default function EmployeesTab({ branch }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState(branch || "");
  const [filterStatus, setFilterStatus] = useState("active");
  const [hikeOpen, setHikeOpen] = useState(null); // empId with hike form open
  const [hikeHistoryOpen, setHikeHistoryOpen] = useState({}); // { [empId]: bool }
  const [hikeForm, setHikeForm] = useState({ salary: "", effectiveDate: "", hikePct: "", remarks: "" });
  const [hikeSaving, setHikeSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterBranch) p.set("branch", filterBranch);
      const res  = await fetch(`${API}/api/attendance/employees?${p}`, { headers: authHeader() });
      const json = await res.json();
      if (res.ok && json.success) setEmployees(json.data || []);
      else toast.error(json.message || "Failed to load employees");
    } catch { toast.error("Failed to load employees"); }
    finally { setLoading(false); }
  }, [filterBranch]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  /* Sync branch prop */
  useEffect(() => { setFilterBranch(branch || ""); }, [branch]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, branch: branch || "Bangalore" });
    setAddOpen(true);
  };
  const openEdit = (emp) => {
    setEditTarget(emp);
    setForm({
      employeeId: emp.employeeId || "",
      name: emp.name || "",
      email: emp.email || "",
      phone: emp.phone || "",
      branch: emp.branch || "Bangalore",
      department: emp.department || "",
      designation: emp.designation || "",
      shiftStart: emp.shiftStart || "09:30",
      shiftEnd: emp.shiftEnd || "18:30",
      gracePeriodMin: emp.gracePeriodMin ?? 15,
      monthlySalary: emp.monthlySalary ?? "",
      joinedDate:   emp.joinedDate   ? emp.joinedDate.split("T")[0]   : "",
      dateOfBirth:  emp.dateOfBirth  ? emp.dateOfBirth.split("T")[0]  : "",
      employmentType: emp.employmentType || "permanent",
      basicAmt: emp.basicAmt ?? 0,
      hraAmt:   emp.hraAmt   ?? 0,
      daAmt:    emp.daAmt    ?? 0,
      pfApplicable:  emp.pfApplicable  ?? true,
      pfFixed:       emp.pfFixed       || "",
      esiApplicable: emp.esiApplicable ?? false,
      esiFixed:      emp.esiFixed      || "",
      ptApplicable:  emp.ptApplicable  ?? true,
      ptFixed:       emp.ptFixed       || "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!form.employeeId.trim()) return toast.error("Employee ID is required");
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.branch) return toast.error("Branch is required");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("Invalid email format");
    if (form.monthlySalary && Number(form.monthlySalary) < 0) return toast.error("Salary cannot be negative");
    if (form.joinedDate && form.joinedDate > new Date().toISOString().split("T")[0]) return toast.error("Joined date cannot be in the future");
    setSaving(true);
    try {
      const isEdit = editOpen && editTarget;
      const method = isEdit ? "PUT" : "POST";
      const url    = isEdit
        ? `${API}/api/attendance/employees/${editTarget._id}`
        : `${API}/api/attendance/employees`;
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Save failed");
        return;
      }
      toast.success(isEdit ? "Employee updated!" : "Employee added!");
      setAddOpen(false);
      setEditOpen(false);
      setEditTarget(null);
      fetchEmployees();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Deactivate this employee?")) return;
    try {
      const res  = await fetch(`${API}/api/attendance/employees/${id}`, { method: "DELETE", headers: authHeader() });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to deactivate");
        return;
      }
      toast.success("Employee deactivated");
      fetchEmployees();
    } catch { toast.error("Failed to deactivate"); }
  };

  const handleActivate = async (emp) => {
    if (!window.confirm(`Make ${emp.name} active again?`)) return;
    try {
      const res  = await fetch(`${API}/api/attendance/employees/${emp._id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ isActive: true }) });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.message || "Failed to activate"); return; }
      toast.success("Employee is active again");
      fetchEmployees();
    } catch { toast.error("Failed to activate"); }
  };

  const addHike = async (empId) => {
    if (!hikeForm.salary || !hikeForm.effectiveDate) return toast.error("New salary and effective date are required");
    setHikeSaving(true);
    try {
      const res  = await fetch(`${API}/api/attendance/employees/${empId}/salary-hike`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ salary: Number(hikeForm.salary), effectiveDate: hikeForm.effectiveDate, hikePct: hikeForm.hikePct ? Number(hikeForm.hikePct) : null, remarks: hikeForm.remarks }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.message || "Failed to save hike"); return; }
      toast.success("Salary hike recorded!");
      setHikeOpen(null);
      setHikeForm({ salary: "", effectiveDate: "", hikePct: "", remarks: "" });
      fetchEmployees();
    } catch { toast.error("Failed to save hike"); }
    finally { setHikeSaving(false); }
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const nActive = employees.filter(e => e.isActive !== false).length, nInactive = employees.length - nActive;
  const filtered = employees.filter(e => {
    if (filterStatus === "active" && e.isActive === false) return false;
    if (filterStatus === "inactive" && e.isActive !== false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.name || "").toLowerCase().includes(q) || (e.employeeId || "").toLowerCase().includes(q) || (e.designation || "").toLowerCase().includes(q);
  });

  const modalOpen = addOpen || editOpen;
  const closeModal = () => { setAddOpen(false); setEditOpen(false); setEditTarget(null); };

  return (
    <>
      {/* Toolbar */}
      <div className="att-toolbar">
        <div className="att-search-wrap">
          <Search size={14} />
          <input placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="att-select"
          value={filterBranch}
          onChange={e => setFilterBranch(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13 }}
        >
          <option value="">All Branches</option>
          {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select
          className="att-select"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          aria-label="Status"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13 }}
        >
          <option value="active">Active ({nActive})</option>
          <option value="inactive">Inactive ({nInactive})</option>
          <option value="all">All employees ({employees.length})</option>
        </select>
        <div className="att-toolbar-right">
          <button className="att-btn-sec" onClick={fetchEmployees}>
            <RefreshCcw size={13} className={loading ? "att-spin" : ""} /> Refresh
          </button>
          <button className="att-btn-prim" onClick={openAdd}>
            <Plus size={14} /> Add Employee
          </button>
        </div>
      </div>

      {/* Employee Cards */}
      {loading ? (
        <div className="att-loading"><RefreshCcw size={28} className="att-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="att-empty">
          <div className="att-empty-text">No employees found</div>
          <div className="att-empty-sub">Add your first employee to get started</div>
        </div>
      ) : (
        <div className="att-emp-grid">
          {filtered.map(emp => (
            <div key={emp._id} className={`att-emp-card ${emp.isActive === false ? "off" : ""}`}>
              <div className="att-emp-card-header">
                <div className="att-emp-who">
                  <div className="att-emp-avatar">{getInitials(emp.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="att-emp-card-name" title={emp.name}>{emp.name}</div>
                    <div className="att-emp-tags">
                      <span className="att-emp-card-id">{emp.employeeId}</span>
                      <span className={emp.isActive !== false ? "att-status-active" : "att-status-inactive"}>{emp.isActive !== false ? "Active" : "Inactive"}</span>
                      <span className={`att-emp-type-badge ${emp.employmentType === "probationary" ? "probationary" : "permanent"}`}>{emp.employmentType === "probationary" ? "Probationary" : "Permanent"}</span>
                    </div>
                  </div>
                </div>
                <span className={`att-branch-badge ${branchBadgeClass(emp.branch)}`}>{emp.branch}</span>
              </div>

              <div className="att-emp-card-info">
                {emp.department && (
                  <div className="att-emp-info-row">
                    <Briefcase size={12} />
                    <span>{emp.department}{emp.designation ? ` · ${emp.designation}` : ""}</span>
                  </div>
                )}
                {emp.phone && (
                  <div className="att-emp-info-row">
                    <Phone size={12} />
                    <span>{emp.phone}</span>
                  </div>
                )}
                {emp.email && (
                  <div className="att-emp-info-row">
                    <Mail size={12} />
                    <span className="att-emp-mail" title={emp.email}>{emp.email}</span>
                  </div>
                )}
                <div className="att-emp-info-row">
                  <Clock size={12} />
                  <span>{emp.shiftStart || "09:30"} – {emp.shiftEnd || "18:30"} · late after {lateAt(emp)}</span>
                </div>
                {emp.monthlySalary ? (
                  <div>
                    <div className="att-emp-salary">{fmtSalary(emp.monthlySalary)} / month
                      {emp.salaryHistory?.length > 1 && (
                        <span style={{ fontSize: 11, color: "#059669", marginLeft: 6 }}>
                          ({emp.salaryHistory[emp.salaryHistory.length - 1].hikePct != null
                            ? `+${emp.salaryHistory[emp.salaryHistory.length - 1].hikePct}% hike`
                            : "revised"})
                        </span>
                      )}
                    </div>
                    {/* Starting salary */}
                    {emp.salaryHistory?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        Starting: {fmtSalary(emp.salaryHistory[0].salary)} · {emp.salaryHistory.length - 1} hike{emp.salaryHistory.length !== 2 ? "s" : ""}
                        {emp.salaryHistory.length > 1 && (
                          <button
                            style={{ marginLeft: 6, fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                            onClick={() => setHikeHistoryOpen(h => ({ ...h, [emp._id]: !h[emp._id] }))}
                          >
                            {hikeHistoryOpen[emp._id] ? "hide" : "view history"}
                          </button>
                        )}
                      </div>
                    )}
                    {/* History table */}
                    {hikeHistoryOpen[emp._id] && emp.salaryHistory?.length > 0 && (
                      <div style={{ marginTop: 6, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#f8fafc" }}>
                              <th style={{ padding: "5px 8px", textAlign: "left", color: "#64748b", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Date</th>
                              <th style={{ padding: "5px 8px", textAlign: "right", color: "#64748b", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Salary</th>
                              <th style={{ padding: "5px 8px", textAlign: "right", color: "#64748b", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Hike %</th>
                              <th style={{ padding: "5px 8px", textAlign: "left", color: "#64748b", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emp.salaryHistory.map((h, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                <td style={{ padding: "5px 8px", color: "#475569" }}>{new Date(h.effectiveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{fmtSalary(h.salary)}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right", color: h.hikePct != null ? "#059669" : "#94a3b8", fontWeight: 600 }}>
                                  {i === 0 ? "Starting" : h.hikePct != null ? `+${h.hikePct}%` : "—"}
                                </td>
                                <td style={{ padding: "5px 8px", color: "#64748b" }}>{h.remarks || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
                {emp.joinedDate && (() => {
                  const joined   = new Date(emp.joinedDate);
                  const daysWorking = Math.floor((Date.now() - joined.getTime()) / 86400000);
                  const yrs = Math.floor(daysWorking / 365);
                  const mos = Math.floor((daysWorking % 365) / 30);
                  const tenure = yrs > 0
                    ? `${yrs}y ${mos}m`
                    : mos > 0 ? `${mos} month${mos > 1 ? "s" : ""}`
                    : `${daysWorking} day${daysWorking !== 1 ? "s" : ""}`;
                  const probationDone = emp.employmentType === "probationary" && daysWorking >= 180;
                  return (
                    <div>
                      <div className="att-emp-info-row">
                        <CalendarDays size={12} />
                        <span>Joined {joined.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · <strong style={{ color: "#0f172a" }}>{tenure}</strong></span>
                      </div>
                      {probationDone && (
                        <div className="att-probation-alert">
                          <BadgeCheck size={13} /> Probation complete. Eligible for permanent
                        </div>
                      )}
                    </div>
                  );
                })()}
                {emp.dateOfBirth && (() => {
                  const dob     = new Date(emp.dateOfBirth);
                  const today   = new Date();
                  const isBday  = dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
                  const age     = today.getFullYear() - dob.getFullYear() - (
                    today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate()) ? 1 : 0
                  );
                  return (
                    <div>
                      {isBday
                        ? <div className="att-birthday-alert"><Cake size={13} /> Today is {emp.name?.split(" ")[0]}'s birthday ({age} years)</div>
                        : <div className="att-emp-info-row"><Cake size={12} /><span>Born {dob.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · Age {age}</span></div>
                      }
                    </div>
                  );
                })()}
              </div>

              {/* Hike form */}
              {hikeOpen === emp._id && (
                <div style={{ padding: "10px 14px", borderTop: "1px solid #e8edf5", background: "#f8fafc" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Record Salary Hike</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 3 }}>New Salary (₹) *</label>
                      <input className="att-input" type="number" min={0} placeholder="e.g. 35000" value={hikeForm.salary}
                        onChange={e => setHikeForm(f => ({ ...f, salary: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 3 }}>Effective Date *</label>
                      <input className="att-input" type="date" value={hikeForm.effectiveDate}
                        onChange={e => setHikeForm(f => ({ ...f, effectiveDate: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 3 }}>Hike % (auto if blank)</label>
                      <input className="att-input" type="number" min={0} placeholder="auto-calculated" value={hikeForm.hikePct}
                        onChange={e => setHikeForm(f => ({ ...f, hikePct: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 3 }}>Remarks</label>
                      <input className="att-input" placeholder="Optional note" value={hikeForm.remarks}
                        onChange={e => setHikeForm(f => ({ ...f, remarks: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button className="att-btn-prim" style={{ fontSize: 12, height: 30, padding: "0 14px" }} onClick={() => addHike(emp._id)} disabled={hikeSaving}>
                      {hikeSaving ? "Saving…" : "Save Hike"}
                    </button>
                    <button className="att-btn-sec" style={{ fontSize: 12, height: 30, padding: "0 14px" }} onClick={() => { setHikeOpen(null); setHikeForm({ salary: "", effectiveDate: "", hikePct: "", remarks: "" }); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="att-emp-card-footer">
                <div className={`att-emp-actions n${emp.isActive !== false ? 3 : 2}`}>
                  {emp.isActive !== false && (
                    <button className="att-btn-ghost" style={{ color: "#059669" }} onClick={() => { setHikeOpen(emp._id); setHikeForm({ salary: "", effectiveDate: new Date().toISOString().split("T")[0], hikePct: "", remarks: "" }); }}>
                      <TrendingUp size={13} /> Hike
                    </button>
                  )}
                  <button className="att-btn-ghost" onClick={() => openEdit(emp)}>
                    <Edit2 size={13} /> Edit
                  </button>
                  {emp.isActive !== false && (
                    <button className="att-btn-ghost danger" onClick={() => handleDeactivate(emp._id)}>
                      <UserX size={13} /> Deactivate
                    </button>
                  )}
                  {emp.isActive === false && (
                    <button className="att-btn-ghost" style={{ color: "#059669" }} onClick={() => handleActivate(emp)}>
                      <UserCheck size={13} /> Activate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="att-modal-overlay" onClick={closeModal}>
          <div className="att-modal" onClick={e => e.stopPropagation()}>
            <div className="att-modal-head">
              <span className="att-modal-title">{editOpen ? "Edit Employee" : "Add Employee"}</span>
              <button className="att-modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="att-modal-body">
              <div className="att-form-grid">
                <div className="att-field">
                  <label className="att-label">Employee ID *</label>
                  <input className="att-input" placeholder="EMP001" value={form.employeeId} onChange={e => setField("employeeId", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Full Name *</label>
                  <input className="att-input" placeholder="Full name" value={form.name} onChange={e => setField("name", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Email</label>
                  <input className="att-input" type="email" placeholder="Email address" value={form.email} onChange={e => setField("email", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Phone</label>
                  <input className="att-input" placeholder="Phone number" value={form.phone} onChange={e => setField("phone", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Branch</label>
                  <select className="att-select" value={form.branch} onChange={e => setField("branch", e.target.value)}>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="att-field">
                  <label className="att-label">Department</label>
                  <select className="att-input" value={form.department} onChange={e => setField("department", e.target.value)}>
                    <option value="">Select Department</option>
                    <option value="Owner">Owner</option>
                    <option value="Management">Management</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Operations">Operations</option>
                    <option value="Sales">Sales</option>
                    <option value="HR">HR</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="att-field">
                  <label className="att-label">Designation</label>
                  <input className="att-input" placeholder="Designation" value={form.designation} onChange={e => setField("designation", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Monthly Salary (₹)</label>
                  <input className="att-input" type="number" placeholder="0" value={form.monthlySalary} onChange={e => setField("monthlySalary", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Shift Start</label>
                  <input className="att-input" type="time" value={form.shiftStart} onChange={e => setField("shiftStart", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Shift End</label>
                  <input className="att-input" type="time" value={form.shiftEnd} onChange={e => setField("shiftEnd", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Grace Period (min)</label>
                  <input className="att-input" type="number" min={0} value={form.gracePeriodMin} onChange={e => setField("gracePeriodMin", Number(e.target.value))} />
                </div>
                <div className="att-field">
                  <label className="att-label">Joined Date</label>
                  <input className="att-input" type="date" value={form.joinedDate} onChange={e => setField("joinedDate", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Date of Birth</label>
                  <input className="att-input" type="date" value={form.dateOfBirth} onChange={e => setField("dateOfBirth", e.target.value)} />
                </div>
                <div className="att-field">
                  <label className="att-label">Employment Type</label>
                  <select className="att-input" value={form.employmentType} onChange={e => setField("employmentType", e.target.value)}>
                    <option value="permanent">Permanent (1.5 days paid leave/month)</option>
                    <option value="probationary">Probationary (all leave deducted)</option>
                  </select>
                </div>
              </div>

              {/* Salary Structure */}
              <div className="att-section-divider">Salary Structure</div>
              <div className="att-form-grid">
                <div className="att-field">
                  <label className="att-label">Basic (₹)</label>
                  <input className="att-input" type="number" min={0} placeholder="e.g. 18000" value={form.basicAmt || ""} onChange={e => setField("basicAmt", Number(e.target.value))} />
                </div>
                <div className="att-field">
                  <label className="att-label">HRA (₹)</label>
                  <input className="att-input" type="number" min={0} placeholder="e.g. 7200" value={form.hraAmt || ""} onChange={e => setField("hraAmt", Number(e.target.value))} />
                </div>
                <div className="att-field">
                  <label className="att-label">DA (₹)</label>
                  <input className="att-input" type="number" min={0} placeholder="e.g. 1800" value={form.daAmt || ""} onChange={e => setField("daAmt", Number(e.target.value))} />
                </div>
              </div>

              {/* Statutory deductions */}
              <div className="att-section-divider">Statutory Deductions</div>
              <div className="att-stat-grid">
                {/* PF */}
                <div className="att-stat-row">
                  <label className="att-stat-toggle">
                    <input type="checkbox" checked={!!form.pfApplicable} onChange={e => setField("pfApplicable", e.target.checked)} />
                    <span>PF Applicable</span>
                  </label>
                  {form.pfApplicable && (
                    <div className="att-stat-input-wrap">
                      <input className="att-input" type="number" min={0} placeholder="Enter PF amount (₹)" value={form.pfFixed || ""} onChange={e => setField("pfFixed", Number(e.target.value))} />
                    </div>
                  )}
                </div>

                {/* ESI */}
                <div className="att-stat-row">
                  <label className="att-stat-toggle">
                    <input type="checkbox" checked={!!form.esiApplicable} onChange={e => setField("esiApplicable", e.target.checked)} />
                    <span>ESI Applicable</span>
                  </label>
                  {form.esiApplicable && (
                    <div className="att-stat-input-wrap">
                      <input className="att-input" type="number" min={0} placeholder="Enter ESI amount (₹)" value={form.esiFixed || ""} onChange={e => setField("esiFixed", Number(e.target.value))} />
                    </div>
                  )}
                </div>

                {/* PT */}
                <div className="att-stat-row">
                  <label className="att-stat-toggle">
                    <input type="checkbox" checked={!!form.ptApplicable} onChange={e => setField("ptApplicable", e.target.checked)} />
                    <span>Professional Tax (PT) Applicable</span>
                  </label>
                  {form.ptApplicable && (
                    <div className="att-stat-input-wrap">
                      <input className="att-input" type="number" min={0} placeholder="Enter PT amount (₹)" value={form.ptFixed || ""} onChange={e => setField("ptFixed", Number(e.target.value))} />
                    </div>
                  )}
                </div>
              </div>

              {/* Live preview */}
              {form.monthlySalary > 0 && (
                <div className="att-sal-preview">
                  <div className="att-sal-preview-title">Salary Preview (on ₹{Number(form.monthlySalary).toLocaleString("en-IN")} gross)</div>
                  <div className="att-sal-preview-grid">
                    {(() => {
                      const gross = Number(form.monthlySalary) || 0;
                      const basic = Number(form.basicAmt) > 0 ? Number(form.basicAmt) : Math.round(gross * 0.40);
                      const hra   = Number(form.hraAmt)   > 0 ? Number(form.hraAmt)   : Math.round(basic * 0.40);
                      const da    = Number(form.daAmt)    > 0 ? Number(form.daAmt)    : Math.round(basic * 0.10);
                      const special = Math.max(0, gross - basic - hra - da);
                      const pf  = form.pfApplicable  ? (Number(form.pfFixed)  || 0) : 0;
                      const esi = form.esiApplicable ? (Number(form.esiFixed) || 0) : 0;
                      const pt  = form.ptApplicable  ? (Number(form.ptFixed)  || 0) : 0;
                      const net = gross - pf - esi - pt;
                      return (
                        <>
                          <div className="att-sal-item earn"><span>Basic</span><span>₹{basic.toLocaleString("en-IN")}</span></div>
                          <div className="att-sal-item earn"><span>HRA</span><span>₹{hra.toLocaleString("en-IN")}</span></div>
                          <div className="att-sal-item earn"><span>DA</span><span>₹{da.toLocaleString("en-IN")}</span></div>
                          <div className="att-sal-item earn"><span>Special Allowance</span><span>₹{special.toLocaleString("en-IN")}</span></div>
                          {pf  > 0 && <div className="att-sal-item ded"><span>PF (Employee)</span><span>- ₹{pf.toLocaleString("en-IN")}</span></div>}
                          {esi > 0 && <div className="att-sal-item ded"><span>ESI</span><span>- ₹{esi.toLocaleString("en-IN")}</span></div>}
                          {pt  > 0 && <div className="att-sal-item ded"><span>Prof. Tax</span><span>- ₹{pt.toLocaleString("en-IN")}</span></div>}
                          <div className="att-sal-item net"><span>Net Salary</span><span>₹{net.toLocaleString("en-IN")}</span></div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="att-modal-foot">
              <button className="att-btn-sec" onClick={closeModal}>Cancel</button>
              <button className="att-btn-prim" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editOpen ? "Update Employee" : "Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
