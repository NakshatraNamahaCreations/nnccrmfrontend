import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import LeadDrawer from "../../Leads/LeadDrawer";
import ClientHistoryDrawer from "./ClientHistoryDrawer";
import PaymentCalendar from "./PaymentCalendar";
import { Download, Eye, Search, X, RefreshCcw, PlusCircle, History } from "lucide-react";
import { toast } from "../../utils/toast";
import { calcGst } from "../../Leads/gst";
import "./PaymentTracker.css";
import "./ClientHistoryDrawer.css";

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";
function auth() { const t = localStorage.getItem("nnc_token"); return t ? { Authorization: `Bearer ${t}` } : {}; }

const money = (n) => {
  if (n == null || n === 0) return "₹0";
  return `₹${Number(n).toLocaleString("en-IN")}`;
};

const fmtDate = (v) => {
  if (!v) return "-";
  try { return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "-"; }
};

const getPayStatus = (value, advance) => {
  const v = Number(value || 0), a = Number(advance || 0);
  if (v === 0) return "no-value";
  if (a >= v)  return "paid";
  if (a > 0)   return "partial";
  return "unpaid";
};

const STATUS_LABEL = { paid: "Paid", partial: "Partial", unpaid: "Unpaid", "no-value": "-" };

const cls = (s = "") => String(s).toLowerCase().replace(/\s+/g, "-");

const BRANCHES   = ["All", "Mysore", "Bangalore", "Mumbai"];
const STAGES     = ["All", "Lead Capture", "Reachable", "Qualified", "Proposal", "Closed"];
const PAY_STATUS = ["All", "Paid", "Partial", "Unpaid"];
const PAY_MODES  = ["NEFT", "RTGS", "UPI", "Cheque", "Cash", "IMPS", "Wire"];

