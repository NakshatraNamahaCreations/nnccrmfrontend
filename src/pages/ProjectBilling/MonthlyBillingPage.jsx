import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "../../utils/toast";
import Sidebar from "../../components/Sidebar/Sidebar";
import { ExtraCard, ServiceCard } from "./BillingCards";
import { ExtraFormModal, ServiceFormModal } from "./BillingModals";
import { billingApi, canEditBilling, monthLabel, EXTRA_STATUS, SERVICE_TYPES } from "./billingMeta";
import { inr } from "../../Leads/gst";
import "../Integrations/Integrations.css";
import "./ProjectBilling.css";

// Save responses don't include the populated project, so keep the one we have
// (edit) or use the project picked in the form (new)
const upsert = (list, doc, project) => {
  const prev = list.find(x => x._id === doc._id);
  const lead = prev?.lead || project || { _id: doc.lead, name: "Project" };
  return prev ? list.map(x => (x._id === doc._id ? { ...doc, lead } : x)) : [{ ...doc, lead }, ...list];
};

// Business name first, then the client's name
const bizOf = (l) => String(l?.business || l?.company || "").trim();
const projectLabel = (l) => (bizOf(l) ? (l.name && l.name !== bizOf(l) ? `${bizOf(l)} — ${l.name}` : bizOf(l)) : l?.name || "Project");

const SERVICE_FILTERS = [
  { key: "",        label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "pending", label: "Pending this month" },
  { key: "paid",    label: "Paid this month" },
  { key: "stopped", label: "Stopped" },
];

