import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, ChevronRight, RefreshCw, Pin, Trash2,
  CreditCard, PhoneCall, TrendingUp, Flame,
  AlertTriangle, ClipboardCheck, BookOpen, CheckCircle2,
  Circle, Zap, Send, IndianRupee, Plus, X, Check,
} from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import LeadDrawer from "../../Leads/LeadDrawer";
import { toast } from "../../utils/toast";
import "./OwnerDesk.css";

const API = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";
const auth = () => { const t = localStorage.getItem("nnc_token"); return t ? { Authorization: `Bearer ${t}` } : {}; };

const fmtINR = n => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(n||0);
const fmtL   = n => { const v = Number(n||0); if(v>=10000000) return `₹${(v/10000000).toFixed(2)}Cr`; if(v>=100000) return `₹${(v/100000).toFixed(1)}L`; if(v>=1000) return `₹${(v/1000).toFixed(1)}K`; return `₹${v}`; };

const P = {
  critical: { label:"Critical", color:"#ef4444", bar:"#ef4444" },
  high:     { label:"High",     color:"#f97316", bar:"#f97316" },
  medium:   { label:"Medium",   color:"#eab308", bar:"#eab308" },
  low:      { label:"Low",      color:"#3b82f6", bar:"#3b82f6" },
};
const T = {
  payment:  { label:"Collect Payment",  icon:<CreditCard size={12}/> },
  followup: { label:"Follow-up Due",    icon:<PhoneCall size={12}/> },
  hot_cold: { label:"Re-engage Lead",   icon:<Flame size={12}/> },
  approval: { label:"Chase Approval",   icon:<ClipboardCheck size={12}/> },
  project:  { label:"Overdue Delivery", icon:<AlertTriangle size={12}/> },
  enquiry:  { label:"Convert Enquiry",  icon:<TrendingUp size={12}/> },
};

const todayStr  = () => new Date().toISOString().slice(0,10);
const tomorrowStr = () => new Date(Date.now()+86400000).toISOString().slice(0,10);
const greeting  = () => { const h=new Date().getHours(); return h<12?"Morning":h<17?"Afternoon":"Evening"; };
const getStreak = () => {
  try {
    const d=JSON.parse(localStorage.getItem("od_streak")||"{}");
    const today=todayStr(), yest=new Date(Date.now()-86400000).toISOString().slice(0,10);
    if(d.lastDate===today) return d.count||1;
    const next={count:d.lastDate===yest?(d.count||0)+1:1,lastDate:today};
    localStorage.setItem("od_streak",JSON.stringify(next)); return next.count;
  } catch { return 1; }
};
const loadDone = () => { try{ return new Set(JSON.parse(localStorage.getItem(`od_done_${todayStr()}`)||"[]")); }catch{ return new Set(); } };
const saveDone = s => localStorage.setItem(`od_done_${todayStr()}`,JSON.stringify([...s]));

