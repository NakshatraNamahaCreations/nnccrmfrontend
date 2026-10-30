import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Search, Trash2,
  CreditCard, Phone, Monitor, MessageCircle, CalendarDays,
  User, Building2, ExternalLink, Clock, MessageSquare,
} from "lucide-react";
import Sidebar from "../components/Sidebar/Sidebar";
import LeadDrawer from "../Leads/LeadDrawer";
import { toast } from "../utils/toast";
import "./CalendarPage.css";

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";

const TABS = [
  { key: "payment_followup",  label: "Payment Follow-up",   color: "#ef4444", bg: "#fef2f2", icon: CreditCard    },
  { key: "call_followup",     label: "Call / Meeting",      color: "#3b82f6", bg: "#eff6ff", icon: Phone         },
  { key: "demo",              label: "Next Demo",           color: "#8b5cf6", bg: "#f5f3ff", icon: Monitor       },
  { key: "client_response",   label: "Client Response",     color: "#f59e0b", bg: "#fffbeb", icon: MessageCircle },
  { key: "enquiry_followup",  label: "Enquiry Follow-ups",  color: "#7c3aed", bg: "#ede9fe", icon: MessageSquare },
];

const ENQ_FOLLOWUP_TYPES = [
  { key: "call",    label: "📞 Call Client" },
  { key: "meet",    label: "🤝 Meet Client" },
  { key: "finalise",label: "✅ Finalise Deal" },
];

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function authHeader() {
  const t = localStorage.getItem("nnc_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function handle401(res) {
  if (res.status === 401) {
    localStorage.removeItem("nnc_token");
    localStorage.removeItem("nnc_auth");
    localStorage.removeItem("nnc_user");
    window.location.href = "/";
    throw new Error("Session expired. Please log in again.");
  }
  return res;
}

function fmtMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function toInputDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  leadId: "", leadName: "", leadPhone: "",
  enquiryId: "", enquiryName: "", enquiryPhone: "", enquiryCompany: "",
  followupType: "call",
  date: "", title: "", notes: "",
};

