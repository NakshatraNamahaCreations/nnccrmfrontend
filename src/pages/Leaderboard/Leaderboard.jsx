import { useCallback, useEffect, useState } from "react";
import {
  Trophy, Medal, TrendingUp, Users, DollarSign, Target,
  Search, RefreshCcw, ArrowUp, ArrowDown, ChevronsUpDown,
  Award, Zap, BarChart2, Activity,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import Sidebar from "../../components/Sidebar/Sidebar";
import { matchesSearch } from "../../utils/search";
import "./Leaderboard.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
function auth() { const t = localStorage.getItem("nnc_token"); return t ? { Authorization: `Bearer ${t}` } : {}; }

function fmtINR(n) {
  const v = Number(n) || 0;
  if (v >= 10000000) return `₹${(v/10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v/100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v/1000).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}

const PERIODS = [
  { key:"this_month",  label:"This Month"  },
  { key:"last_month",  label:"Last Month"  },
  { key:"this_quarter",label:"This Quarter"},
  { key:"this_year",   label:"This Year"   },
  { key:"all",         label:"All Time"    },
];
const BRANCHES = ["", "Mysore", "Bangalore", "Mumbai"];
const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#cd7c2f"];
const MEDAL_LABELS = ["1st", "2nd", "3rd"];
const AVATAR_COLORS = [
  "#2563eb","#16a34a","#d97706","#7c3aed","#dc2626",
  "#0d9488","#db2777","#9333ea","#ea580c","#0284c7",
];
function avatarColor(name) {
  let h = 0; for (let i = 0; i < (name||"").length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function initials(name) { return String(name||"U").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(); }

// ── Custom bar tooltip ─────────────────────────────────────────────────────────
function BranchTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="lb-ct">
      <div className="lb-ct-label">{label}</div>
      {payload.map((p,i) => (
        <div key={i} className="lb-ct-row">
          <span className="lb-ct-dot" style={{background:p.fill||p.color}}/>
          <span>{p.name}</span>
          <strong>{p.name==="Revenue" ? fmtINR(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KPI({ icon:Icon, label, value, sub, color }) {
  return (
    <div className="lb-kpi" style={{borderLeftColor:color}}>
      <div className="lb-kpi-top"><Icon size={16} color={color}/></div>
      <div className="lb-kpi-val">{value}</div>
      <div className="lb-kpi-label">{label}</div>
      {sub && <div className="lb-kpi-sub">{sub}</div>}
    </div>
  );
}

// ── Podium ─────────────────────────────────────────────────────────────────────
function Podium({ top3 }) {
  // Order: 2nd | 1st | 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = { 0: 100, 1: 140, 2: 80 }; // 2nd, 1st, 3rd heights

  return (
    <div className="lb-podium">
      {order.map((rep, i) => {
        const isFirst = rep.rank === 1;
        const height  = isFirst ? 140 : rep.rank === 2 ? 100 : 80;
        return (
          <div key={rep.name} className={`lb-podium-col ${isFirst ? "first" : ""}`}>
            {isFirst && <div className="lb-crown"><Trophy size={20} color="#f59e0b"/></div>}
            <div className="lb-podium-avatar" style={{background: avatarColor(rep.name), boxShadow: isFirst ? `0 0 0 3px ${MEDAL_COLORS[rep.rank-1]}` : "none"}}>
              {initials(rep.name)}
            </div>
            <div className="lb-podium-name">{rep.name}</div>
            <div className="lb-podium-branch">{rep.branch}</div>
            <div className="lb-podium-stats">
              <span>{rep.closed} deals</span>
              <span>{fmtINR(rep.revenue)}</span>
            </div>
            <div className="lb-podium-base" style={{height, background: MEDAL_COLORS[rep.rank-1]}}>
              <span className="lb-podium-rank">{MEDAL_LABELS[rep.rank-1]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sortable table ─────────────────────────────────────────────────────────────
const COLS = [
  { key:"rank",      label:"#",          align:"center" },
  { key:"rep",       label:"Rep",        align:"left"   },
  { key:"branch",    label:"Branch",     align:"left"   },
  { key:"leads",     label:"Leads",      align:"right"  },
  { key:"contacted", label:"Contacted",  align:"right"  },
  { key:"proposals", label:"Proposals",  align:"right"  },
  { key:"closed",    label:"Closed",     align:"right"  },
  { key:"closeRate", label:"Win Rate",   align:"right"  },
  { key:"avgDeal",   label:"Avg Deal",   align:"right"  },
  { key:"revenue",   label:"Revenue",    align:"right"  },
];

function Table({ rows, search }) {
  const [sortKey, setSortKey] = useState("closed");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (k) => {
    if (sortKey === k) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const filtered = rows.filter(r => matchesSearch(search, r.rep, r.branch));

  const sorted = [...filtered].sort((a,b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return sortDir==="asc" ? -1 : 1;
    if (va > vb) return sortDir==="asc" ?  1 : -1;
    return 0;
  });

  const maxRev = Math.max(...sorted.map(r=>r.revenue), 1);
  const maxClosed = Math.max(...sorted.map(r=>r.closed), 1);

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ChevronsUpDown size={12} className="lb-sort-icon"/>;
    return sortDir==="asc" ? <ArrowUp size={12} className="lb-sort-icon active"/> : <ArrowDown size={12} className="lb-sort-icon active"/>;
  };

  return (
    <div className="lb-table-wrap">
      <table className="lb-table">
        <thead>
          <tr>
            {COLS.map(c => (
              <th key={c.key} style={{textAlign:c.align}} onClick={()=>handleSort(c.key)} className="lb-th-sort">
                {c.label} <SortIcon k={c.key}/>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={COLS.length} className="lb-empty-td">No data found</td></tr>
          ) : sorted.map((row, i) => (
            <tr key={`${row.rep}-${i}`} className={i < 3 ? `lb-tr-top${i}` : ""}>
              <td style={{textAlign:"center"}}>
                {i < 3
                  ? <span className="lb-medal" style={{background:MEDAL_COLORS[i]}}>{i+1}</span>
                  : <span className="lb-rank-num">{i+1}</span>}
              </td>
              <td>
                <div className="lb-rep-cell">
                  <div className="lb-mini-avatar" style={{background:avatarColor(row.rep)}}>{initials(row.rep)}</div>
                  <span>{row.rep}</span>
                </div>
              </td>
              <td><span className="lb-branch-pill">{row.branch}</span></td>
              <td style={{textAlign:"right"}}>{row.leads}</td>
              <td style={{textAlign:"right"}}>{row.contacted}</td>
              <td style={{textAlign:"right"}}>{row.proposals}</td>
              <td style={{textAlign:"right"}}>
                <div className="lb-bar-cell">
                  <div className="lb-bar-track">
                    <div className="lb-bar-fill" style={{width:`${(row.closed/maxClosed)*100}%`, background:"#2563eb"}}/>
                  </div>
                  <span>{row.closed}</span>
                </div>
              </td>
              <td style={{textAlign:"right"}}>
                <span className={`lb-rate-badge ${row.closeRate>=50?"high":row.closeRate>=25?"mid":"low"}`}>
                  {row.closeRate}%
                </span>
              </td>
              <td style={{textAlign:"right"}}>{fmtINR(row.avgDeal)}</td>
              <td style={{textAlign:"right"}}>
                <div className="lb-bar-cell">
                  <div className="lb-bar-track">
                    <div className="lb-bar-fill" style={{width:`${(row.revenue/maxRev)*100}%`, background:"#16a34a"}}/>
                  </div>
                  <span className="lb-rev-val">{fmtINR(row.revenue)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Activity feed ──────────────────────────────────────────────────────────────
function ActivityFeed({ items }) {
  if (!items?.length) return <div className="lb-empty" style={{padding:"24px 0"}}>No recent activity</div>;
  return (
    <div className="lb-activity-list">
      {items.map((item, i) => (
        <div key={i} className="lb-activity-item">
          <div className="lb-activity-dot" style={{background:item.color}}/>
          <div className="lb-activity-body">
            <div className="lb-activity-text"><strong>{item.rep}</strong> {item.text}{item.meta ? ` · ${item.meta}` : ""}</div>
            <div className="lb-activity-time">{item.timeAgo}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function Leaderboard() {
  const [period,  setPeriod]  = useState("this_month");
  const [branch,  setBranch]  = useState("");
  const [search,  setSearch]  = useState("");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/leaderboard?period=${period}&branch=${branch}`, { headers: auth() });
      if (!r.ok) throw new Error(`Server error (${r.status})`);
      const j = await r.json();
      if (j.success) setData(j.data);
      else throw new Error(j.message || "Failed to load leaderboard");
    } catch(e) {
      console.error(e);
      setError(e.message || "Failed to load leaderboard");
      setData(null);
    }
    finally { setLoading(false); }
  }, [period, branch]);

  useEffect(() => { load(); }, [load]);

  const s   = data?.summary || {};
  const top = data?.topThree || [];

  return (
    <div className="lb-layout">
      <Sidebar/>
      <div className="lb-main">

        {/* ── Header ── */}
        <div className="lb-header">
          <div className="lb-header-left">
            <h1 className="lb-title"><Trophy size={22} color="#f59e0b"/> Rep Leaderboard</h1>
            <p className="lb-sub">Sales performance across all reps and branches</p>
          </div>
          <div className="lb-header-right">
            <div className="lb-search-wrap">
              <Search size={14}/>
              <input placeholder="Search rep or branch…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="lb-sel" value={branch} onChange={e=>setBranch(e.target.value)}>
              {BRANCHES.map(b => <option key={b} value={b}>{b||"All Branches"}</option>)}
            </select>
            <button className="lb-icon-btn" onClick={load} disabled={loading}><RefreshCcw size={15} className={loading?"lb-spin":""}/></button>
          </div>
        </div>

        {/* ── Period tabs ── */}
        <div className="lb-period-tabs">
          {PERIODS.map(p => (
            <button key={p.key} className={`lb-period-tab ${period===p.key?"active":""}`} onClick={()=>setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {error && <div className="lb-error-banner" style={{background:"#fef2f2",color:"#b91c1c",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",margin:"0 0 12px",fontSize:13,display:"flex",alignItems:"center",gap:8}}>{error}</div>}

        {loading ? (
          <div className="lb-loading"><RefreshCcw size={24} className="lb-spin"/> Loading leaderboard…</div>
        ) : !data ? (
          <div className="lb-empty" style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8",fontSize:15}}>
            <Users size={40} style={{marginBottom:12,opacity:0.4}}/>
            <div>No leaderboard data available</div>
            <div style={{fontSize:12,marginTop:4}}>Try a different period or branch filter</div>
          </div>
        ) : (
          <>
            {/* ── KPI Strip ── */}
            <div className="lb-kpi-grid">
              <KPI icon={DollarSign} label="Total Revenue"   value={fmtINR(s.totalRevenue)} sub={`${s.totalClosed} deals closed`} color="#2563eb"/>
              <KPI icon={Target}     label="Closed Deals"    value={s.totalClosed||0}      sub={`From ${s.totalLeads||0} leads`}  color="#16a34a"/>
              <KPI icon={Users}      label="Active Reps"     value={s.activeReps||0}       sub="This period"                      color="#7c3aed"/>
              <KPI icon={TrendingUp} label="Avg Win Rate"    value={`${s.avgCloseRate||0}%`} sub="Across all reps"               color="#d97706"/>
              <KPI icon={Award}      label="Top Performer"   value={s.topRep||"—"}         sub="By closed deals"                  color="#f59e0b"/>
            </div>

            {/* ── Podium + Branch Chart + Activity ── */}
            <div className="lb-mid-grid">

              {/* Podium */}
              <div className="lb-card lb-podium-card">
                <div className="lb-card-head"><Trophy size={15} color="#f59e0b"/> <span>Top 3 Performers</span></div>
                {top.length >= 1 ? <Podium top3={top}/> : <div className="lb-empty">Not enough data</div>}
              </div>

              {/* Branch Comparison */}
              <div className="lb-card lb-chart-card">
                <div className="lb-card-head"><BarChart2 size={15}/> <span>Branch Comparison</span></div>
                {(data?.branchComparison||[]).length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.branchComparison} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="branch" tick={{fontSize:11,fill:"#94a3b8"}}/>
                      <YAxis yAxisId="l" tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={v=>fmtINR(v)}/>
                      <YAxis yAxisId="r" orientation="right" tick={{fontSize:11,fill:"#94a3b8"}}/>
                      <Tooltip content={<BranchTooltip/>}/>
                      <Bar yAxisId="l" dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                        {(data.branchComparison||[]).map((_,i)=><Cell key={i} fill={["#2563eb","#16a34a","#d97706"][i%3]}/>)}
                      </Bar>
                      <Bar yAxisId="r" dataKey="closed"  name="Closed"  radius={[4,4,0,0]} fill="#e2e8f0">
                        {(data.branchComparison||[]).map((_,i)=><Cell key={i} fill={["#bfdbfe","#bbf7d0","#fde68a"][i%3]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="lb-empty">No branch data</div>}
              </div>

              {/* Activity Feed */}
              <div className="lb-card lb-activity-card">
                <div className="lb-card-head"><Activity size={15}/> <span>Recent Activity</span></div>
                <ActivityFeed items={data?.recentActivity}/>
              </div>
            </div>

            {/* ── Full Table ── */}
            <div className="lb-card lb-table-card">
              <div className="lb-card-head">
                <Zap size={15}/> <span>Performance Breakdown</span>
                <span className="lb-table-count">{(data?.performanceBreakdown||[]).length} reps</span>
              </div>
              <Table rows={data?.performanceBreakdown||[]} search={search}/>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
