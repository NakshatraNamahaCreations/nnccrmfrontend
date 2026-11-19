import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Search, Clock } from "lucide-react";
import { toast } from "../../utils/toast";
import { matchesSearch } from "../../utils/search";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const STATUSES = [
  { key: "present",  label: "Present",  color: "#059669", bg: "#d1fae5" },
  { key: "absent",   label: "Absent",   color: "#dc2626", bg: "#fee2e2" },
  { key: "half-day", label: "Half Day", color: "#d97706", bg: "#fef3c7" },
  { key: "late",     label: "Late",     color: "#7c3aed", bg: "#ede9fe" },
  { key: "leave",    label: "Leave",    color: "#0891b2", bg: "#cffafe" },
  { key: "holiday",  label: "Holiday",  color: "#64748b", bg: "#f1f5f9" },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]));

function todayStr() { return new Date().toISOString().split("T")[0]; }
function authHeader() {
  const t = localStorage.getItem("nnc_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}
// check in / out are kept as the office clock in UTC: "2026-11-12T09:40:00Z" → "09:40"
const hhmm = (v) => {
  if (!v) return "";
  if (/^\d{1,2}:\d{2}$/.test(v)) return v.padStart(5, "0");
  const d = new Date(v);
  return isNaN(d) ? "" : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const ampm = (v) => { const t = hhmm(v); if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
const dur = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function DailyTab({ branch }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState({});
  const [search,       setSearch]       = useState("");

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ date: selectedDate });
      if (branch) p.set("branch", branch);
      const res  = await fetch(`${API}/api/attendance/daily?${p}`, { headers: authHeader() });
      const json = await res.json();
      if (res.ok && json.success) setRecords(json.data || []);
      else toast.error(json.message || "Failed to load");
    } catch (err) { toast.error(err.message || "Failed to load"); }
    finally { setLoading(false); }
  }, [selectedDate, branch]);

  useEffect(() => { fetchDaily(); }, [fetchDaily]);

  // status: send only to set it by hand; with just times, the server works out present / late / half day
  const save = async (empId, status, checkIn, checkOut) => {
    setSaving(s => ({ ...s, [empId]: true }));
    try {
      const body = { employeeId: empId, date: selectedDate };
      if (status) body.status = status;
      if (checkIn) body.checkIn = checkIn;
      if (checkOut) body.checkOut = checkOut;
      const res  = await fetch(`${API}/api/attendance/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.message || "Save failed"); return; }
      setRecords(prev => prev.map(r => (r.employee?._id === empId ? { ...r, attendance: json.data } : r)));
    } catch { toast.error("Save failed"); }
    finally { setSaving(s => { const n={...s}; delete n[empId]; return n; }); }
  };

  const handleStatus = (rec, status) => {
    const empId   = rec.employee?._id;
    // Only keep existing checkIn — never auto-fill with current time.
    // If the status clears attendance (absent/leave/holiday), send no checkIn.
    const off = ["absent", "leave", "holiday"].includes(status);
    save(empId, status, off ? undefined : hhmm(rec.attendance?.checkIn) || undefined, off ? undefined : hhmm(rec.attendance?.checkOut) || undefined);
  };

  // a typed time: the status follows the office timings
  const handleTime = (rec, which, time) => {
    const empId = rec.employee?._id, a = rec.attendance || {};
    const inT = which === "in" ? time : hhmm(a.checkIn), outT = which === "out" ? time : hhmm(a.checkOut);
    if (!inT) { toast.error("Enter the check-in time first"); return; }
    save(empId, undefined, inT, outT || undefined);
  };

  const handleBulk = async (status) => {
    if (!records.length) return;
    if (!window.confirm(`Mark ALL ${records.length} employees as "${status}"?`)) return;
    try {
      const res = await fetch(`${API}/api/attendance/mark-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ records: records.map(r => ({ employeeId: r.employee?._id, date: selectedDate, status })) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.message || "Failed"); return; }
      toast.success(`All marked as ${status}`);
      fetchDaily();
    } catch { toast.error("Bulk mark failed"); }
  };

  const counts = records.reduce((acc, r) => {
    const s = r.attendance?.status || "absent";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const filtered = search
    ? records.filter(r => matchesSearch(search, r.employee?.name, r.employee?.employeeId, r.employee?.designation,
        r.employee?.department, r.employee?.branch, r.employee?.phone, r.employee?.email, r.attendance?.status))
    : records;

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="att-toolbar">
        <input
          type="date" value={selectedDate} max={todayStr()}
          className="att-date-input"
          onChange={e => { if (e.target.value <= todayStr()) setSelectedDate(e.target.value); }}
        />
        <div className="att-search-wrap">
          <Search size={13} />
          <input placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="att-refresh-btn" onClick={fetchDaily} disabled={loading}>
          <RefreshCcw size={13} className={loading ? "att-spin" : ""} />
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="att-bulk-btn present" onClick={() => handleBulk("present")}>✓ All Present</button>
          <button className="att-bulk-btn holiday" onClick={() => handleBulk("holiday")}>All Holiday</button>
        </div>
      </div>

      {/* ── Summary chips ── */}
      <div className="att-summary-row">
        {STATUSES.slice(0, 5).map(s => (
          <span key={s.key} className="att-sum-chip" style={{ background: s.bg, color: s.color }}>
            <strong>{counts[s.key] || 0}</strong> {s.label}
          </span>
        ))}
        <span className="att-sum-total">Total: {records.length}</span>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="att-loading"><RefreshCcw size={28} className="att-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="att-empty">
          <div className="att-empty-icon">📋</div>
          <div className="att-empty-text">No employees found</div>
        </div>
      ) : (
        <div className="att-daily-table-wrap">
          <table className="att-daily-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec, idx) => {
                const emp      = rec.employee || {};
                const att      = rec.attendance || {};
                const empId    = emp._id;
                const status   = att.status || "absent";
                const st       = STATUS_MAP[status] || STATUS_MAP.absent;
                const isSaving = !!saving[empId];

                return (
                  <tr key={empId} className={isSaving ? "att-row-saving" : ""}>
                    {/* # */}
                    <td className="att-td-num">{idx + 1}</td>

                    {/* Employee */}
                    <td>
                      <div className="att-td-emp">
                        <div className="att-emp-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {(emp.name || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="att-emp-name">{emp.name || "—"}</div>
                          <div className="att-emp-meta">
                            <span className="att-emp-id">{emp.employeeId}</span>
                            {emp.designation && <span className="att-emp-desig">{emp.designation}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status + Late row */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <select
                          className="att-status-select"
                          value={status}
                          disabled={isSaving}
                          style={{ background: st.bg, color: st.color, borderColor: st.color + "66", flex: 1, minWidth: 120 }}
                          onChange={e => handleStatus(rec, e.target.value)}
                        >
                          {STATUSES.map(s => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                        {att.lateMinutes > 0 && (() => {
                          const h = Math.floor(att.lateMinutes / 60);
                          const m = att.lateMinutes % 60;
                          return <span className="att-late-tag">{h > 0 ? `${h}h ${m}m` : `${m}m`} late</span>;
                        })()}
                      </div>
                    </td>

                    {/* Check-in time */}
                    <td>
                      <div className="att-td-time">
                        <input
                          type="time"
                          className="att-time-input"
                          value={hhmm(att.checkIn)}
                          disabled={isSaving || status === "holiday" || status === "leave"}
                          onChange={e => e.target.value && handleTime(rec, "in", e.target.value)}
                        />
                        {!att.checkIn && status !== "holiday" && status !== "leave" && (
                          <button
                            className="att-now-btn"
                            title="Set check-in to now"
                            disabled={isSaving}
                            onClick={() => handleTime(rec, "in", nowHHMM())}
                          >
                            <Clock size={12} /> Now
                          </button>
                        )}
                      </div>
                      {att.markedBy === "Employee Portal" && <div className="att-src">from the Employee Portal</div>}
                    </td>

                    {/* Check-out time */}
                    <td>
                      <div className="att-td-time">
                        <input
                          type="time"
                          className="att-time-input"
                          value={hhmm(att.checkOut)}
                          disabled={isSaving || !att.checkIn || status === "holiday" || status === "leave"}
                          onChange={e => e.target.value && handleTime(rec, "out", e.target.value)}
                        />
                      </div>
                      {att.checkIn && !att.checkOut && status !== "holiday" && status !== "leave" && <div className="att-src">still in</div>}
                    </td>

                    {/* Hours, extra time */}
                    <td className="att-late-desktop">
                      {att.workingHours > 0 ? <b>{dur(att.workingHours * 60)}</b> : <span style={{ color: "#cbd5e1" }}>—</span>}
                      {att.overtimeMin > 0 && <div className="att-extra">+{dur(att.overtimeMin)} extra</div>}
                      {att.earlyLeaveMin > 0 && <div className="att-src">left {dur(att.earlyLeaveMin)} early</div>}
                      {att.checkIn && <div className="att-src">{ampm(att.checkIn)}{att.checkOut ? ` to ${ampm(att.checkOut)}` : ""}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
