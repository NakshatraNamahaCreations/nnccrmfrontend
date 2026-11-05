import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "../utils/toast";
import Sidebar from "../components/Sidebar/Sidebar";
import LeadDrawer from "../Leads/LeadDrawer";
import { Trash2, Download, Eye, Pencil, X, Search, CalendarPlus, Plus } from "lucide-react";
import { ShimmerLeadList, BtnSpinner } from "../components/ui/Shimmer";
import GstPicker from "./GstPicker";
import { PROJECT_STAGES, PROJECT_STAGE_COLOR, projectStageLabel, projectStagePatch } from "./projectStages";
import { calcRemaining } from "./gst";
import "./AllLeads.css";

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";

const authHeaders = (extra = {}) => {
  const token = localStorage.getItem("nnc_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

const money = (n) => {
  try {
    if (n == null || n === 0) return "—";
    return `₹${Number(n).toLocaleString("en-IN")}`;
  } catch { return "—"; }
};

const cls = (s = "") => String(s).toLowerCase().replace(/\s+/g, "-");

const getAgo = (dateValue) => {
  try {
    if (!dateValue) return "—";
    const days = Math.floor((Date.now() - new Date(dateValue).getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "1d ago";
    return `${days}d ago`;
  } catch { return "—"; }
};

const initials = (name = "") => {
  try {
    return String(name).trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "?";
  } catch { return "?"; }
};

const PRIO_COLOR = { Hot: "#ef4444", Warm: "#f59e0b", Cold: "#64748b" };

const EMPTY_EDIT_FORM = {
  _id: "", name: "", phone: "", email: "", business: "",
  industry: "", location: "", requirements: "",
  branch: "Bangalore", source: "WhatsApp",
  stage: "Lead Capture", projectStage: "", priority: "Hot", value: "", days: "0d", rep: "",
  advanceReceived: "", advanceReceivedDate: "", agreedTimeline: "",
  onboardedDate: "", projectCompleted: false, projectCompletionDate: "",
  gstApplicable: false, gstRate: 18,
};

/* Format a Date/ISO string → "YYYY-MM-DD" for <input type="date"> */
const toDateInput = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch { return ""; }
};

/* Add N days to a date and return a readable string */
const addDays = (dateVal, days) => {
  if (!dateVal || !days) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + Number(days));
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
};

const BRANCHES     = ["All", "Mysore", "Bangalore", "Mumbai"];
const PRIORITIES   = ["All", "Hot", "Warm", "Cold"];
const SOURCES      = ["All", "Referral", "WhatsApp", "Website", "Call", "Instagram", "Social", "Form", "Phone"];
const EDIT_BRANCHES  = ["Mysore", "Bangalore", "Mumbai"];
const EDIT_PRIORITIES = ["Hot", "Warm", "Cold"];
const EDIT_SOURCES   = ["WhatsApp", "Website", "Call", "Instagram", "Referral"];

export default function AllLeads() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    branch: "All", priority: "All", source: "All", bant: "All", rep: "All", q: "",
    // Sales stage is still honoured from links like /leads?stage=Proposal
    stage: searchParams.get("stage") || "All",
    projectStage: "All",
  }));
  const [rows, setRows]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");
  const [selectedId, setSelectedId]   = useState(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [exporting, setExporting]     = useState(false);
  const [planningId, setPlanningId]   = useState(null);
  const [editOpen, setEditOpen]       = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving]   = useState(false);
  const [editForm, setEditForm]       = useState(EMPTY_EDIT_FORM);
  const [addOpen, setAddOpen]         = useState(false);
  const [addSaving, setAddSaving]     = useState(false);
  const [advancePeriod, setAdvancePeriod] = useState("month");
  const [repOptions, setRepOptions]   = useState(["All"]);
  const [repsLoading, setRepsLoading] = useState(false);

  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [addForm, setAddForm] = useState({
    name: "", phone: "", email: "", business: "", industry: "", location: "", requirements: "",
    branch: "Bangalore", source: "WhatsApp", stage: "Lead Capture", priority: "Hot", value: "", rep: "",
    gstApplicable: false, gstRate: 18,
    leadDateTime: nowLocal(),
  });

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("branch",   filters.branch);
    p.set("stage",    filters.stage);
    p.set("projectStage", filters.projectStage);
    p.set("priority", filters.priority);
    p.set("source",   filters.source);
    p.set("bant",     filters.bant);
    p.set("rep",      filters.rep);
    if (filters.q?.trim()) p.set("q", filters.q.trim());
    return p.toString();
  }, [filters]);

  const fetchReps = async () => {
    try {
      setRepsLoading(true);
      const res  = await fetch(`${API_BASE}/api/reps`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok || !json?.success) return;
      const rawData = Array.isArray(json?.data) ? json.data : [];
      const names   = rawData.map(item => (typeof item === "string" ? item : item?.name || item?.repName || "").trim()).filter(Boolean);
      const unique  = ["All", ...Array.from(new Set(names))];
      setRepOptions(unique);
      setFilters(p => p.rep !== "All" && !unique.includes(p.rep) ? { ...p, rep: "All" } : p);
    } catch (e) {
      console.error("fetchReps error:", e);
      setRepOptions(["All"]);
    } finally {
      setRepsLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setErr("");
      // The server sends 50 by default; ask for every page so all projects show (the table pages them here)
      const all = [];
      for (let p = 1; p <= 50; p++) {
        const res  = await fetch(`${API_BASE}/api/leads?${queryParams}&limit=200&page=${p}`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to fetch leads");
        all.push(...(json.data || []));
        if (p >= (json.pages || 1)) break;
      }
      setRows(all.map(x => ({
        id:              x._id,
        name:            x.name            || "—",
        phone:           x.phone           || "—",
        business:        x.business        || "—",
        branch:          x.branch          || "—",
        source:          x.source          || "—",
        stage:           x.stage           || "—",
        projectStage:    x.projectStage    || "",
        bant:            x.bant            || "—",
        priority:        x.priority        || "—",
        value:           Number(x.value    || 0),
        advanceReceived: x.advanceReceived != null ? Number(x.advanceReceived) : null,
        advanceReceivedDate: x.advanceReceivedDate || null,
        createdAt:       x.createdAt       || null,
        onboardedDate:   x.onboardedDate   || null,
        days:            x.days            || "0d",
        docs:            Number(x.docs     || 0),
        rep:             x.rep             || "—",
      })));
    } catch (e) {
      console.error("fetchLeads error:", e);
      setErr(e.message || "Failed to fetch");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReps(); }, []);
  useEffect(() => { fetchLeads(); }, [queryParams]);

  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const total = useMemo(() => rows.reduce((a, b) => a + (b.value || 0), 0), [rows]);

  const advanceTotal = useMemo(() => {
    const now          = new Date();
    const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return rows
      .filter(r => {
        if (!(r.advanceReceived > 0)) return false;
        const dateValue = r.advanceReceivedDate;
        if (!dateValue) return false;
        const d = new Date(dateValue);
        if (advancePeriod === "today") return d >= startOfDay;
        if (advancePeriod === "week")  return d >= startOfWeek;
        if (advancePeriod === "month") return d >= startOfMonth;
        return true;
      })
      .reduce((a, b) => a + (b.advanceReceived || 0), 0);
  }, [rows, advancePeriod]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginated  = rows.slice((page - 1) * pageSize, page * pageSize);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [queryParams]);

  const addLeadToTodayPlan = async (e, row) => {
    try {
      e.stopPropagation();
      setPlanningId(row.id);
      const res  = await fetch(`${API_BASE}/api/today-plan/from-lead/${row.id}`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ taskType: "new_call", priority: row.priority === "Hot" ? "urgent" : "medium", section: "call_immediately", dueLabel: "ASAP", subtitle: row.business, plannedDate: new Date().toISOString() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed");
      toast.success(json?.message || "Added to today's plan");
    } catch (e) { toast.error(e?.message || "Failed"); }
    finally { setPlanningId(null); }
  };

  const handleDeleteLead = async (e, id) => {
    try {
      e.stopPropagation();
      if (!window.confirm("Delete this lead?")) return;
      setDeletingId(id);
      const res  = await fetch(`${API_BASE}/api/leads/${id}`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to delete");
      if (selectedId === id) { setDrawerOpen(false); setSelectedId(null); }
      await fetchLeads();
    } catch (e) { toast.error(e?.message || "Failed to delete"); }
    finally { setDeletingId(null); }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetch(`${API_BASE}/api/leads/export/csv?${queryParams}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { toast.error(e?.message || "Failed to export"); }
    finally { setExporting(false); }
  };

  const closeEditModal = () => { setEditOpen(false); setEditForm(EMPTY_EDIT_FORM); };
  const closeAddModal  = () => {
    setAddOpen(false);
    setAddForm({ name: "", phone: "", email: "", business: "", industry: "", location: "", requirements: "", branch: "Bangalore", source: "WhatsApp", stage: "Lead Capture", projectStage: "", priority: "Hot", value: "", rep: "", gstApplicable: false, gstRate: 18, leadDateTime: nowLocal() });
  };

  const handleEditLead = async (e, id) => {
    try {
      e.stopPropagation();
      setEditLoading(true); setEditOpen(true);
      const res  = await fetch(`${API_BASE}/api/leads/${id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to load");
      const l = json?.data || {};
      setEditForm({
        _id:                 l._id                || "",
        name:                l.name               || "",
        phone:               l.phone              || "",
        email:               l.email              || "",
        business:            l.business           || "",
        industry:            l.industry           || "",
        location:            l.location           || "",
        requirements:        l.requirements       || "",
        branch:              l.branch             || "Bangalore",
        source:              l.source             || "WhatsApp",
        stage:               l.stage              || "Lead Capture",
        projectStage:        l.projectStage       || "",
        priority:            l.priority           || "Hot",
        value:               l.value > 0          ? Number(l.value) : "",
        days:                l.days               || "0d",
        rep:                 l.rep                || "",
        advanceReceived:     l.advanceReceived > 0 ? Number(l.advanceReceived) : "",
        advanceReceivedDate:     toDateInput(l.advanceReceivedDate),
        agreedTimeline:          l.agreedTimeline > 0 ? Number(l.agreedTimeline) : "",
        onboardedDate:           toDateInput(l.onboardedDate),
        projectCompleted:        !!l.projectCompleted,
        projectCompletionDate:   toDateInput(l.projectCompletionDate),
        gstApplicable:           !!l.gstApplicable,
        gstRate:                 l.gstRate || 18,
      });
    } catch (e) { toast.error(e?.message || "Failed to load lead"); setEditOpen(false); }
    finally { setEditLoading(false); }
  };

  const handleEditSubmit = async (e) => {
    try {
      e.preventDefault();
      if (!editForm.name?.trim()) { toast.warning("Name is required"); return; }
      if (!editForm.phone?.trim()) { toast.warning("Phone is required"); return; }
      setEditSaving(true);
      const res  = await fetch(`${API_BASE}/api/leads/${editForm._id}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name:                editForm.name,
          phone:               editForm.phone,
          email:               editForm.email,
          business:            editForm.business,
          industry:            editForm.industry,
          location:            editForm.location,
          requirements:        editForm.requirements,
          branch:              editForm.branch,
          source:              editForm.source,
          stage:               editForm.stage,
          projectStage:        editForm.projectStage,
          priority:            editForm.priority,
          value:               Number(editForm.value || 0),
          days:                editForm.days,
          rep:                 editForm.rep,
          advanceReceived:       editForm.advanceReceived !== "" ? Number(editForm.advanceReceived) : 0,
          advanceReceivedDate:   editForm.advanceReceivedDate || null,
          agreedTimeline:        editForm.agreedTimeline !== "" ? Number(editForm.agreedTimeline) : 0,
          onboardedDate:         editForm.onboardedDate || null,
          projectCompleted:      editForm.projectCompleted,
          projectCompletionDate: editForm.projectCompletionDate || null,
          gstApplicable:         editForm.gstApplicable,
          gstRate:               Number(editForm.gstRate || 18),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to update");
      closeEditModal(); await fetchLeads(); await fetchReps();
      toast.success("Lead updated successfully");
    } catch (e) { toast.error(e?.message || "Failed to update"); }
    finally { setEditSaving(false); }
  };

  const handleAddSubmit = async (e) => {
    try {
      e.preventDefault();
      if (!addForm.name?.trim())  { toast.warning("Name is required");  return; }
      if (!addForm.phone?.trim()) { toast.warning("Phone is required"); return; }
      if (!addForm.email?.trim()) { toast.warning("Email is required"); return; }
      setAddSaving(true);
      const res   = await fetch(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...addForm, value: addForm.value !== "" ? Number(addForm.value) : 0, createdAt: addForm.leadDateTime ? new Date(addForm.leadDateTime).toISOString() : new Date().toISOString() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to create");
      closeAddModal(); await fetchLeads(); await fetchReps();
    } catch (e) { toast.error(e?.message || "Failed to create lead"); }
    finally { setAddSaving(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`alLayout ${drawerOpen ? "drawer-open" : ""}`}>
      <Sidebar active="All Leads" />

      <div className="alMain">

        {/* ── Top bar ── */}
        <div className="alTopBar">
          <div className="alTopLeft">
            <div className="alTitle">All Leads</div>
            <span className="alCount">{rows.length}</span>
          </div>

          <div className="alTopRight">
            {/* Search */}
            <div className="alSearchWrap">
              <Search size={13} className="alSearchIcon" />
              <input
                className="alSearch"
                placeholder="Search name, phone, business..."
                value={filters.q}
                onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
              />
              {filters.q && <button type="button" className="alSearchClear" onClick={() => setFilters(p => ({ ...p, q: "" }))}><X size={12}/></button>}
            </div>

            {/* Advance pill */}
            <div className="alAdvancePill">
              <span className="alAdvanceLabel">Advance</span>
              <span className="alAdvanceAmt">{money(advanceTotal)}</span>
              <select className="alAdvancePeriod" value={advancePeriod} onChange={e => setAdvancePeriod(e.target.value)}>
                <option value="today">Today</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="all">All</option>
              </select>
            </div>

            <button className="alBtn ghost" type="button" onClick={handleExport} disabled={exporting}>
              {exporting ? <BtnSpinner variant="dark" /> : <Download size={13}/>}
              {exporting ? "Exporting…" : "Export"}
            </button>
            <button className="alBtn primary" type="button" onClick={() => setAddOpen(true)}>
              <Plus size={13}/> Add Lead
            </button>
          </div>
        </div>

        {/* ── Stage tabs + compact filters ── */}
        <div className="alFilterRow">
          {/* Project stage pills */}
          <div className="alStagePills">
            {["All", "none", ...PROJECT_STAGES].map(s => {
              const active = filters.projectStage === s;
              const c = PROJECT_STAGE_COLOR[s === "none" ? "" : s];
              return (
                <button key={s} type="button"
                  className={`alStagePill ${active ? "active" : ""}`}
                  style={active && c ? { background: c.bg, color: c.color, borderColor: c.color + "55" } : {}}
                  onClick={() => setFilters(p => ({ ...p, projectStage: s, stage: "All" }))}>
                  {s === "All" ? "All Projects" : s === "none" ? "Not Started" : s}
                </button>
              );
            })}
          </div>

          {/* Compact dropdowns */}
          <div className="alDropdowns">
            <select className="alDrop" value={filters.branch}   onChange={e => setFilters(p => ({ ...p, branch:   e.target.value }))}>
              {BRANCHES.map(x   => <option key={x} value={x}>{x === "All" ? "All Branches" : x}</option>)}
            </select>
            <select className="alDrop" value={filters.priority} onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))}>
              {PRIORITIES.map(x => <option key={x} value={x}>{x === "All" ? "All Priority" : x}</option>)}
            </select>
            <select className="alDrop" value={filters.source}   onChange={e => setFilters(p => ({ ...p, source:   e.target.value }))}>
              {SOURCES.map(x    => <option key={x} value={x}>{x === "All" ? "All Sources"   : x}</option>)}
            </select>
            <select className="alDrop" value={filters.rep}      onChange={e => setFilters(p => ({ ...p, rep:      e.target.value }))} disabled={repsLoading}>
              {repOptions.map(x => <option key={x} value={x}>{x === "All" ? "All Reps" : x}</option>)}
            </select>
          </div>
        </div>

        {/* ── States ── */}
        {loading && <div className="alListWrap"><ShimmerLeadList rows={10} /></div>}
        {err     && <div className="alState error">{err}</div>}

        {/* ── Lead list ── */}
        {!loading && !err && (
          <div className="alListWrap">
            {/* Summary row */}
            <div className="alSummaryRow">
              <span>{rows.length} lead{rows.length !== 1 ? "s" : ""}</span>
              {total > 0 && <span>· {money(total)} total value</span>}
            </div>

            {rows.length === 0 ? (
              <div className="alEmpty">No leads found{filters.q ? ` for "${filters.q}"` : ""}.</div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                <table className="alTable">
                  <thead>
                    <tr>
                      <th>Sl No</th>
                      <th>Date</th>
                      <th>Business Name</th>
                      <th>Client Name</th>
                      <th>Project Stage</th>
                      <th>Date Onboarded</th>
                      <th>Rep</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r, idx) => {
                      const rowNum = (page - 1) * pageSize + idx + 1;
                      const fmtDate = (v) => v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                      return (
                        <tr key={r.id} onClick={() => { setSelectedId(r.id); setDrawerOpen(true); }}>
                          <td style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{rowNum}</td>
                          <td>
                            <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{fmtDate(r.createdAt)}</div>
                            <div style={{ fontSize: 10, color: "#a1a1aa" }}>{getAgo(r.createdAt)}</div>
                          </td>
                          <td className="alRowBiz">{r.business}</td>
                          <td>
                            <div className="alRowName">{r.name}</div>
                            <div className="alRowPhone">{r.phone}</div>
                          </td>
                          <td>
                            {(() => { const sc = PROJECT_STAGE_COLOR[r.projectStage] || PROJECT_STAGE_COLOR[""]; return (
                              <span className="alRowStage" style={{ background: sc.bg, color: sc.color }}>
                                {projectStageLabel(r.projectStage)}
                              </span>
                            ); })()}
                          </td>
                          <td>
                            <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{fmtDate(r.onboardedDate)}</div>
                          </td>
                          <td>
                            <div className="alRowRep">{r.rep}</div>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className="alRowActions">
                              <button type="button" className="alAct view" title="View" onClick={e => { e.stopPropagation(); setSelectedId(r.id); setDrawerOpen(true); }}><Eye size={14}/></button>
                              <button type="button" className="alAct edit" title="Edit" onClick={e => handleEditLead(e, r.id)}><Pencil size={14}/></button>
                              <button type="button" className="alAct plan" title="Add to Today's Plan" onClick={e => addLeadToTodayPlan(e, r)} disabled={planningId === r.id}><CalendarPlus size={14}/></button>
                              <button type="button" className="alAct del" title="Delete" onClick={e => handleDeleteLead(e, r.id)} disabled={deletingId === r.id}><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>

                {/* Pagination */}
                {rows.length > 0 && (
                  <div className="alPagination">
                    <div className="alPagLeft">
                      <span className="alPagInfo">
                        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length} leads
                      </span>
                      <span className="alPagInfo" style={{ marginLeft: 12 }}>Rows per page:</span>
                      <select
                        className="alPagSizeSelect"
                        value={pageSize}
                        onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                      >
                        {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="alPagButtons">
                      <button className="alPagBtn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                      <button className="alPagBtn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                        .reduce((acc, p, i, arr) => {
                          if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === "…"
                            ? <span key={`e${i}`} className="alPagEllipsis">…</span>
                            : <button key={p} className={`alPagBtn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                        )}
                      <button className="alPagBtn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                      <button className="alPagBtn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                    </div>
                  </div>
                )}

              </>
            )}
          </div>
        )}
      </div>

      {/* ── Lead Drawer ── */}
      <LeadDrawer
        open={drawerOpen}
        leadId={selectedId}
        apiBase={API_BASE}
        onClose={() => { setDrawerOpen(false); setSelectedId(null); }}
        onLeadUpdated={async () => { await fetchLeads(); await fetchReps(); }}
      />

      {/* ── Edit Modal ── */}
      {editOpen && (
        <div className="alModalOverlay" onClick={closeEditModal}>
          <div className="alModalCard" onClick={e => e.stopPropagation()}>
            <div className="alModalHeader">
              <h3>Edit Lead</h3>
              <button type="button" className="alModalClose" onClick={closeEditModal}><X size={18}/></button>
            </div>
            {editLoading ? <div className="alModalLoading">Loading...</div> : (
              <form className="alModalForm" onSubmit={handleEditSubmit}>
                <div className="alModalGrid">
                  <div className="fg"><label>Name *</label><input name="name" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required/></div>
                  <div className="fg"><label>Phone *</label><input name="phone" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} required/></div>
                  <div className="fg"><label>Email</label><input name="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}/></div>
                  <div className="fg"><label>Business</label><input name="business" value={editForm.business} onChange={e => setEditForm(p => ({ ...p, business: e.target.value }))}/></div>
                  <div className="fg"><label>Industry</label><input name="industry" value={editForm.industry} onChange={e => setEditForm(p => ({ ...p, industry: e.target.value }))}/></div>
                  <div className="fg"><label>Location</label><input name="location" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}/></div>
                  <div className="fg"><label>Branch</label><select value={editForm.branch} onChange={e => setEditForm(p => ({ ...p, branch: e.target.value }))}>{EDIT_BRANCHES.map(x => <option key={x}>{x}</option>)}</select></div>
                  <div className="fg"><label>Source</label><select value={editForm.source} onChange={e => setEditForm(p => ({ ...p, source: e.target.value }))}>{EDIT_SOURCES.map(x => <option key={x}>{x}</option>)}</select></div>
                  <div className="fg">
                    <label>Project Stage</label>
                    <select value={editForm.projectStage} onChange={e => setEditForm(p => ({ ...p, ...projectStagePatch(p, e.target.value) }))}>
                      <option value="">Not Started</option>
                      {PROJECT_STAGES.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="fg"><label>Priority</label><select value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}>{EDIT_PRIORITIES.map(x => <option key={x}>{x}</option>)}</select></div>
                  <div className="fg"><label>Total Amount Agreed (₹) {editForm.gstApplicable ? "— excl. GST" : ""}</label><input type="number" value={editForm.value} onChange={e => setEditForm(p => ({ ...p, value: e.target.value }))}/></div>
                  <div className="fg"><label>Rep</label><select value={editForm.rep} onChange={e => setEditForm(p => ({ ...p, rep: e.target.value }))}><option value="">Select Rep</option>{repOptions.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select></div>
                  <div className="fg full">
                    <label>GST</label>
                    <GstPicker
                      value={editForm.value}
                      gstApplicable={editForm.gstApplicable}
                      gstRate={editForm.gstRate}
                      onChange={patch => setEditForm(p => ({ ...p, ...patch }))}
                    />
                  </div>
                  <div className="fg"><label>Advance Received (₹)</label><input type="number" value={editForm.advanceReceived} onChange={e => setEditForm(p => ({ ...p, advanceReceived: e.target.value }))}/></div>
                  <div className="fg"><label>Advance Received Date</label><input type="date" value={editForm.advanceReceivedDate} onChange={e => setEditForm(p => ({ ...p, advanceReceivedDate: e.target.value }))}/></div>
                  <div className="fg"><label>Remaining Balance (₹){editForm.gstApplicable ? " — incl. GST" : ""}</label><input type="number" readOnly value={editForm.value !== "" ? calcRemaining(editForm.value, editForm.advanceReceived, editForm.gstApplicable, editForm.gstRate) : ""} className="alReadOnly"/></div>
                  <div className="fg"><label>Agreed Timeline (days)</label><input type="number" min="0" value={editForm.agreedTimeline} onChange={e => setEditForm(p => ({ ...p, agreedTimeline: e.target.value }))}/></div>
                  {editForm.advanceReceivedDate && editForm.agreedTimeline ? (
                    <div className="fg alFinalPayRow">
                      <label>Final Payment Date</label>
                      <div className="alFinalPayDate">{addDays(editForm.advanceReceivedDate, editForm.agreedTimeline)}</div>
                    </div>
                  ) : null}
                  <div className="fg"><label>Client Onboarded Date</label><input type="date" value={editForm.onboardedDate} onChange={e => setEditForm(p => ({ ...p, onboardedDate: e.target.value }))}/></div>
                  <div className="fg"><label>Project Completion Date</label><input type="date" value={editForm.projectCompletionDate} onChange={e => setEditForm(p => ({ ...p, projectCompletionDate: e.target.value }))}/></div>
                  <div className="fg full" style={{flexDirection:"row",alignItems:"center",gap:10}}>
                    <input type="checkbox" id="alProjDone" checked={editForm.projectCompleted} onChange={e => {
                      const checked = e.target.checked;
                      // Keep the project stage in step with the checkbox
                      setEditForm(p => checked
                        ? { ...p, ...projectStagePatch(p, "Project Completed") }
                        : { ...p, projectCompleted: false, ...(p.projectStage === "Project Completed" ? { projectStage: "Deployed / Live" } : {}) });
                    }} style={{width:16,height:16,accentColor:"#2563eb",cursor:"pointer"}}/>
                    <label htmlFor="alProjDone" style={{marginBottom:0,cursor:"pointer",textTransform:"none",fontSize:"13px",fontWeight:700,color:"#374151",letterSpacing:0}}>Project Completed</label>
                  </div>
                  <div className="fg full"><label>Requirements</label><textarea value={editForm.requirements} onChange={e => setEditForm(p => ({ ...p, requirements: e.target.value }))} rows={3}/></div>
                </div>
                <div className="alModalFooter">
                  <button type="button" className="alBtn ghost" onClick={closeEditModal}>Cancel</button>
                  <button type="submit" className="alBtn primary" disabled={editSaving}>
                    {editSaving && <BtnSpinner />} {editSaving ? "Saving…" : "Update Lead"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {addOpen && (
        <div className="alModalOverlay" onClick={closeAddModal}>
          <div className="alModalCard" onClick={e => e.stopPropagation()}>
            <div className="alModalHeader">
              <h3>Add New Lead</h3>
              <button type="button" className="alModalClose" onClick={closeAddModal}><X size={18}/></button>
            </div>
            <form className="alModalForm" onSubmit={handleAddSubmit}>
              <div className="alModalGrid">
                <div className="fg"><label>Name *</label><input name="name" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} required/></div>
                <div className="fg"><label>Phone *</label><input name="phone" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} required/></div>
                <div className="fg"><label>Email *</label><input type="email" name="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} required/></div>
                <div className="fg"><label>Business</label><input value={addForm.business} onChange={e => setAddForm(p => ({ ...p, business: e.target.value }))}/></div>
                <div className="fg"><label>Industry</label><input value={addForm.industry} onChange={e => setAddForm(p => ({ ...p, industry: e.target.value }))}/></div>
                <div className="fg"><label>Location</label><input value={addForm.location} onChange={e => setAddForm(p => ({ ...p, location: e.target.value }))}/></div>
                <div className="fg"><label>Branch</label><select value={addForm.branch} onChange={e => setAddForm(p => ({ ...p, branch: e.target.value }))}>{EDIT_BRANCHES.map(x => <option key={x}>{x}</option>)}</select></div>
                <div className="fg"><label>Source</label><select value={addForm.source} onChange={e => setAddForm(p => ({ ...p, source: e.target.value }))}>{EDIT_SOURCES.map(x => <option key={x}>{x}</option>)}</select></div>
                <div className="fg">
                  <label>Project Stage</label>
                  <select value={addForm.projectStage || ""} onChange={e => setAddForm(p => ({ ...p, projectStage: e.target.value }))}>
                    <option value="">Not Started</option>
                    {PROJECT_STAGES.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div className="fg"><label>Priority</label><select value={addForm.priority} onChange={e => setAddForm(p => ({ ...p, priority: e.target.value }))}>{EDIT_PRIORITIES.map(x => <option key={x}>{x}</option>)}</select></div>
                <div className="fg"><label>Total Amount Agreed (₹) {addForm.gstApplicable ? "— excl. GST" : ""}</label><input type="number" value={addForm.value} onChange={e => setAddForm(p => ({ ...p, value: e.target.value }))}/></div>
                <div className="fg"><label>Rep</label><select value={addForm.rep} onChange={e => setAddForm(p => ({ ...p, rep: e.target.value }))}><option value="">Select Rep</option>{repOptions.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select></div>
                <div className="fg full">
                  <label>GST</label>
                  <GstPicker
                    value={addForm.value}
                    gstApplicable={!!addForm.gstApplicable}
                    gstRate={addForm.gstRate || 18}
                    onChange={patch => setAddForm(p => ({ ...p, ...patch }))}
                  />
                </div>
                <div className="fg full"><label>Requirements</label><textarea value={addForm.requirements} onChange={e => setAddForm(p => ({ ...p, requirements: e.target.value }))} rows={3}/></div>
                <div className="fg full"><label>Lead Date &amp; Time</label><input type="datetime-local" value={addForm.leadDateTime} onChange={e => setAddForm(p => ({ ...p, leadDateTime: e.target.value }))}/></div>
              </div>
              <div className="alModalFooter">
                <button type="button" className="alBtn ghost" onClick={closeAddModal}>Cancel</button>
                <button type="submit" className="alBtn primary" disabled={addSaving}>
                  {addSaving && <BtnSpinner />} {addSaving ? "Creating…" : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
