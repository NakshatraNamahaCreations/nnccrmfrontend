import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Plus } from "lucide-react";
import { toast } from "../../utils/toast";
import Sidebar from "../../components/Sidebar/Sidebar";
import IntegrationFormModal from "./IntegrationFormModal";
import { IntegrationCard } from "./ProjectIntegrations";
import { api, canEditIntegrations, CATEGORIES, CATEGORY_META, STATUS_META, renewalState } from "./integrationMeta";
import "./Integrations.css";

/** Sidebar page: every project's third-party integrations, grouped by project */
export default function IntegrationsPage() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus]     = useState("");
  const [cardFilter, setCardFilter] = useState(""); // "" | "live" | "issue" | "renewal"
  const [modal, setModal]       = useState(null);
  const canEdit = canEditIntegrations();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const json = await api("");
      setItems(json.data || []);
    } catch (err) {
      setError(err.status === 403 ? "You don't have access to integrations." : err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total:    items.length,
    projects: new Set(items.map(i => i.lead?._id)).size,
    live:     items.filter(i => i.status === "live").length,
    issue:    items.filter(i => i.status === "issue").length,
    renewal:  items.filter(i => ["soon", "overdue"].includes(renewalState(i.renewalDate))).length,
  }), [items]);

  // Filter, then group by project
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter(i => {
      if (category && i.category !== category) return false;
      if (status && i.status !== status) return false;
      if (cardFilter === "live" && i.status !== "live") return false;
      if (cardFilter === "issue" && i.status !== "issue") return false;
      if (cardFilter === "renewal" && !["soon", "overdue"].includes(renewalState(i.renewalDate))) return false;
      if (!q) return true;
      return [i.service, i.category, i.username, i.lead?.name, i.lead?.business, i.lead?.company]
        .some(v => String(v || "").toLowerCase().includes(q));
    });
    const map = new Map();
    for (const i of list) {
      const id = i.lead._id;
      if (!map.has(id)) map.set(id, { lead: i.lead, items: [] });
      map.get(id).items.push(i);
    }
    return [...map.values()].sort((a, b) => a.lead.name.localeCompare(b.lead.name));
  }, [items, search, category, status, cardFilter]);

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.service} from ${item.lead?.name}? Its stored keys will be deleted too.`)) return;
    try {
      await api(`/${item._id}`, { method: "DELETE" });
      setItems(list => list.filter(x => x._id !== item._id));
      toast.success("Integration deleted");
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  // The save response has no populated project: keep the one we have (edit),
  // or use the project picked in the form (new)
  const saved = (doc, project) =>
    setItems(list => (list.some(x => x._id === doc._id)
      ? list.map(x => (x._id === doc._id ? { ...doc, lead: x.lead } : x))
      : [{ ...doc, lead: project || { _id: doc.lead, name: "Project" } }, ...list]));

  const cards = [
    { key: "",        label: "Total Integrations", value: stats.total,    sub: `${stats.projects} project${stats.projects === 1 ? "" : "s"}`, cls: "total" },
    { key: "live",    label: "Live",               value: stats.live,     sub: "Working",              cls: "live" },
    { key: "issue",   label: "Issues",             value: stats.issue,    sub: "Need attention",       cls: "issue" },
    { key: "renewal", label: "Renewals Due",       value: stats.renewal,  sub: "Overdue or in 30 days", cls: "renewal" },
  ];

  return (
    <div className="intg-layout">
      <Sidebar />
    <div className="intg-page">
      <div className="intg-page-head">
        <div>
          <h1 className="intg-page-title">Third-party Integrations</h1>
          <div className="intg-tab-sub">
            Payment gateways, SMS, hosting, domains and other services used across projects
          </div>
        </div>
        <div className="intg-page-acts">
          <button type="button" className="intg-btn ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "intg-spin" : ""} /> Refresh
          </button>
          {canEdit && (
            <button type="button" className="intg-btn primary" onClick={() => setModal({})}>
              <Plus size={14} /> Add Integration
            </button>
          )}
        </div>
      </div>

      <div className="intg-dash">
        {cards.map(c => (
          <button
            key={c.cls}
            type="button"
            className={`intg-dash-card ${c.cls}${cardFilter === c.key ? " active" : ""}`}
            onClick={() => setCardFilter(c.key)}
          >
            <span className="intg-dash-label">{c.label}</span>
            <span className="intg-dash-value">{c.value}</span>
            <span className="intg-dash-sub">{c.sub}</span>
          </button>
        ))}
      </div>

      <div className="intg-filters">
        <div className="intg-search">
          <Search size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search project, service, username…"
          />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].icon} {c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading && <div className="intg-empty">Loading…</div>}
      {!loading && error && <div className="intg-empty error">{error}</div>}
      {!loading && !error && groups.length === 0 && (
        <div className="intg-empty">
          {items.length === 0
            ? "No integrations added yet. Click “Add Integration” and pick a project."
            : "No integrations match these filters."}
        </div>
      )}

      {!loading && !error && groups.map(g => (
        <section key={g.lead._id} className="intg-group">
          <div className="intg-group-head">
            <div className="intg-group-avatar">{(g.lead.name || "?").slice(0, 2).toUpperCase()}</div>
            <div className="intg-group-main">
              <div className="intg-group-name">{g.lead.name}</div>
              <div className="intg-card-sub">
                {[g.lead.business || g.lead.company, g.lead.phone, g.lead.projectStage].filter(Boolean).join(" · ")}
              </div>
            </div>
            <span className="intg-group-count">{g.items.length} integration{g.items.length === 1 ? "" : "s"}</span>
          </div>
          <div className="intg-group-grid">
            {g.items.map(item => (
              <IntegrationCard key={item._id} item={item} canEdit={canEdit} onEdit={setModal} onDelete={remove} />
            ))}
          </div>
        </section>
      ))}

      {modal && (
        <IntegrationFormModal
          initial={modal._id ? modal : null}
          leadId={modal.lead?._id}
          leadName={modal.lead?.name}
          onSaved={saved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
    </div>
  );
}
