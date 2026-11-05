import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Plus, ChevronDown, ChevronRight } from "lucide-react";
import Pager from "../LeadTracker/Pager";
import { toast } from "../../utils/toast";
import Sidebar from "../../components/Sidebar/Sidebar";
import IntegrationFormModal from "./IntegrationFormModal";
import { IntegrationCard } from "./ProjectIntegrations";
import { fetchProjects } from "../ProjectBilling/billingMeta";
import { api, canEditIntegrations, CATEGORIES, CATEGORY_META, STATUS_META, renewalState } from "./integrationMeta";
import "./Integrations.css";

// The business is what people recognise; the client's name is shown under it
const bizName = (l) => String(l?.business || l?.company || l?.name || "Project").trim();

/** Sidebar page: every project's third-party integrations, grouped by project */
export default function IntegrationsPage() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus]     = useState("");
  const [project, setProject]   = useState(""); // selected project id
  const [projects, setProjects] = useState([]);
  const [cardFilter, setCardFilter] = useState(""); // "" | "live" | "issue" | "renewal"
  const [modal, setModal]       = useState(null);
  const [open, setOpen]         = useState({});   // projects opened to show their credentials
  const [page, setPage]         = useState(0);
  const [per, setPer]           = useState(10);
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
  useEffect(() => { fetchProjects().then(setProjects).catch(() => setProjects([])); }, []);

  // Integration count per project, for the dropdown
  const countBy = useMemo(() => {
    const m = {};
    for (const i of items) m[i.lead?._id] = (m[i.lead?._id] || 0) + 1;
    return m;
  }, [items]);

  // Projects with integrations first, then the rest
  const projectOptions = useMemo(() => {
    const list = projects.length ? projects : [...new Map(items.map(i => [i.lead._id, i.lead])).values()];
    return [...list].sort((a, b) => ((countBy[b._id] ? 1 : 0) - (countBy[a._id] ? 1 : 0)) || String(a.name).localeCompare(String(b.name)));
  }, [projects, items, countBy]);
  const selectedProject = projectOptions.find(p => p._id === project) || null;

  // Integrations of the selected project (or all)
  const scoped = useMemo(() => (project ? items.filter(i => i.lead?._id === project) : items), [items, project]);

  const stats = useMemo(() => ({
    total:    scoped.length,
    projects: new Set(scoped.map(i => i.lead?._id)).size,
    live:     scoped.filter(i => i.status === "live").length,
    issue:    scoped.filter(i => i.status === "issue").length,
    renewal:  scoped.filter(i => ["soon", "overdue"].includes(renewalState(i.renewalDate))).length,
  }), [scoped]);

  // Filter, then group by project
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scoped.filter(i => {
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
    return [...map.values()].sort((a, b) => bizName(a.lead).localeCompare(bizName(b.lead)));
  }, [scoped, search, category, status, cardFilter]);
  // a search, a filter or one project picked: show the credentials straight away
  const autoOpen = !!(search.trim() || category || status || cardFilter || project);
  const pages = Math.max(1, Math.ceil(groups.length / per)), cur = Math.min(page, pages - 1);
  const pageGroups = groups.slice(cur * per, cur * per + per);

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
      : [{ ...doc, lead: project || projectOptions.find(p => p._id === String(doc.lead)) || { _id: doc.lead, name: "Project" } }, ...list]));

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
          <h1 className="intg-page-title">Credential Vault</h1>
          <div className="intg-tab-sub">
            Payment gateways, SMS, hosting, domains and other services used across projects
          </div>
        </div>
        <div className="intg-page-acts">
          <button type="button" className="intg-btn ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "intg-spin" : ""} /> Refresh
          </button>
          {canEdit && (
            <button type="button" className="intg-btn primary" onClick={() => setModal(selectedProject ? { lead: selectedProject } : {})}>
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
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search project, service, username…"
          />
        </div>
        <select className="intg-proj-select" value={project} onChange={e => { setProject(e.target.value); setPage(0); }}>
          <option value="">All projects</option>
          {projectOptions.map(p => (
            <option key={p._id} value={p._id}>
              {p.business ? `${p.business} — ${p.name}` : p.name} ({countBy[p._id] || 0})
            </option>
          ))}
        </select>
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
          {scoped.length === 0
            ? (project
              ? `No integrations for ${selectedProject?.name || "this project"} yet. Click “Add Integration” to add one.`
              : "No integrations added yet. Click “Add Integration” and pick a project.")
            : "No integrations match these filters."}
        </div>
      )}

      {!loading && !error && pageGroups.map(g => {
        const isOpen = open[g.lead._id] ?? autoOpen;
        const biz = bizName(g.lead);
        return (
          <section key={g.lead._id} className={`intg-group${isOpen ? "" : " closed"}`}>
            <button type="button" className="intg-group-head intg-group-toggle" aria-expanded={isOpen}
              onClick={() => setOpen(o => ({ ...o, [g.lead._id]: !isOpen }))}>
              <div className="intg-group-avatar">{biz.slice(0, 2).toUpperCase()}</div>
              <div className="intg-group-main">
                <div className="intg-group-name">{biz}</div>
                <div className="intg-card-sub">
                  {[biz !== g.lead.name ? g.lead.name : "", g.lead.phone, g.lead.projectStage].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span className="intg-group-count">{g.items.length} credential{g.items.length === 1 ? "" : "s"}</span>
              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {isOpen && (
              <div className="intg-group-grid">
                {g.items.map(item => (
                  <IntegrationCard key={item._id} item={item} canEdit={canEdit} onEdit={setModal} onDelete={remove} />
                ))}
              </div>
            )}
          </section>
        );
      })}
      {!loading && !error && groups.length > 10 && (
        <Pager total={groups.length} page={cur} per={per} onPage={setPage} onPer={setPer} sizes={[10, 25, 50]} label="projects" />
      )}

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