/** Sidebar page: monthly services and additional work across all projects */
export default function MonthlyBillingPage() {
  const [tab, setTab]           = useState("monthly");
  const [services, setServices] = useState([]);
  const [extras, setExtras]     = useState([]);
  const [period, setPeriod]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("");
  const [extraStatus, setExtraStatus] = useState("");
  const [project, setProject]   = useState("");
  const [type, setType]         = useState("");
  const [month, setMonth]       = useState("");   // "YYYY-MM": work requested that month
  const [modal, setModal]       = useState(null); // { kind, item }
  const canEdit = canEditBilling();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, e] = await Promise.all([billingApi("/recurring-services"), billingApi("/project-extras")]);
      setServices(s.data || []);
      setPeriod(s.period || "");
      setExtras(e.data || []);
    } catch (err) {
      setError(err.status === 403 ? "You don't have access to this page." : err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const active   = services.filter(s => s.active);
    const expected = services.reduce((t, s) => t + (s.current?.amount || 0), 0);
    const got      = services.reduce((t, s) => t + (s.current?.paid || 0), 0);
    const liveExtras = extras.filter(x => x.status !== "cancelled");
    return {
      active:       active.length,
      monthly:      active.reduce((t, s) => t + s.monthlyTotal, 0),
      expected, got,
      pending:      Math.max(0, expected - got),
      overdue:      services.reduce((t, s) => t + s.overdueAmount, 0),
      overdueCount: services.filter(s => s.overdueCount).length,
      extrasBal:    liveExtras.reduce((t, x) => t + x.balance, 0),
      extrasCount:  liveExtras.filter(x => x.balance > 0).length,
    };
  }, [services, extras]);

  // every project that has a service or extra work, by business name
  const projectOpts = useMemo(() => {
    const m = new Map();
    [...services, ...extras].forEach(x => { if (x.lead?._id && !m.has(x.lead._id)) m.set(x.lead._id, projectLabel(x.lead)); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [services, extras]);
  const anyFilter = !!(search || filter || extraStatus || project || type || month);
  const clearFilters = () => { setSearch(""); setFilter(""); setExtraStatus(""); setProject(""); setType(""); setMonth(""); };

  const q = search.trim().toLowerCase();
  const matches = (...vals) => !q || vals.some(v => String(v || "").toLowerCase().includes(q));

  const shownServices = services.filter(s => {
    if (!matches(s.name, s.type, s.lead?.name, s.lead?.business, s.lead?.company)) return false;
    if (project && s.lead?._id !== project) return false;
    if (type && s.type !== type) return false;
    const st = s.current?.status;
    if (filter === "overdue") return s.overdueCount > 0;
    if (filter === "pending") return ["due", "partial", "overdue"].includes(st);
    if (filter === "paid")    return st === "paid";
    if (filter === "stopped") return !s.active;
    return true;
  });

  const shownExtras = extras.filter(x =>
    matches(x.title, x.description, x.lead?.name, x.lead?.business, x.lead?.company) &&
    (!project || x.lead?._id === project) &&
    (!month || String(x.requestedDate || "").slice(0, 7) === month) &&
    (!extraStatus || (extraStatus === "unpaid" ? x.balance > 0 && x.status !== "cancelled" : x.status === extraStatus)));

  const removeService = async (item) => {
    if (!window.confirm(`Delete ${item.name} and all its monthly payments? To keep the history, use Stop instead.`)) return;
    try {
      await billingApi(`/recurring-services/${item._id}`, { method: "DELETE" });
      setServices(l => l.filter(x => x._id !== item._id));
      toast.success("Deleted");
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  const removeExtra = async (item) => {
    if (!window.confirm(`Delete "${item.title}" and its payments?`)) return;
    try {
      await billingApi(`/project-extras/${item._id}`, { method: "DELETE" });
      setExtras(l => l.filter(x => x._id !== item._id));
      toast.success("Deleted");
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  const cards = [
    { cls: "total",   label: "Active Services",                       value: stats.active,          sub: `${inr(stats.monthly)} / month`,  onClick: () => { setTab("monthly"); setFilter(""); } },
    { cls: "live",    label: `Collected ${period ? monthLabel(period) : ""}`, value: inr(stats.got), sub: `of ${inr(stats.expected)} expected`, onClick: () => { setTab("monthly"); setFilter("paid"); } },
    { cls: "renewal", label: "Pending this month",                    value: inr(stats.pending),    sub: "Not yet received",               onClick: () => { setTab("monthly"); setFilter("pending"); } },
    { cls: "issue",   label: "Overdue",                               value: inr(stats.overdue),    sub: `${stats.overdueCount} service${stats.overdueCount === 1 ? "" : "s"}`, onClick: () => { setTab("monthly"); setFilter("overdue"); } },
    { cls: "extra",   label: "Additional Work Balance",               value: inr(stats.extrasBal),  sub: `${stats.extrasCount} unpaid`,    onClick: () => { setTab("extras"); setExtraStatus("unpaid"); } },
  ];

  return (
    <div className="intg-layout">
      <Sidebar />
      <div className="intg-page">
        <div className="intg-page-head">
          <div>
            <h1 className="intg-page-title">Monthly &amp; Extras</h1>
            <div className="intg-tab-sub">Money from projects after the original deal — monthly services and additional work</div>
          </div>
          <div className="intg-page-acts">
            <button type="button" className="intg-btn ghost" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "intg-spin" : ""} /> Refresh
            </button>
            {canEdit && (
              <>
                <button type="button" className="intg-btn ghost" onClick={() => setModal({ kind: "extra" })}>
                  <Plus size={14} /> Add Work
                </button>
                <button type="button" className="intg-btn primary" onClick={() => setModal({ kind: "service" })}>
                  <Plus size={14} /> Add Monthly Service
                </button>
              </>
            )}
          </div>
        </div>

        <div className="intg-dash bill-dash">
          {cards.map(c => (
            <button key={c.cls} type="button" className={`intg-dash-card ${c.cls}`} onClick={c.onClick}>
              <span className="intg-dash-label">{c.label}</span>
              <span className="intg-dash-value">{c.value}</span>
              <span className="intg-dash-sub">{c.sub}</span>
            </button>
          ))}
        </div>

        <div className="bill-tabs">
          <button type="button" className={tab === "monthly" ? "active" : ""} onClick={() => setTab("monthly")}>
            Monthly Services ({services.length})
          </button>
          <button type="button" className={tab === "extras" ? "active" : ""} onClick={() => setTab("extras")}>
            Additional Work ({extras.length})
          </button>
        </div>

        <div className="intg-filters">
          <div className="intg-search">
            <Search size={14} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search business, client or service…" />
          </div>
          <select value={project} onChange={e => setProject(e.target.value)} aria-label="Project">
            <option value="">All projects</option>
            {projectOpts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          {tab === "monthly" && (
            <select value={type} onChange={e => setType(e.target.value)} aria-label="Service type">
              <option value="">All service types</option>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {tab === "monthly" ? (
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              {SERVICE_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          ) : (
            <select value={extraStatus} onChange={e => setExtraStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="unpaid">Balance pending</option>
              {Object.entries(EXTRA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          {tab === "extras" && (
            <label className="bill-month">Requested in <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
          )}
          {anyFilter && <button type="button" className="intg-btn ghost" onClick={clearFilters}>Clear filters</button>}
        </div>

        {loading && <div className="intg-empty">Loading…</div>}
        {!loading && error && <div className="intg-empty error">{error}</div>}

        {!loading && !error && tab === "monthly" && (
          shownServices.length === 0
            ? <div className="intg-empty">{services.length ? "No services match these filters." : "No monthly services yet. Click “Add Monthly Service”."}</div>
            : (
              <div className="intg-group-grid">
                {shownServices.map(s => (
                  <ServiceCard
                    key={s._id} item={s} canEdit={canEdit} showProject
                    onChange={doc => setServices(l => upsert(l, doc))}
                    onEdit={item => setModal({ kind: "service", item })}
                    onDelete={removeService}
                  />
                ))}
              </div>
            )
        )}

        {!loading && !error && tab === "extras" && (
          shownExtras.length === 0
            ? <div className="intg-empty">{extras.length ? "No work matches these filters." : "No additional work yet. Click “Add Work”."}</div>
            : (
              <div className="intg-group-grid">
                {shownExtras.map(x => (
                  <ExtraCard
                    key={x._id} item={x} canEdit={canEdit} showProject
                    onChange={doc => setExtras(l => upsert(l, doc))}
                    onEdit={item => setModal({ kind: "extra", item })}
                    onDelete={removeExtra}
                  />
                ))}
              </div>
            )
        )}

        {modal?.kind === "service" && (
          <ServiceFormModal
            initial={modal.item} leadId={modal.item?.lead?._id} leadName={modal.item?.lead ? projectLabel(modal.item.lead) : ""}
            onSaved={(doc, project) => { setServices(l => upsert(l, doc, project)); setTab("monthly"); }}
            onClose={() => setModal(null)}
          />
        )}
        {modal?.kind === "extra" && (
          <ExtraFormModal
            initial={modal.item} leadId={modal.item?.lead?._id} leadName={modal.item?.lead ? projectLabel(modal.item.lead) : ""}
            onSaved={(doc, project) => { setExtras(l => upsert(l, doc, project)); setTab("extras"); }}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    </div>
  );
}