export default function CalendarPage() {
  const today = new Date();
  const todayDay   = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear  = today.getFullYear();

  const [activeTab,     setActiveTab]     = useState("payment_followup");
  const [currentYear,   setCurrentYear]   = useState(todayYear);
  const [currentMonth,  setCurrentMonth]  = useState(todayMonth);
  const [events,        setEvents]        = useState({});   // { day: [event,...] }
  const [loading,       setLoading]       = useState(false);
  const [selectedDay,   setSelectedDay]   = useState(null);
  const [tabCounts,     setTabCounts]     = useState({});

  /* Add-event modal */
  const [addOpen,      setAddOpen]      = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [leadSearch,   setLeadSearch]   = useState("");
  const [leadResults,  setLeadResults]  = useState([]);
  const [searching,    setSearching]    = useState(false);
  const searchTimer = useRef(null);

  /* Enquiry search */
  const [enqSearch,    setEnqSearch]    = useState("");
  const [enqResults,   setEnqResults]   = useState([]);
  const [searchingEnq, setSearchingEnq] = useState(false);
  const enqSearchTimer = useRef(null);

  /* Lead drawer */
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [drawerLeadId,   setDrawerLeadId]   = useState(null);

  const isEnqTab = activeTab === "enquiry_followup";

  const activeTabData = TABS.find(t => t.key === activeTab) || TABS[0];

  /* ── Fetch events ───────────────────────────────────────────── */
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(
        `${API_BASE}/api/calendar-events?year=${currentYear}&month=${currentMonth + 1}&type=${activeTab}`,
        { headers: authHeader() }
      ).then(handle401);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load events");
      setEvents(json.data || {});
    } catch (e) {
      toast.error(e.message || "Failed to load calendar");
      setEvents({});
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentYear, currentMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  /* ── Fetch counts for all tabs (for badges) ─────────────────── */
  const fetchAllCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        TABS.map(tab =>
          fetch(
            `${API_BASE}/api/calendar-events?year=${currentYear}&month=${currentMonth + 1}&type=${tab.key}`,
            { headers: authHeader() }
          )
            .then(r => r.json())
            .then(j => ({
              key:   tab.key,
              count: j.success
                ? Object.values(j.data || {}).reduce((s, arr) => s + arr.length, 0)
                : 0,
            }))
            .catch(() => ({ key: tab.key, count: 0 }))
        )
      );
      const counts = {};
      results.forEach(r => { counts[r.key] = r.count; });
      setTabCounts(counts);
    } catch {}
  }, [currentYear, currentMonth]);

  useEffect(() => { fetchAllCounts(); }, [fetchAllCounts]);

  /* ── Lead search (debounced) ────────────────────────────────── */
  useEffect(() => {
    if (!leadSearch.trim()) { setLeadResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        setSearching(true);
        const res  = await fetch(
          `${API_BASE}/api/leads?search=${encodeURIComponent(leadSearch.trim())}&limit=8`,
          { headers: authHeader() }
        ).then(handle401);
        const json = await res.json();
        const arr  = Array.isArray(json.data) ? json.data
                   : Array.isArray(json.leads) ? json.leads : [];
        setLeadResults(arr);
      } catch { setLeadResults([]); }
      finally  { setSearching(false); }
    }, 300);
  }, [leadSearch]);

  /* ── Enquiry search (debounced) ─────────────────────────────── */
  useEffect(() => {
    if (!enqSearch.trim()) { setEnqResults([]); return; }
    clearTimeout(enqSearchTimer.current);
    enqSearchTimer.current = setTimeout(async () => {
      try {
        setSearchingEnq(true);
        const res  = await fetch(
          `${API_BASE}/api/enquiries?q=${encodeURIComponent(enqSearch.trim())}&limit=8&includeConverted=true`,
          { headers: authHeader() }
        ).then(handle401);
        const json = await res.json();
        setEnqResults(Array.isArray(json.data) ? json.data : []);
      } catch { setEnqResults([]); }
      finally  { setSearchingEnq(false); }
    }, 300);
  }, [enqSearch]);

  /* ── Create event ───────────────────────────────────────────── */
  const handleCreate = async () => {
    if (isEnqTab && !form.enquiryId) { toast.warning("Select an enquiry"); return; }
    if (!isEnqTab && !form.leadId)   { toast.warning("Select a client");   return; }
    if (!form.date) { toast.warning("Pick a date"); return; }
    try {
      setSaving(true);
      const payload = isEnqTab
        ? {
            enquiryId: form.enquiryId,
            type:  activeTab,
            date:  form.date,
            title: ENQ_FOLLOWUP_TYPES.find(t => t.key === form.followupType)?.label || form.followupType,
            notes: form.notes,
          }
        : {
            leadId: form.leadId,
            type:   activeTab,
            date:   form.date,
            title:  form.title,
            notes:  form.notes,
          };
      const res  = await fetch(`${API_BASE}/api/calendar-events`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body:    JSON.stringify(payload),
      }).then(handle401);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      toast.success("Event scheduled");
      setAddOpen(false);
      setForm(EMPTY_FORM);
      setLeadSearch(""); setLeadResults([]);
      setEnqSearch("");  setEnqResults([]);
      await Promise.all([fetchEvents(), fetchAllCounts()]);
    } catch (e) {
      toast.error(e.message || "Failed to schedule event");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete event ───────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this event?")) return;
    try {
      const res  = await fetch(`${API_BASE}/api/calendar-events/${id}`, {
        method: "DELETE", headers: authHeader(),
      }).then(handle401);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete");
      toast.success("Event removed");
      await Promise.all([fetchEvents(), fetchAllCounts()]);
    } catch (e) {
      toast.error(e.message || "Failed to delete event");
    }
  };

  /* ── Calendar grid ──────────────────────────────────────────── */
  const calendarGrid = useMemo(() => {
    const firstDay  = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push({ blank: true, key: `b${i}` });
    for (let d = 1; d <= totalDays; d++) cells.push({
      blank: false, key: `d${d}`, day: d,
      evs: events[d] || [],
      isToday: d === todayDay && currentMonth === todayMonth && currentYear === todayYear,
    });
    while (cells.length % 7 !== 0) cells.push({ blank: true, key: `t${cells.length}` });
    return cells;
  }, [currentYear, currentMonth, events, todayDay, todayMonth, todayYear]);

  const goPrev = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const goNext = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const openAdd = (day = null) => {
    setForm({ ...EMPTY_FORM, date: day ? toInputDate(new Date(currentYear, currentMonth, day)) : "" });
    setLeadSearch(""); setLeadResults([]);
    setEnqSearch("");  setEnqResults([]);
    setAddOpen(true);
  };

  const selectedDayEvents = selectedDay ? (events[selectedDay] || []) : [];
  const totalEvents = Object.values(events).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="calLayout">
      <Sidebar />

      <div className="calMain">
        {/* ── Topbar ── */}
        <div className="calTopbar">
          <div className="calTopLeft">
            <CalendarDays size={20} className="calTopIcon"/>
            <h1 className="calTitle">Calendar</h1>
            <span className="calMonthPill">{fmtMonthYear(currentYear, currentMonth)}</span>
          </div>
          <div className="calTopRight">
            <button className="calAddBtn" onClick={() => openAdd()}>
              <Plus size={15}/> Schedule
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="calTabs">
          {TABS.map(tab => {
            const Icon  = tab.icon;
            const count = tabCounts[tab.key] ?? (activeTab === tab.key ? totalEvents : 0);
            return (
              <button
                key={tab.key}
                className={`calTab ${activeTab === tab.key ? "active" : ""}`}
                style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color, background: tab.bg } : {}}
                onClick={() => { setActiveTab(tab.key); setSelectedDay(null); }}
              >
                <Icon size={15}/>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className="calTabBadge" style={{ background: tab.color }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="calBody">

          {/* Calendar grid */}
          <div className="calBoardWrap">
            <div className="calMonthNav">
              <button className="calNavBtn" onClick={goPrev}><ChevronLeft size={16}/></button>
              <span className="calMonthLabel">{fmtMonthYear(currentYear, currentMonth)}</span>
              <button className="calNavBtn" onClick={goNext}><ChevronRight size={16}/></button>
              <button className="calTodayBtn" onClick={() => { setCurrentYear(todayYear); setCurrentMonth(todayMonth); }}>
                Today
              </button>
            </div>

            {loading && <div className="calLoading">Loading…</div>}

            <div className="calWeekRow">
              {WEEK.map(w => <div key={w} className="calWeekCell">{w}</div>)}
            </div>

            <div className="calGrid">
              {calendarGrid.map(cell => {
                if (cell.blank) return <div key={cell.key} className="calCell blank"/>;
                const isSelected = selectedDay === cell.day;
                return (
                  <div
                    key={cell.key}
                    className={`calCell ${cell.isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${cell.evs.length ? "hasEvents" : ""}`}
                    onClick={() => setSelectedDay(isSelected ? null : cell.day)}
                  >
                    <div className="calCellDate">{cell.day}</div>
                    {cell.evs.length > 0 && (
                      <div className="calCellEvents">
                        {cell.evs.slice(0, 3).map(ev => (
                          <div
                            key={ev._id}
                            className="calEventChip"
                            style={{ background: activeTabData.bg, color: activeTabData.color, borderColor: activeTabData.color + "44" }}
                            title={ev.leadName}
                          >
                            {ev.title ? `${ev.title.split(" ")[0]} · ` : ""}{ev.leadName}
                          </div>
                        ))}
                        {cell.evs.length > 3 && (
                          <div className="calEventMore" style={{ color: activeTabData.color }}>
                            +{cell.evs.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                    {cell.evs.length === 0 && (
                      <button
                        className="calCellAdd"
                        title="Schedule event"
                        onClick={e => { e.stopPropagation(); openAdd(cell.day); }}
                      >
                        <Plus size={10}/>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel */}
          <div className={`calDayPanel ${selectedDay ? "open" : ""}`}>
            {selectedDay ? (
              <>
                <div className="calDayPanelHead">
                  <div>
                    <div className="calDayPanelDate">
                      {fmtDate(new Date(currentYear, currentMonth, selectedDay))}
                    </div>
                    <div className="calDayPanelSub" style={{ color: activeTabData.color }}>
                      {activeTabData.label} · {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="calDayPanelActions">
                    <button
                      className="calDayAddBtn"
                      style={{ background: activeTabData.color }}
                      onClick={() => openAdd(selectedDay)}
                    >
                      <Plus size={13}/> Add
                    </button>
                    <button className="calDayClose" onClick={() => setSelectedDay(null)}>
                      <X size={15}/>
                    </button>
                  </div>
                </div>

                <div className="calDayEvents">
                  {selectedDayEvents.length === 0 ? (
                    <div className="calDayEmpty">
                      <CalendarDays size={32} style={{ color: "#cbd5e1", marginBottom: 10 }}/>
                      <div>No events on this day</div>
                      <button
                        className="calDayEmptyBtn"
                        style={{ background: activeTabData.color }}
                        onClick={() => openAdd(selectedDay)}
                      >
                        <Plus size={13}/> Schedule one
                      </button>
                    </div>
                  ) : (
                    selectedDayEvents.map(ev => (
                      <div
                        key={ev._id}
                        className="calEventCard"
                        style={{ borderLeftColor: activeTabData.color }}
                      >
                        <div className="calEventCardHead">
                          <div className="calEventClientName">{ev.leadName || "—"}</div>
                          <button
                            className="calEventDelete"
                            onClick={() => handleDelete(ev._id)}
                            title="Remove event"
                          >
                            <Trash2 size={12}/>
                          </button>
                        </div>

                        <div className="calEventMeta">
                          {ev.leadPhone && (
                            <span className="calEventMetaItem">
                              <Phone size={11}/> {ev.leadPhone}
                            </span>
                          )}
                          {ev.leadBusiness && (
                            <span className="calEventMetaItem">
                              <Building2 size={11}/> {ev.leadBusiness}
                            </span>
                          )}
                          {ev.leadStage && !isEnqTab && (
                            <span
                              className="calEventStagePill"
                              style={{ background: activeTabData.bg, color: activeTabData.color }}
                            >
                              {ev.leadStage}
                            </span>
                          )}
                        </div>

                        {ev.title && (
                          <div
                            className="calEventTitle"
                            style={isEnqTab ? { background: activeTabData.bg, color: activeTabData.color, borderRadius: 6, padding: "3px 8px", display: "inline-block", fontWeight: 700, fontSize: 12 } : {}}
                          >
                            {ev.title}
                          </div>
                        )}
                        {ev.notes && (
                          <div className="calEventNotes">{ev.notes}</div>
                        )}

                        <div className="calEventCardFoot">
                          <span className="calEventTime">
                            <Clock size={11}/> {fmtDate(ev.date)}
                          </span>
                          {!isEnqTab && ev.leadId && (
                            <button
                              className="calEventViewBtn"
                              style={{ color: activeTabData.color }}
                              onClick={() => { setDrawerLeadId(ev.leadId); setDrawerOpen(true); }}
                            >
                              <ExternalLink size={12}/> Full Details
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="calPanelDefault">
                <div
                  className="calPanelDefaultIcon"
                  style={{ background: activeTabData.bg, color: activeTabData.color }}
                >
                  {(() => { const Icon = activeTabData.icon; return <Icon size={28}/>; })()}
                </div>
                <div className="calPanelDefaultTitle">{activeTabData.label}</div>
                <div className="calPanelDefaultSub">
                  Click on any date to view or add events
                </div>
                <div className="calPanelSummary">
                  <div className="calPanelSummaryVal" style={{ color: activeTabData.color }}>{totalEvents}</div>
                  <div className="calPanelSummarySub">events this month</div>
                </div>
              </div>
            )}
          </div>

        </div>{/* end calBody */}
      </div>

      {/* ── Add Event Modal ── */}
      {addOpen && (
        <div className="calModalOverlay" onClick={() => setAddOpen(false)}>
          <div className="calModalCard" onClick={e => e.stopPropagation()}>
            <div className="calModalHead" style={{ borderBottomColor: activeTabData.color + "33" }}>
              <div className="calModalHeadLeft">
                <div className="calModalTypeIcon" style={{ background: activeTabData.bg, color: activeTabData.color }}>
                  {(() => { const Icon = activeTabData.icon; return <Icon size={16}/>; })()}
                </div>
                <div>
                  <div className="calModalTitle">Schedule Event</div>
                  <div className="calModalSub" style={{ color: activeTabData.color }}>{activeTabData.label}</div>
                </div>
              </div>
              <button className="calModalClose" onClick={() => setAddOpen(false)}><X size={16}/></button>
            </div>

            <div className="calModalBody">
              {isEnqTab ? (
                <>
                  {/* Enquiry Follow-up Type */}
                  <div className="calModalField">
                    <label>Follow-up Action <span style={{ color: "#ef4444" }}>*</span></label>
                    <div className="calFollowupTypes">
                      {ENQ_FOLLOWUP_TYPES.map(ft => (
                        <button
                          key={ft.key}
                          type="button"
                          className={`calFollowupTypeBtn${form.followupType === ft.key ? " active" : ""}`}
                          style={form.followupType === ft.key ? { borderColor: activeTabData.color, background: activeTabData.bg, color: activeTabData.color } : {}}
                          onClick={() => setForm(p => ({ ...p, followupType: ft.key }))}
                        >
                          {ft.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Enquiry search */}
                  <div className="calModalField">
                    <label>Enquiry / Client <span style={{ color: "#ef4444" }}>*</span></label>
                    {form.enquiryId ? (
                      <div className="calSelectedLead" style={{ borderColor: activeTabData.color }}>
                        <div className="calSelectedLeadInfo">
                          <User size={14} style={{ color: activeTabData.color }}/>
                          <div>
                            <div className="calSelectedLeadName">{form.enquiryName}</div>
                            <div className="calSelectedLeadSub">{form.enquiryPhone}{form.enquiryCompany ? ` · ${form.enquiryCompany}` : ""}</div>
                          </div>
                        </div>
                        <button
                          className="calSelectedLeadClear"
                          onClick={() => { setForm(p => ({ ...p, enquiryId: "", enquiryName: "", enquiryPhone: "", enquiryCompany: "" })); setEnqSearch(""); }}
                        >
                          <X size={13}/>
                        </button>
                      </div>
                    ) : (
                      <div className="calLeadSearchWrap">
                        <Search size={14} className="calLeadSearchIcon"/>
                        <input
                          className="calLeadSearchInput"
                          placeholder="Search enquiry by name, phone, company…"
                          value={enqSearch}
                          onChange={e => setEnqSearch(e.target.value)}
                          autoFocus
                        />
                        {searchingEnq && <span className="calLeadSearchSpin">…</span>}
                      </div>
                    )}
                    {!form.enquiryId && enqSearch.trim().length > 0 && !searchingEnq && enqResults.length === 0 && (
                      <div className="calLeadDropdown">
                        <div className="calLeadNoResults" style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                          No enquiries found for "{enqSearch.trim()}"
                        </div>
                      </div>
                    )}
                    {enqResults.length > 0 && !form.enquiryId && (
                      <div className="calLeadDropdown">
                        {enqResults.map(enq => (
                          <button
                            key={enq._id}
                            className="calLeadOption"
                            onClick={() => {
                              setForm(p => ({
                                ...p,
                                enquiryId:      enq._id,
                                enquiryName:    enq.name    || "",
                                enquiryPhone:   enq.phone   || "",
                                enquiryCompany: enq.company || "",
                              }));
                              setEnqResults([]);
                              setEnqSearch("");
                            }}
                          >
                            <div className="calLeadOptionName">{enq.name}</div>
                            <div className="calLeadOptionMeta">
                              {enq.phone || ""}{enq.company ? ` · ${enq.company}` : ""}
                              {enq.status ? <span className="calLeadOptionStage">{enq.status}</span> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Lead search (existing tabs) */
                <div className="calModalField">
                  <label>Client <span style={{ color: "#ef4444" }}>*</span></label>
                  {form.leadId ? (
                    <div className="calSelectedLead" style={{ borderColor: activeTabData.color }}>
                      <div className="calSelectedLeadInfo">
                        <User size={14} style={{ color: activeTabData.color }}/>
                        <div>
                          <div className="calSelectedLeadName">{form.leadName}</div>
                          <div className="calSelectedLeadSub">{form.leadPhone}</div>
                        </div>
                      </div>
                      <button
                        className="calSelectedLeadClear"
                        onClick={() => { setForm(p => ({ ...p, leadId: "", leadName: "", leadPhone: "" })); setLeadSearch(""); }}
                      >
                        <X size={13}/>
                      </button>
                    </div>
                  ) : (
                    <div className="calLeadSearchWrap">
                      <Search size={14} className="calLeadSearchIcon"/>
                      <input
                        className="calLeadSearchInput"
                        placeholder="Search by name, phone, company…"
                        value={leadSearch}
                        onChange={e => setLeadSearch(e.target.value)}
                        autoFocus
                      />
                      {searching && <span className="calLeadSearchSpin">…</span>}
                    </div>
                  )}
                  {!form.leadId && leadSearch.trim().length > 0 && !searching && leadResults.length === 0 && (
                    <div className="calLeadDropdown">
                      <div className="calLeadNoResults" style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                        No clients found for "{leadSearch.trim()}"
                      </div>
                    </div>
                  )}
                  {leadResults.length > 0 && !form.leadId && (
                    <div className="calLeadDropdown">
                      {leadResults.map(lead => (
                        <button
                          key={lead._id}
                          className="calLeadOption"
                          onClick={() => {
                            setForm(p => ({
                              ...p,
                              leadId:    lead._id,
                              leadName:  lead.name || "",
                              leadPhone: lead.phone || lead.mobile || "",
                            }));
                            setLeadResults([]);
                            setLeadSearch("");
                          }}
                        >
                          <div className="calLeadOptionName">{lead.name}</div>
                          <div className="calLeadOptionMeta">
                            {lead.phone || lead.mobile || ""}{lead.business ? ` · ${lead.business}` : ""}
                            {lead.stage ? <span className="calLeadOptionStage">{lead.stage}</span> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Date */}
              <div className="calModalField">
                <label>Date <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  type="date"
                  className="calModalInput"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>

              {/* Title (only for non-enquiry tabs) */}
              {!isEnqTab && (
                <div className="calModalField">
                  <label>Title <span className="calModalOptional">(optional)</span></label>
                  <input
                    type="text"
                    className="calModalInput"
                    placeholder="e.g. Remind about 2nd installment"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  />
                </div>
              )}

              {/* Notes */}
              <div className="calModalField">
                <label>Notes <span className="calModalOptional">(optional)</span></label>
                <textarea
                  className="calModalTextarea"
                  placeholder="Add any notes or context…"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="calModalFoot">
              <button className="calModalCancelBtn" onClick={() => setAddOpen(false)}>Cancel</button>
              <button
                className="calModalSaveBtn"
                style={{ background: activeTabData.color }}
                disabled={saving || (!isEnqTab && !form.leadId) || (isEnqTab && !form.enquiryId) || !form.date}
                onClick={handleCreate}
              >
                {saving ? "Saving…" : "Schedule Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Drawer */}
      <LeadDrawer
        open={drawerOpen}
        leadId={drawerLeadId}
        apiBase={API_BASE}
        onClose={() => { setDrawerOpen(false); setDrawerLeadId(null); }}
      />
    </div>
  );
}
