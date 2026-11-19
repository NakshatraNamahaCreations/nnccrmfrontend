import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import LeadDrawer from "../Leads/LeadDrawer";
import { matchesSearch } from "../utils/search";
import "./PipelinePage.css";

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";

const STAGES = ["Lead Capture", "Reachable", "Qualified", "Proposal", "Closed"];

const BRANCHES = ["All", "Bangalore", "Mumbai", "Mysore"];

const STAGE_COLORS = {
  "Lead Capture": { bg: "#eaf1ff", color: "#2457e6" },
  Reachable:      { bg: "#e8faef", color: "#0a9b52" },
  Qualified:      { bg: "#fff4df", color: "#de8a00" },
  Proposal:       { bg: "#f2eaff", color: "#7c3aed" },
  Closed:         { bg: "#e7f7ef", color: "#0c9f61" },
};

const money = (n) => {
  try {
    if (!n) return "—";
    return `₹${Number(n).toLocaleString("en-IN")}`;
  } catch {
    return "—";
  }
};

const getAgo = (dateValue) => {
  try {
    if (!dateValue) return "—";
    const diffMs = Date.now() - new Date(dateValue).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  } catch {
    return "—";
  }
};

const initials = (name = "") => {
  try {
    return String(name).trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "?";
  } catch {
    return "?";
  }
};

export default function PipelinePage() {
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState("");
  const [pipeline, setPipeline]     = useState({});
  const [activeStage, setActiveStage] = useState("Lead Capture");
  const [activeBranch, setActiveBranch] = useState("All");
  const [search, setSearch]         = useState("");
  const [drawerLeadId, setDrawerLeadId] = useState(null);

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      setErr("");
      const token = localStorage.getItem("nnc_token");
      const res  = await fetch(`${API_BASE}/api/leads/pipeline-data/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to load pipeline");
      setPipeline(json?.data || {});
    } catch (e) {
      console.error("fetchPipeline error:", e);
      setErr(e.message || "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPipeline(); }, []);

  const stageLeads = useMemo(() => {
    const raw = pipeline[activeStage] || [];
    return raw.filter(l => {
      const matchBranch = activeBranch === "All" || l.branch === activeBranch;
      const matchSearch = matchesSearch(search, l.name, l.phone, l.business, l.company, l.email, l.requirements, l.location, l.source, l.repName, l.rep);
      return matchBranch && matchSearch;
    });
  }, [pipeline, activeStage, activeBranch, search]);

  const stageCounts = useMemo(() => {
    return Object.fromEntries(STAGES.map(s => [s, (pipeline[s] || []).length]));
  }, [pipeline]);

  const totalValue = useMemo(() => {
    return stageLeads.reduce((sum, l) => sum + Number(l.value || 0), 0);
  }, [stageLeads]);

  return (
    <div className="plLayout">
      <Sidebar active="Pipeline" />

      <div className="plMain">
        {/* ── Top bar ─────────────────────────────────── */}
        <div className="plTopBar">
          <div className="plTopLeft">
            <div className="plTitle">Pipeline</div>
            <div className="plBranchTabs">
              {BRANCHES.map(b => (
                <button
                  key={b}
                  type="button"
                  className={`plBranchTab ${activeBranch === b ? "active" : ""}`}
                  onClick={() => setActiveBranch(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <input
            className="plSearch"
            type="text"
            placeholder="Search name, phone, business..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Stage tabs ──────────────────────────────── */}
        <div className="plStageTabs">
          {STAGES.map(s => {
            const c = STAGE_COLORS[s] || {};
            const active = activeStage === s;
            return (
              <button
                key={s}
                type="button"
                className={`plStageTab ${active ? "active" : ""}`}
                style={active ? { background: c.bg, color: c.color, borderColor: c.color + "44" } : {}}
                onClick={() => setActiveStage(s)}
              >
                {s}
                <span className="plStageCount" style={active ? { background: c.color, color: "#fff" } : {}}>
                  {stageCounts[s] || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── List ────────────────────────────────────── */}
        <div className="plListWrap">
          {loading && <div className="plState">Loading pipeline...</div>}
          {err     && <div className="plState error">{err}</div>}

          {!loading && !err && (
            <>
              <div className="plListHeader">
                <span>{stageLeads.length} lead{stageLeads.length !== 1 ? "s" : ""}</span>
                {totalValue > 0 && <span>· {money(totalValue)} total value</span>}
              </div>

              {stageLeads.length === 0 ? (
                <div className="plEmpty">No leads in {activeStage}{activeBranch !== "All" ? ` · ${activeBranch}` : ""}</div>
              ) : (
                <div className="plList">
                  {stageLeads.map(lead => {
                    const id  = lead._id || lead.id;
                    const rep = lead.repName || lead.rep || "—";
                    return (
                      <div
                        key={id}
                        className="plRow"
                        onClick={() => setDrawerLeadId(id)}
                      >
                        {/* Avatar */}
                        <div className="plAvatar" style={{ background: STAGE_COLORS[lead.stage]?.bg || "#f1f5f9", color: STAGE_COLORS[lead.stage]?.color || "#475569" }}>
                          {initials(lead.name)}
                        </div>

                        {/* Name + business */}
                        <div className="plRowMain">
                          <div className="plRowName">{lead.name || "—"}</div>
                          <div className="plRowSub">{[lead.business, lead.branch].filter(Boolean).join(" · ") || "—"}</div>
                        </div>

                        {/* Source */}
                        <div className="plRowChip">{lead.source || "—"}</div>

                        {/* Value */}
                        <div className="plRowValue">{money(lead.value)}</div>

                        {/* Rep */}
                        <div className="plRowRep">{rep}</div>

                        {/* Age */}
                        <div className="plRowAgo">{getAgo(lead.createdAt)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lead drawer */}
      <LeadDrawer
        open={!!drawerLeadId}
        leadId={drawerLeadId}
        apiBase={API_BASE}
        onClose={() => setDrawerLeadId(null)}
        onLeadUpdated={() => fetchPipeline()}
      />
    </div>
  );
}