export default function PaymentTracker() {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [repOptions, setRepOptions] = useState(["All"]);

  const [filters, setFilters] = useState({
    branch: "All", stage: "All", payStatus: "All", rep: "All", q: "",
  });

  // ── Bank accounts ──
  const [bankAccounts, setBankAccounts] = useState([]);
  // ── Account management modal ──
  const [acctMgmtOpen, setAcctMgmtOpen] = useState(false);
  const [acctForm, setAcctForm] = useState({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" });
  const [acctSaving, setAcctSaving] = useState(false);
  const [acctEditId, setAcctEditId] = useState(null);
  // ── Account filter / payments view ──
  const [acctFilter, setAcctFilter] = useState(""); // account _id or ""
  const [payRecords, setPayRecords] = useState([]);
  const [payRecordsLoading, setPayRecordsLoading] = useState(false);
  // ── Record Payment modal ──
  const [payModal, setPayModal]   = useState(null); // { id, name, value, advanceReceived }
  const [payForm,  setPayForm]    = useState({ amount: "", date: new Date().toISOString().slice(0,10), mode: "NEFT", account: "", transactionId: "", note: "" });
  const [paySaving, setPaySaving] = useState(false);
  const [historyClientId, setHistoryClientId] = useState(null);
  const [ptView, setPtView] = useState("table"); // "table" | "calendar"
  const [calReload, setCalReload] = useState(0);
  const amtRef = useRef(null);

  const fetchLeads = async () => {
    try {
      setLoading(true); setErr("");
      const p = new URLSearchParams();
      if (filters.branch !== "All") p.set("branch", filters.branch);
      if (filters.stage  !== "All") p.set("stage",  filters.stage);
      if (filters.rep    !== "All") p.set("rep",     filters.rep);
      if (filters.q.trim())         p.set("q",       filters.q.trim());

      const res  = await fetch(`${API_BASE}/api/leads?${p}`, { headers: auth() });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed");

      const mapped = (json.data || []).map((x) => {
        // value = amount before GST; the client owes value + GST when GST applies
        const g = calcGst(x.value, x.gstApplicable, x.gstRate || 18);
        const advance = Number(x.advanceReceived || 0);
        return {
          id:               x._id,
          name:             x.name || "-",
          phone:            x.phone || "-",
          business:         x.business || "-",
          branch:           x.branch || "-",
          stage:            x.stage || "-",
          rep:              x.rep || "-",
          value:            g.base,
          gstApplicable:    Boolean(x.gstApplicable),
          gstRate:          g.rate,
          gstAmount:        g.gst,
          totalWithGst:     g.total,
          advanceReceived:  advance,
          remaining:        Math.max(0, g.total - advance),
          onboardedDate:    x.onboardedDate || null,
          projectCompleted: Boolean(x.projectCompleted),
          createdAt:        x.createdAt || null,
          payStatus:        getPayStatus(g.total, advance),
        };
      });

      setRows(mapped);
    } catch (e) {
      setErr(e.message || "Failed to fetch"); setRows([]);
    } finally { setLoading(false); }
  };

  const fetchReps = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/reps`, { headers: auth() });
      const json = await res.json();
      if (!res.ok || !json?.success) return;
      const names = (Array.isArray(json.data) ? json.data : [])
        .map((r) => (typeof r === "string" ? r : r?.name || "").trim())
        .filter(Boolean);
      setRepOptions(["All", ...Array.from(new Set(names))]);
    } catch { setRepOptions(["All"]); }
  };

  const fetchBankAccounts = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/payment-tracker/bank-accounts`, { headers: auth() });
      const json = await res.json();
      if (res.ok && json.success) setBankAccounts(json.data || []);
    } catch { /* silent */ }
  };

  const fetchPayRecords = async (accountId) => {
    setPayRecordsLoading(true);
    try {
      const p = new URLSearchParams();
      if (accountId) p.set("account", accountId);
      const res  = await fetch(`${API_BASE}/api/payment-tracker/payments?${p}`, { headers: auth() });
      const json = await res.json();
      if (res.ok && json.success) setPayRecords(json.data || []);
    } catch { setPayRecords([]); }
    finally { setPayRecordsLoading(false); }
  };

  useEffect(() => { fetchReps(); fetchBankAccounts(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLeads(); }, [filters.branch, filters.stage, filters.rep, filters.q]);
  useEffect(() => { if (acctFilter) fetchPayRecords(acctFilter); }, [acctFilter]);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    setPage(1);
    if (filters.payStatus === "All") return rows;
    const target = filters.payStatus.toLowerCase();
    if (target === "unpaid") return rows.filter((r) => r.payStatus === "unpaid" || r.payStatus === "no-value");
    return rows.filter((r) => STATUS_LABEL[r.payStatus]?.toLowerCase() === target);
  }, [rows, filters.payStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totals = useMemo(() => ({
    agreed:    filtered.reduce((a, b) => a + b.value, 0),
    gst:       filtered.reduce((a, b) => a + b.gstAmount, 0),
    withGst:   filtered.reduce((a, b) => a + b.totalWithGst, 0),
    advance:   filtered.reduce((a, b) => a + b.advanceReceived, 0),
    remaining: filtered.reduce((a, b) => a + b.remaining, 0),
    paid:      filtered.filter((r) => r.payStatus === "paid").length,
    partial:   filtered.filter((r) => r.payStatus === "partial").length,
    unpaid:    filtered.filter((r) => r.payStatus === "unpaid" || r.payStatus === "no-value").length,
  }), [filtered]);

  const handleExport = () => {
    try {
      setExporting(true);
      const headers = ["Name","Phone","Business","Branch","Stage","Rep","Amount (excl. GST)","GST %","GST Amount","Total (incl. GST)","Advance","Remaining","Pay Status","Onboarded","Project Done"];
      const csv = [headers.join(","), ...filtered.map((r) =>
        [r.name, r.phone, r.business, r.branch, r.stage, r.rep,
         r.value, r.gstApplicable ? r.gstRate : 0, r.gstAmount, r.totalWithGst, r.advanceReceived, r.remaining,
         STATUS_LABEL[r.payStatus] || "-", fmtDate(r.onboardedDate), r.projectCompleted ? "Yes" : "No",
        ].map((v) => `"${v}"`).join(",")
      )].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } finally { setExporting(false); }
  };

  const handleExportPayRecords = () => {
    const acct = bankAccounts.find(a => a._id === acctFilter);
    const headers = ["Date", "Client", "Amount (₹)", "Mode", "Account", "Bank", "Transaction ID", "Remarks"];
    const csv = [headers.join(","), ...payRecords.map(r => [
      fmtDate(r.date),
      r.client,
      r.amount,
      r.mode,
      r.account?.name || "—",
      r.account?.bankName || "—",
      r.transactionId || "—",
      r.remarks || "—",
    ].map(v => `"${v}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `payments-${acct ? acct.name.replace(/\s+/g, "-") : "all"}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const saveAccount = async () => {
    if (!acctForm.name.trim()) return toast.error("Account name is required");
    setAcctSaving(true);
    try {
      const url    = acctEditId ? `${API_BASE}/api/payment-tracker/bank-accounts/${acctEditId}` : `${API_BASE}/api/payment-tracker/bank-accounts`;
      const method = acctEditId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(acctForm) });
      const json   = await res.json();
      if (!res.ok || !json.success) return toast.error(json.message || "Save failed");
      toast.success(acctEditId ? "Account updated" : "Account added");
      setAcctForm({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" });
      setAcctEditId(null);
      fetchBankAccounts();
    } catch { toast.error("Save failed"); }
    finally { setAcctSaving(false); }
  };

  const deleteAccount = async (id) => {
    if (!window.confirm("Remove this account?")) return;
    try {
      await fetch(`${API_BASE}/api/payment-tracker/bank-accounts/${id}`, { method: "DELETE", headers: auth() });
      toast.success("Removed");
      fetchBankAccounts();
    } catch { toast.error("Failed"); }
  };

  const openPayModal = (e, row) => {
    e.stopPropagation();
    setPayForm({ amount: "", date: new Date().toISOString().slice(0,10), mode: "NEFT", account: acctFilter || "", transactionId: "", note: "" });
    // The amount the client owes is the GST-inclusive total
    setPayModal({ ...row, value: row.totalWithGst });
    setTimeout(() => amtRef.current?.focus(), 80);
  };

  const handlePaySave = async () => {
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { toast.warning("Enter a valid payment amount"); return; }
    try {
      setPaySaving(true);
      const newAdvance = payModal.advanceReceived + amt;
      // Update lead advance
      const res = await fetch(`${API_BASE}/api/leads/${payModal.id}`, {
        method: "PUT",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceReceived:    newAdvance,
          advanceReceivedDate: payForm.date || new Date().toISOString().slice(0,10),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed");
      // Also create a PaymentRecord for detailed tracking (account, mode, txn id)
      // Find or create a PaymentClient entry for this lead
      try {
        // Check if a PaymentClient exists for this lead id or name
        let clientsRes = await fetch(`${API_BASE}/api/payment-tracker/clients`, { headers: auth() });
        let clientsJson = await clientsRes.json();
        let ptClient = (clientsJson.data || []).find(c => c.leadId === payModal.id || c.client === payModal.name);
        if (!ptClient) {
          // Create one on-the-fly
          const cr = await fetch(`${API_BASE}/api/payment-tracker/clients`, {
            method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
            body: JSON.stringify({ client: payModal.name, totalValue: payModal.value, received: 0 }),
          });
          const cj = await cr.json();
          ptClient = cj.data;
        }
        if (ptClient?._id) {
          await fetch(`${API_BASE}/api/payment-tracker/payments`, {
            method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: ptClient._id, client: payModal.name,
              amount: amt, date: payForm.date, mode: payForm.mode || "NEFT",
              transactionId: payForm.transactionId || "",
              remarks: payForm.note || "",
              account: payForm.account || undefined,
            }),
          });
        }
      } catch { /* non-fatal — lead advance already saved */ }
      toast.success(`₹${amt.toLocaleString("en-IN")} recorded for ${payModal.name}`);
      setPayModal(null);
      fetchLeads();
      setCalReload(k => k + 1);
    } catch (e) {
      toast.error(e?.message || "Failed to save payment");
    } finally {
      setPaySaving(false);
    }
  };

  return (
    <>
    <div className="ptLayout">
      <Sidebar />
      <div className="ptMain">
        <div className="ptBody">

          {/* ── View switch ── */}
          <div className="ptViewBar">
            <span className="ptViewLabel">View</span>
            <select value={ptView} onChange={e => setPtView(e.target.value)} aria-label="View">
              <option value="table">Payment Table</option>
              <option value="calendar">Payment Calendar</option>
            </select>
          </div>

          {ptView === "calendar" ? (
            <PaymentCalendar
              reloadKey={calReload}
              onRecordProject={(l) => {
                const g = calcGst(l.value, l.gstApplicable, l.gstRate || 18);
                openPayModal({ stopPropagation() {} }, { id: l._id, name: l.name, totalWithGst: g.total, advanceReceived: Number(l.advanceReceived || 0) });
              }}
            />
          ) : (<>

          {/* ── Summary cards ── */}
          <div className="ptSummaryRow">
            {[
              { label: "Total Agreed (incl. GST)", val: money(totals.withGst), accent: "blue",
                sub: `${money(totals.agreed)} + GST ${money(totals.gst)}` },
              { label: "Advance Received",  val: money(totals.advance),   accent: "green"  },
              { label: "Remaining Balance", val: money(totals.remaining), accent: "red"    },
              { label: "Fully Paid",        val: totals.paid,             accent: "teal"   },
              { label: "Partial",           val: totals.partial,          accent: "orange" },
              { label: "Unpaid",            val: totals.unpaid,           accent: "gray"   },
            ].map((c) => (
              <div key={c.label} className={`ptSumCard ${c.accent}`}>
                <div className="ptSumLabel">{c.label}</div>
                <div className="ptSumValue">{c.val}</div>
                {c.sub && <div className="ptSumSub">{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Filter bar ── */}
          <div className="ptFilterCard">
            <div className="ptFilterLeft">
              <div className="ptFilterLabel">FILTER</div>

              <select value={filters.branch} onChange={(e) => setFilters((p) => ({ ...p, branch: e.target.value }))}>
                {BRANCHES.map((x) => <option key={x}>{x === "All" ? "All Branches" : x}</option>)}
              </select>

              <select value={filters.stage} onChange={(e) => setFilters((p) => ({ ...p, stage: e.target.value }))}>
                {STAGES.map((x) => <option key={x} value={x}>{x === "All" ? "All Stages" : x}</option>)}
              </select>

              <select value={filters.payStatus} onChange={(e) => setFilters((p) => ({ ...p, payStatus: e.target.value }))}>
                {PAY_STATUS.map((x) => <option key={x} value={x}>{x === "All" ? "Pay Status" : x}</option>)}
              </select>

              <select value={filters.rep} onChange={(e) => setFilters((p) => ({ ...p, rep: e.target.value }))}>
                {repOptions.map((x) => <option key={x} value={x}>{x === "All" ? "All Reps" : x}</option>)}
              </select>

              <div className="ptSearchWrap">
                <Search size={13} className="ptSearchIcon" />
                <input
                  className="ptSearch"
                  placeholder="Search name / phone / business"
                  value={filters.q}
                  onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                />
                {filters.q && (
                  <button type="button" className="ptSearchClear" onClick={() => setFilters((p) => ({ ...p, q: "" }))}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                value={acctFilter}
                onChange={e => setAcctFilter(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <option value="">All Accounts</option>
                {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>

            <div className="ptFilterRight">
              <button type="button" className="ptRefreshBtn" onClick={() => setAcctMgmtOpen(true)}>
                Manage Accounts
              </button>
              <button type="button" className="ptRefreshBtn" onClick={acctFilter ? () => fetchPayRecords(acctFilter) : fetchLeads} disabled={loading || payRecordsLoading}>
                <RefreshCcw size={13} /> Refresh
              </button>
              {acctFilter ? (
                <button type="button" className="ptExportBtn" onClick={handleExportPayRecords}>
                  <Download size={13} /> Export
                </button>
              ) : (
                <button type="button" className="ptExportBtn" onClick={handleExport} disabled={exporting}>
                  <Download size={13} /> {exporting ? "Exporting..." : "Export"}
                </button>
              )}
            </div>
          </div>

          {loading && <div className="ptStatusBox">Loading payments...</div>}
          {err     && <div className="ptStatusBox ptErrorBox">{err}</div>}

          {/* ── Payment Records by Account ── */}
          {acctFilter && (
            <div className="ptTableCard" style={{ marginBottom: 16 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8edf5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                    Payments — {bankAccounts.find(a => a._id === acctFilter)?.name || "Selected Account"}
                  </span>
                  <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 10 }}>{payRecords.length} transactions · ₹{payRecords.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString("en-IN")}</span>
                </div>
                <button style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer" }} onClick={() => setAcctFilter("")}>✕ Clear filter</button>
              </div>
              {payRecordsLoading ? (
                <div className="ptStatusBox"><RefreshCcw size={16} style={{ animation: "spin 0.8s linear infinite" }} /></div>
              ) : payRecords.length === 0 ? (
                <div className="ptStatusBox">No payments found for this account.</div>
              ) : (
                <div className="ptTableScroll">
                  <table className="ptTable">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Account</th>
                        <th>Transaction ID</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payRecords.map((r, i) => (
                        <tr key={r._id} className="ptRow">
                          <td style={{ color: "#94a3b8", fontSize: 12, textAlign: "center" }}>{i + 1}</td>
                          <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                          <td>
                            <div className="ptLeadName">{r.client}</div>
                            {r.project && <div className="ptLeadPhone">{r.project}</div>}
                          </td>
                          <td style={{ fontWeight: 800, color: "#059669" }}>{money(r.amount)}</td>
                          <td><span className="ptPill branch" style={{ fontSize: 11 }}>{r.mode}</span></td>
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>{r.account?.name || "—"}</div>
                            {r.account?.bankName && <div style={{ fontSize: 11, color: "#64748b" }}>{r.account.bankName}</div>}
                          </td>
                          <td style={{ fontSize: 12, color: "#475569" }}>{r.transactionId || "—"}</td>
                          <td style={{ fontSize: 12, color: "#64748b" }}>{r.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Table ── */}
          <div className="ptTableCard">
            <div className="ptTableScroll">
              <table className="ptTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date Added</th>
                    <th>Lead / Contact</th>
                    <th>Business</th>
                    <th>Branch</th>
                    <th>Stage</th>
                    <th>Rep</th>
                    <th>Amount (excl. GST)</th>
                    <th>GST</th>
                    <th>Total (incl. GST)</th>
                    <th>Advance Rec'd</th>
                    <th>Remaining</th>
                    <th>Pay Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={14} className="ptEmpty">No records found.</td></tr>
                  )}
                  {paginated.map((r, idx) => (
                    <tr key={r.id} className="ptRow" onClick={() => { setSelectedId(r.id); setDrawerOpen(true); }}>
                      <td style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td>
                        <div className="ptLeadName">{r.name}</div>
                        <div className="ptLeadPhone">{r.phone}</div>
                      </td>
                      <td className="ptTrunc">{r.business}</td>
                      <td><span className={`ptPill branch ${cls(r.branch)}`}>{r.branch}</span></td>
                      <td><span className={`ptPill stage ${cls(r.stage)}`}>{r.stage}</span></td>
                      <td>{r.rep}</td>
                      <td className="ptAmtBase">{money(r.value)}</td>
                      <td className="ptAmtGst">
                        {r.gstApplicable ? (
                          <>
                            {money(r.gstAmount)}
                            <div className="ptGstRate">{r.gstRate}%</div>
                          </>
                        ) : (
                          <>
                            <span className="ptDash">₹0</span>
                            <div className="ptGstRate none">No GST</div>
                          </>
                        )}
                      </td>
                      <td className="ptAmtTotal">{money(r.totalWithGst)}</td>
                      <td className="ptAmtAdv">
                        {r.advanceReceived > 0 ? money(r.advanceReceived) : <span className="ptDash">-</span>}
                      </td>
                      <td className={`ptAmtRem ${r.remaining > 0 ? "has" : ""}`}>
                        {r.remaining > 0 ? money(r.remaining) : <span className="ptDash">₹0</span>}
                      </td>
                      <td>
                        {r.payStatus !== "no-value"
                          ? <span className={`ptPayBadge ${r.payStatus}`}>{STATUS_LABEL[r.payStatus]}</span>
                          : <span className="ptDash">-</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="ptViewBtn"
                          onClick={() => { setSelectedId(r.id); setDrawerOpen(true); }}>
                          <Eye size={13} /> View
                        </button>
                        <button type="button" className="ptRecordPayBtn"
                          onClick={(e) => openPayModal(e, r)}>
                          <PlusCircle size={13} /> Payment
                        </button>
                        <button type="button" className="ptHistoryBtn"
                          onClick={(e) => { e.stopPropagation(); setHistoryClientId(r.id); }}>
                          <History size={13} /> History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="ptPagination">
              <span className="ptPagInfo">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="ptPagButtons">
                <button className="ptPagBtn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                <button className="ptPagBtn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…"
                      ? <span key={`ellipsis-${i}`} className="ptPagEllipsis">…</span>
                      : <button key={p} className={`ptPagBtn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                  )}
                <button className="ptPagBtn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                <button className="ptPagBtn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
            </div>
          )}
          </>)}

        </div>
      </div>
    </div>

      <LeadDrawer
        open={drawerOpen}
        leadId={selectedId}
        apiBase={API_BASE}
        onClose={() => { setDrawerOpen(false); setSelectedId(null); }}
        onLeadUpdated={fetchLeads}
      />

      {/* ── Client History Drawer ── */}
      {historyClientId && (
        <ClientHistoryDrawer
          clientId={historyClientId}
          onClose={() => setHistoryClientId(null)}
        />
      )}

      {/* ── Manage Bank Accounts Modal ── */}
      {acctMgmtOpen && (
        <div className="ptModalOverlay" onClick={() => { setAcctMgmtOpen(false); setAcctEditId(null); setAcctForm({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" }); }}>
          <div className="ptModalBox" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="ptModalHeader">
              <div><div className="ptModalTitle">Manage Bank Accounts</div></div>
              <button className="ptModalClose" onClick={() => { setAcctMgmtOpen(false); setAcctEditId(null); setAcctForm({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" }); }}><X size={16} /></button>
            </div>
            <div className="ptModalBody">
              {/* Existing accounts */}
              {bankAccounts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {bankAccounts.map(a => (
                    <div key={a._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f8fafc", borderRadius: 8, marginBottom: 6, border: "1px solid #e2e8f0" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {a.bankName}{a.accountNumber ? ` · ${a.accountNumber}` : ""}{a.ifsc ? ` · ${a.ifsc}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="ptViewBtn" onClick={() => { setAcctEditId(a._id); setAcctForm({ name: a.name, bankName: a.bankName || "", accountNumber: a.accountNumber || "", ifsc: a.ifsc || "", branch: a.branch || "" }); }}>Edit</button>
                        <button className="ptRecordPayBtn" style={{ background: "#fee2e2", color: "#dc2626" }} onClick={() => deleteAccount(a._id)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Add / Edit form */}
              <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 8 }}>{acctEditId ? "Edit Account" : "Add New Account"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="ptModalField">
                  <label>Account Label *</label>
                  <input placeholder="e.g. NNC Main Account" value={acctForm.name} onChange={e => setAcctForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="ptModalField">
                  <label>Bank Name</label>
                  <input placeholder="e.g. HDFC Bank" value={acctForm.bankName} onChange={e => setAcctForm(f => ({ ...f, bankName: e.target.value }))} />
                </div>
                <div className="ptModalField">
                  <label>Account Number</label>
                  <input placeholder="Account number" value={acctForm.accountNumber} onChange={e => setAcctForm(f => ({ ...f, accountNumber: e.target.value }))} />
                </div>
                <div className="ptModalField">
                  <label>IFSC Code</label>
                  <input placeholder="IFSC" value={acctForm.ifsc} onChange={e => setAcctForm(f => ({ ...f, ifsc: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="ptModalFooter">
              {acctEditId && <button className="ptModalCancelBtn" onClick={() => { setAcctEditId(null); setAcctForm({ name: "", bankName: "", accountNumber: "", ifsc: "", branch: "" }); }}>Cancel Edit</button>}
              <button className="ptModalSaveBtn" onClick={saveAccount} disabled={acctSaving}>
                {acctSaving ? "Saving…" : acctEditId ? "Update Account" : "Add Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {payModal && (
        <div className="ptModalOverlay" onClick={() => setPayModal(null)}>
          <div className="ptModalBox" onClick={(e) => e.stopPropagation()}>
            <div className="ptModalHeader">
              <div>
                <div className="ptModalTitle">Record Payment</div>
                <div className="ptModalSub">{payModal.name} · Current advance: {money(payModal.advanceReceived)}</div>
              </div>
              <button className="ptModalClose" onClick={() => setPayModal(null)}><X size={16} /></button>
            </div>

            <div className="ptModalBody">
              {/* Progress bar */}
              {payModal.value > 0 && (
                <div className="ptPayProgress">
                  <div className="ptPayProgressBar">
                    <div
                      className="ptPayProgressFill"
                      style={{ width: `${Math.min(100, (payModal.advanceReceived / payModal.value) * 100)}%` }}
                    />
                  </div>
                  <div className="ptPayProgressLabel">
                    {money(payModal.advanceReceived)} of {money(payModal.value)} received
                    · Remaining: {money(payModal.remaining)}
                  </div>
                </div>
              )}

              <div className="ptModalField">
                <label>Payment Amount (₹) <span style={{color:"#ef4444"}}>*</span></label>
                <input
                  ref={amtRef}
                  type="number"
                  min="1"
                  placeholder="Enter amount received today"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handlePaySave()}
                />
                {payModal.value > 0 && Number(payForm.amount) > 0 && (
                  <div className="ptPayHint">
                    New total: {money(payModal.advanceReceived + Number(payForm.amount))}
                    {payModal.advanceReceived + Number(payForm.amount) >= payModal.value
                      ? " · ✅ Fully Paid!" : ` · Remaining: ${money(Math.max(0, payModal.value - payModal.advanceReceived - Number(payForm.amount)))}`}
                  </div>
                )}
              </div>

              <div className="ptModalField">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={payForm.date}
                  onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>

              <div className="ptModalGrid2">
                <div className="ptModalField">
                  <label>Payment Mode</label>
                  <select value={payForm.mode} onChange={e => setPayForm(p => ({ ...p, mode: e.target.value }))}>
                    {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="ptModalField">
                  <label>Transaction ID / UTR</label>
                  <input
                    type="text"
                    placeholder="UTR / ref / cheque no."
                    value={payForm.transactionId}
                    onChange={(e) => setPayForm((p) => ({ ...p, transactionId: e.target.value }))}
                  />
                </div>
              </div>

              <div className="ptModalField">
                <label>Received in Account</label>
                <select value={payForm.account} onChange={e => setPayForm(p => ({ ...p, account: e.target.value }))}>
                  <option value="">— Select Account —</option>
                  {bankAccounts.map(a => (
                    <option key={a._id} value={a._id}>{a.name}{a.bankName ? ` · ${a.bankName}` : ""}</option>
                  ))}
                </select>
                {bankAccounts.length === 0 && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    No accounts added yet.{" "}
                    <button type="button" style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontSize: 11, padding: 0, fontWeight: 700 }}
                      onClick={() => { setPayModal(null); setAcctMgmtOpen(true); }}>
                      + Add accounts →
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="ptModalFooter">
              <button className="ptModalCancelBtn" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="ptModalSaveBtn" onClick={handlePaySave} disabled={paySaving}>
                {paySaving ? "Saving…" : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