export default function OwnerDesk() {
  const navigate = useNavigate();
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [done,         setDone]         = useState(loadDone);
  const [notes,        setNotes]        = useState([]);
  const [noteText,     setNoteText]     = useState("");
  const [noteSaving,   setNoteSaving]   = useState(false);
  const [payExpected,  setPayExpected]  = useState([]);
  const [showPayForm,  setShowPayForm]  = useState(false);
  const [payForm,      setPayForm]      = useState({ text:"", amount:"", expectedDate: tomorrowStr(), leadId:"", leadName:"" });
  const [paySaving,    setPaySaving]    = useState(false);
  const [leadResults,  setLeadResults]  = useState([]);
  const [leadSearchQ,  setLeadSearchQ]  = useState("");
  const leadSearchTimer = useRef(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [drawerId,     setDrawerId]     = useState(null);
  const [showDone,     setShowDone]     = useState(false);
  const streak  = useRef(getStreak()).current;
  const noteRef = useRef();

  const fetchData = useCallback(async (ref=false) => {
    try {
      if(ref) setRefreshing(true); else setLoading(true);
      // Each request is independent so one failure doesn't blank the whole desk.
      // Retries cover Render cold starts, where the proxy returns 502/503 HTML.
      const getJSON = async (path, tries=3) => {
        for (let i=1;; i++) {
          try {
            const r = await fetch(`${API}${path}`, { headers:auth() });
            if (r.status >= 500 && i < tries) throw new Error(`HTTP ${r.status}`);
            const j = await r.json().catch(() => { throw new Error(`HTTP ${r.status} (non-JSON response)`); });
            if (!j.success) throw Object.assign(new Error(j.message || `HTTP ${r.status}`), { final:true });
            return j;
          } catch (e) {
            if (e.final || i >= tries) throw e;
            await new Promise(res => setTimeout(res, 2000*i));
          }
        }
      };
      const [d,n,p] = await Promise.allSettled([
        getJSON("/api/owner-desk"),
        getJSON("/api/owner-desk/notes"),
        getJSON("/api/owner-desk/payment-expected"),
      ]);
      if(d.status==="fulfilled") setData(d.value);
      if(n.status==="fulfilled") setNotes(n.value.notes||[]);
      if(p.status==="fulfilled") setPayExpected(p.value.entries||[]);
      const failed = [["Desk",d],["Notes",n],["Payments",p]].filter(([,r])=>r.status==="rejected");
      if(failed.length) {
        failed.forEach(([k,r]) => console.error(`[OwnerDesk] ${k} failed:`, r.reason));
        toast.error(`Failed to load ${failed.map(([k])=>k).join(", ")}: ${failed[0][1].reason?.message || "network error"}`);
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDone = id => setDone(prev => {
    const n=new Set(prev); n.has(id)?n.delete(id):n.add(id);
    saveDone(n); return n;
  });

  const saveNote = async () => {
    if(!noteText.trim()) return;
    setNoteSaving(true);
    try {
      const r = await fetch(`${API}/api/owner-desk/notes`,{
        method:"POST", headers:{...auth(),"Content-Type":"application/json"},
        body:JSON.stringify({text:noteText.trim(),date:todayStr()}),
      });
      const j = await r.json();
      if(!j.success) throw new Error(j.message);
      setNotes(p=>[j.note,...p]); setNoteText(""); noteRef.current?.focus();
    } catch(e) { toast.error(e.message||"Failed"); }
    finally { setNoteSaving(false); }
  };

  const deleteNote = async id => {
    await fetch(`${API}/api/owner-desk/notes/${id}`,{method:"DELETE",headers:auth()});
    setNotes(p=>p.filter(n=>n._id!==id));
  };
  const pinNote = async id => {
    const r = await fetch(`${API}/api/owner-desk/notes/${id}/pin`,{method:"PATCH",headers:auth()});
    const j = await r.json();
    if(j.success) setNotes(p=>p.map(n=>n._id===id?j.note:n).sort((a,b)=>b.pinned-a.pinned));
  };

  const searchLeads = q => {
    clearTimeout(leadSearchTimer.current);
    setLeadSearchQ(q);
    if(q.length < 2) { setLeadResults([]); return; }
    leadSearchTimer.current = setTimeout(async () => {
      const r = await fetch(`${API}/api/owner-desk/lead-search?q=${encodeURIComponent(q)}`,{headers:auth()});
      const j = await r.json();
      if(j.success) setLeadResults(j.leads||[]);
    }, 280);
  };

  const pickLead = lead => {
    setPayForm(f=>({...f, text: lead.name + (lead.business||lead.company ? ` — ${lead.business||lead.company}` : ""), leadId: lead._id, leadName: lead.name }));
    setLeadResults([]); setLeadSearchQ("");
  };

  const savePayExpected = async () => {
    if(!payForm.text.trim()||!payForm.amount||!payForm.expectedDate) {
      toast.error("Fill in all fields"); return;
    }
    setPaySaving(true);
    try {
      const r = await fetch(`${API}/api/owner-desk/notes`,{
        method:"POST", headers:{...auth(),"Content-Type":"application/json"},
        body:JSON.stringify({
          text:payForm.text.trim(), amount:Number(payForm.amount),
          expectedDate:payForm.expectedDate, type:"payment_expected",
          date:todayStr(), leadId: payForm.leadId||null, leadName: payForm.leadName||null,
        }),
      });
      const j = await r.json();
      if(!j.success) throw new Error(j.message);
      setPayExpected(p=>[j.note,...p]);
      setPayForm({text:"",amount:"",expectedDate:tomorrowStr(),leadId:"",leadName:""});
      setShowPayForm(false);
      toast.success("Payment commitment recorded!");
    } catch(e) { toast.error(e.message||"Failed"); }
    finally { setPaySaving(false); }
  };

  const markCollected = async id => {
    const r = await fetch(`${API}/api/owner-desk/notes/${id}/collect`,{method:"PATCH",headers:auth()});
    const j = await r.json();
    if(j.success) {
      setPayExpected(p=>p.map(e=>e._id===id?j.note:e));
      if(j.note.collected) {
        toast.success(j.leadUpdated ? "Collected & lead payment updated! 💰 Score will improve on Refresh." : "Marked as collected! 💰");
        if(j.leadUpdated) fetchData(true); // auto-refresh score
      }
    }
  };
  const deletePayEntry = async id => {
    await fetch(`${API}/api/owner-desk/notes/${id}`,{method:"DELETE",headers:auth()});
    setPayExpected(p=>p.filter(e=>e._id!==id));
  };

  if(loading) return (
    <div className="od-layout">
      <Sidebar/>
      <div className="od-loading"><RefreshCw size={26} className="od-spin" color="#6366f1"/><span>Generating your briefing…</span></div>
    </div>
  );

  const assignments = data?.assignments || [];
  const stats       = data?.quickStats  || {};
  const fin         = data?.financials  || {};
  const score       = data?.businessScore || 0;

  const visible   = showDone ? assignments : assignments.filter(a=>!done.has(a.id));
  const doneCount = assignments.filter(a=>done.has(a.id)).length;
  const total     = assignments.length;
  const pct       = total>0 ? Math.round((doneCount/total)*100) : 0;
  const critical  = visible.filter(a=>a.priority==="critical").length;

  const groups = ["critical","high","medium","low"]
    .map(p=>({p,items:visible.filter(a=>a.priority===p)}))
    .filter(g=>g.items.length>0);

  const scoreColor = score>=85?"#10b981":score>=65?"#6366f1":score>=45?"#f59e0b":"#ef4444";
  const urgencyLine = critical>0
    ? `You have ${critical} critical task${critical>1?"s":""} — clear them first.`
    : doneCount===total&&total>0
    ? "All done! You've cleared your briefing today 🎉"
    : `${total-doneCount} task${(total-doneCount)!==1?"s":""} remaining — let's get moving.`;

  const today = todayStr();
  const pendingPayExpected = payExpected.filter(e=>!e.collected);
  const overduePayExpected = pendingPayExpected.filter(e=>e.expectedDate<today);
  const totalExpected      = pendingPayExpected.reduce((s,e)=>s+(e.amount||0),0);

  return (
    <div className="od-layout">
      <Sidebar/>
      <div className="od-main">

        {/* ══ COMMAND HEADER ══ */}
        <div className="od-header">
          <div className="od-header-left">
            <div className="od-greeting">Good {greeting()}</div>
            <div className="od-urgency" style={{color:critical>0?"#ef4444":"rgba(255,255,255,.75)"}}>
              {urgencyLine}
            </div>
            <div className="od-meta">
              <span className="od-streak">🔥 {streak}-day streak</span>
              <span className="od-date">{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</span>
            </div>
          </div>
          <div className="od-header-right">
            <div className="od-score-explain">
              <div className="od-score-row"><span>💳 Collections</span><span style={{color:"#10b981"}}>{Math.min(30,Math.round(((fin.totalCollected||0)/(fin.totalDealValue||1))*30))}/30</span></div>
              <div className="od-score-row"><span>🤝 Conversion</span><span style={{color:"#6366f1"}}>{Math.min(20,Math.round(((stats.closedLeads||0)/(stats.totalLeads||1))*20))}/20</span></div>
              <div className="od-score-row"><span>📞 Follow-ups</span><span style={{color:"#f59e0b"}}>?/25</span></div>
              <div className="od-score-row"><span>⚡ Urgency clear</span><span style={{color:"#ef4444"}}>{Math.max(0,25-(stats.criticalCount||0)*5)}/25</span></div>
            </div>
            <div className="od-score-block">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="6"/>
                <circle cx="36" cy="36" r="28" fill="none" stroke={scoreColor} strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*28}`}
                  strokeDashoffset={`${2*Math.PI*28*(1-score/100)}`}
                  strokeLinecap="round" transform="rotate(-90 36 36)"
                  style={{transition:"stroke-dashoffset .8s"}}/>
              </svg>
              <div className="od-score-inner">
                <div className="od-score-n" style={{color:scoreColor}}>{score}</div>
                <div className="od-score-l">score</div>
              </div>
            </div>
            <div className="od-header-actions">
              <div className="od-progress-line">
                <div className="od-progress-bar"><div className="od-progress-fill" style={{width:`${pct}%`}}/></div>
                <span className="od-progress-txt">{doneCount}/{total} done</span>
              </div>
              <button className="od-refresh" onClick={()=>fetchData(true)} disabled={refreshing}>
                <RefreshCw size={13} className={refreshing?"od-spin":""}/> {refreshing?"…":"Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* ══ FINANCIALS STRIP ══ */}
        <div className="od-fin-strip">
          <FinCard label="Total Pipeline"  value={fmtL(fin.totalPipelineValue)} sub="Active deals" color="#6366f1" icon={<TrendingUp size={14}/>}/>
          <FinCard label="Total Deal Value" value={fmtL(fin.totalDealValue)}    sub="All-time contracts" color="#3b82f6" icon={<IndianRupee size={14}/>}/>
          <FinCard label="Collected"        value={fmtL(fin.totalCollected)}    sub={`${fin.collectionPct||0}% of total value`} color="#10b981" icon={<Check size={14}/>}/>
          <FinCard label="Yet to Collect"   value={fmtL(fin.totalPending)}      sub="Balance pending" color="#ef4444" icon={<AlertTriangle size={14}/>} alert/>
          {totalExpected>0 && (
            <FinCard label="Expected Soon"  value={fmtL(totalExpected)}         sub={`${pendingPayExpected.length} commitments`} color="#f59e0b" icon={<CreditCard size={14}/>}/>
          )}
        </div>

        {/* ══ BODY ══ */}
        <div className="od-body">

          {/* ── TASK LIST ── */}
          <div className="od-tasks">
            <div className="od-tasks-head">
              <div className="od-tasks-title">
                <Zap size={15} color="#f59e0b" fill="#f59e0b"/>
                Today's Assignments
                {visible.length>0 && <span className="od-tasks-count">{visible.length}</span>}
              </div>
              <button className="od-show-done-btn" onClick={()=>setShowDone(v=>!v)}>
                {showDone?"Hide completed":"Show completed"}
              </button>
            </div>

            {groups.length===0 ? (
              <div className="od-empty">
                <div className="od-empty-emoji">✅</div>
                <div className="od-empty-title">You're all clear!</div>
                <div className="od-empty-sub">No pending assignments. Take a moment to review your pipeline.</div>
                <button className="od-empty-btn" onClick={()=>navigate("/leads")}>Review Leads <ChevronRight size={13}/></button>
              </div>
            ) : groups.map(g=>(
              <div key={g.p} className="od-group">
                <div className="od-group-header" style={{color:P[g.p].color}}>
                  <span className="od-group-dot" style={{background:P[g.p].color}}/>
                  {P[g.p].label}
                  <span className="od-group-n">{g.items.length}</span>
                  <div className="od-group-line" style={{background:P[g.p].color+"30"}}/>
                </div>
                {g.items.map(a=>(
                  <TaskRow key={a.id} a={a} done={done.has(a.id)}
                    onCheck={()=>toggleDone(a.id)}
                    onView={()=>{setDrawerId(a.leadId);setDrawerOpen(true);}}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="od-diary">

            {/* Payment Expected Tracker */}
            <div className="od-pay-tracker">
              <div className="od-section-head">
                <CreditCard size={14} color="#f59e0b"/>
                <span>Payment Commitments</span>
                {overduePayExpected.length>0 && <span className="od-overdue-badge">{overduePayExpected.length} overdue</span>}
                <button className="od-add-pay-btn" onClick={()=>setShowPayForm(v=>!v)}>
                  {showPayForm ? <X size={13}/> : <Plus size={13}/>}
                </button>
              </div>

              {showPayForm && (
                <div className="od-pay-form">
                  {/* Lead search */}
                  <div className="od-lead-search-wrap">
                    <input className="od-pay-input" placeholder="🔍 Search & link a lead (optional)"
                      value={leadSearchQ} onChange={e=>searchLeads(e.target.value)}/>
                    {leadResults.length>0 && (
                      <div className="od-lead-drop">
                        {leadResults.map(l=>(
                          <div key={l._id} className="od-lead-drop-item" onClick={()=>pickLead(l)}>
                            <div className="od-lead-drop-name">{l.name}</div>
                            <div className="od-lead-drop-meta">{l.business||l.company||""} · Balance ₹{((((l.value||0)-(l.advanceReceived||0))/1000)).toFixed(1)}K</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input className="od-pay-input" placeholder="Label — e.g. Rohit, CND Play"
                    value={payForm.text} onChange={e=>setPayForm(f=>({...f,text:e.target.value}))}/>
                  {payForm.leadId && (
                    <div className="od-linked-lead">
                      ✅ Linked to lead: <strong>{payForm.leadName}</strong>
                      <button onClick={()=>setPayForm(f=>({...f,leadId:"",leadName:""}))}>×</button>
                    </div>
                  )}
                  <div className="od-pay-row">
                    <input className="od-pay-input" type="number" placeholder="₹ Amount"
                      value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))}/>
                    <input className="od-pay-input" type="date"
                      value={payForm.expectedDate} onChange={e=>setPayForm(f=>({...f,expectedDate:e.target.value}))}/>
                  </div>
                  {payForm.leadId && <div className="od-pay-tip">✨ Marking collected will auto-update the lead payment & improve your Health Score.</div>}
                  <button className="od-pay-save-btn" onClick={savePayExpected} disabled={paySaving}>
                    <Send size={12}/> {paySaving?"Saving…":"Record Commitment"}
                  </button>
                </div>
              )}

              <div className="od-pay-list">
                {payExpected.length===0 ? (
                  <div className="od-pay-empty">No payment commitments recorded.<br/>Use the + button to add one.</div>
                ) : payExpected.map(e=>{
                  const isOverdue = !e.collected && e.expectedDate < today;
                  const isToday   = e.expectedDate === today;
                  return (
                    <div key={e._id} className={`od-pay-entry ${e.collected?"od-pay-done":""} ${isOverdue?"od-pay-overdue":""}`}>
                      <div className="od-pay-entry-left">
                        <button className="od-pay-check" onClick={()=>markCollected(e._id)}>
                          {e.collected ? <CheckCircle2 size={16} color="#22c55e"/> : <Circle size={16} color="#d1d5db"/>}
                        </button>
                        <div>
                          <div className="od-pay-name">{e.text}</div>
                          <div className="od-pay-date">
                            {isOverdue ? `⚠ Overdue since ` : isToday ? "📅 Today — " : ""}
                            {new Date(e.expectedDate+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
                          </div>
                        </div>
                      </div>
                      <div className="od-pay-entry-right">
                        <div className="od-pay-amt" style={{color:isOverdue?"#ef4444":isToday?"#f59e0b":"#0f172a"}}>
                          {fmtL(e.amount)}
                        </div>
                        <button className="od-pay-del" onClick={()=>deletePayEntry(e._id)}><Trash2 size={10}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Notes */}
            <div className="od-diary-card">
              <div className="od-diary-title">
                <BookOpen size={14} color="#6366f1"/> Daily Notes
                <span className="od-diary-dt">{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</span>
              </div>
              <textarea ref={noteRef} className="od-diary-ta"
                placeholder="Note something down… meetings, ideas, decisions"
                value={noteText} onChange={e=>setNoteText(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))saveNote();}} rows={3}/>
              <button className="od-diary-btn" onClick={saveNote} disabled={noteSaving||!noteText.trim()}>
                <Send size={12}/> {noteSaving?"Saving…":"Save Note"}
              </button>
              <div className="od-notes">
                {notes.length===0
                  ? <div className="od-notes-empty">Nothing noted yet today.</div>
                  : notes.map(n=>(
                    <div key={n._id} className={`od-note ${n.pinned?"od-note-pinned":""}`}>
                      <p className="od-note-text">{n.text}</p>
                      <div className="od-note-btns">
                        <button onClick={()=>pinNote(n._id)} className={`od-nbtn ${n.pinned?"pinned":""}`}><Pin size={10}/></button>
                        <button onClick={()=>deleteNote(n._id)} className="od-nbtnd"><Trash2 size={10}/></button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <LeadDrawer open={drawerOpen} leadId={drawerId} apiBase={API}
        onClose={()=>{setDrawerOpen(false);setDrawerId(null);}}
        onLeadUpdated={()=>fetchData(true)}
      />
    </div>
  );
}

function TaskRow({ a, done, onCheck, onView }) {
  const p=P[a.priority]||P.medium, t=T[a.type]||T.followup;
  return (
    <div className={`od-task ${done?"od-task-done":""}`} style={{"--pb":p.bar}}>
      <div className="od-task-bar"/>
      <button className="od-task-check" onClick={onCheck}>
        {done?<CheckCircle2 size={18} color="#22c55e"/>:<Circle size={18} color="#cbd5e1"/>}
      </button>
      <div className="od-task-body">
        <div className="od-task-type" style={{color:p.color}}>{t.icon} {t.label}</div>
        <div className="od-task-title">{a.title}</div>
        <div className="od-task-sub">{a.subtitle}</div>
      </div>
      <div className="od-task-acts">
        {a.phone && <a href={`tel:${a.phone}`} className="od-call-btn" onClick={e=>e.stopPropagation()}><Phone size={12}/></a>}
        <button className="od-view-btn" onClick={onView}>Open <ChevronRight size={11}/></button>
      </div>
    </div>
  );
}

function FinCard({ label, value, sub, color, icon, alert }) {
  return (
    <div className={`od-fin-card ${alert?"od-fin-alert":""}`} style={{"--fc":color}}>
      <div className="od-fin-icon" style={{color,background:color+"18"}}>{icon}</div>
      <div>
        <div className="od-fin-value" style={{color}}>{value}</div>
        <div className="od-fin-label">{label}</div>
        <div className="od-fin-sub">{sub}</div>
      </div>
    </div>
  );
}
