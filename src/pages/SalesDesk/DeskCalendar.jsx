import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "../../utils/toast";
import { billingApi } from "../ProjectBilling/billingMeta";
import { DAY, startOfDay, daysFrom, ymd, fds, fdw, ampm, toMin } from "./deskData";

const MODE = { meet: "Google Meet", office: "Office", phone: "Phone" };
const TYPE_LABEL = { demo: "Meeting", payment_followup: "Payment follow-up", call_followup: "Follow-up", client_response: "Client asked", enquiry_followup: "Enquiry follow-up" };
const OUTCOMES = ["", "Interested, send proposal", "Proposal agreed", "Go-live agreed", "Payment promised", "Follow-up needed", "Not interested"];
const H0 = 9, H1 = 20, PX = 60;

const isMeeting = (e) => e.type === "demo" || !!e.time;
const active = (e) => !e.status || e.status === "scheduled" || e.status === "done";

function weekStart(off) {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
}

export default function CalendarView({ events, clients, onOpen, onNew }) {
  const [week, setWeek] = useState(0);
  const ws = weekStart(week);
  const days = Array.from({ length: 7 }, (_, i) => ymd(ws.getTime() + i * DAY));
  const byId = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const nameOf = (e) => byId.get(String(e.leadId || ""))?.name || byId.get(String(e.enquiryId || ""))?.name || e.leadName || e.title || "Entry";
  const onDay = (d) => events.filter(e => ymd(e.date) === d && e.status !== "cancelled");

  const meetings = events.filter(e => isMeeting(e) && e.status !== "cancelled");
  const today = meetings.filter(m => daysFrom(m.date) === 0).sort((a, b) => toMin(a.time) - toMin(b.time));
  const upcoming = meetings.filter(m => daysFrom(m.date) > 0 && daysFrom(m.date) <= 7 && (!m.status || m.status === "scheduled"))
    .sort((a, b) => new Date(a.date) - new Date(b.date) || toMin(a.time) - toMin(b.time));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const needSummary = meetings.filter(m => !m.summary && m.status !== "noshow" &&
    (daysFrom(m.date) < 0 || (daysFrom(m.date) === 0 && m.time && toMin(m.time) + (m.duration || 30) < nowMin)));
  const nowTop = (new Date().getHours() + new Date().getMinutes() / 60 - H0) * PX;

  return (
    <>
      <h1 className="sd-h1">Calendar<span>.</span></h1>
      <p className="sd-lead"><b>{today.length} meeting{today.length === 1 ? "" : "s"} today</b>, {upcoming.length} more this week. Follow-ups from the CRM calendar show at the top of each day.</p>
      <div className="sd-calbar">
        <button type="button" className="sd-btn sm" onClick={() => setWeek(w => w - 1)} aria-label="Previous week">‹</button>
        <button type="button" className="sd-btn sm" onClick={() => setWeek(0)}>This week</button>
        <button type="button" className="sd-btn sm" onClick={() => setWeek(w => w + 1)} aria-label="Next week">›</button>
        <b className="sd-calrange">{fds(days[0])} to {fds(days[6])}</b>
        <span style={{ flex: 1 }} />
        <button type="button" className="sd-btn main" onClick={onNew}>+ Schedule meeting</button>
      </div>
      <div className="sd-calwrap">
        <div className="sd-grid">
          <div className="gh"><div />{days.map(d => (
            <div key={d} className={d === ymd(new Date()) ? "td" : ""}>{new Date(d).toLocaleDateString("en-IN", { weekday: "short" })}<b>{new Date(d).getDate()}</b></div>
          ))}</div>
          <div className="gad"><div className="lbl">All day</div>{days.map(d => (
            <div key={d}>{onDay(d).filter(e => !e.time).map(e => (
              <button key={e._id} type="button" className={`adv ${e.type}${e.done ? " done" : ""}`} onClick={() => onOpen(e)} title={`${TYPE_LABEL[e.type] || e.type}: ${nameOf(e)}`}>
                {nameOf(e)}
              </button>
            ))}</div>
          ))}</div>
          <div className="gb">
            <div className="hrs">{Array.from({ length: H1 - H0 }, (_, i) => <div key={i}>{ampm(`${H0 + i}:00`)}</div>)}</div>
            {days.map(d => (
              <div key={d} className={`dcol${new Date(d).getDay() === 0 ? " off" : ""}`} style={{ height: (H1 - H0) * PX }}>
                {onDay(d).filter(e => e.time).map(e => {
                  const top = (toMin(e.time) / 60 - H0) * PX;
                  const h = Math.max(22, ((e.duration || 30) / 60) * PX - 2);
                  return (
                    <button key={e._id} type="button" className={`ev ${e.mode || "meet"} ${e.status || "scheduled"}`} style={{ top: Math.max(0, top), height: h }}
                      onClick={() => onOpen(e)} title={`${nameOf(e)}, ${ampm(e.time)}`}>
                      <b>{h < 40 ? `${ampm(e.time)} · ` : ""}{nameOf(e)}</b>
                      {h >= 40 && <span>{ampm(e.time)} · {MODE[e.mode] || "Meeting"}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
            {week === 0 && nowTop > 0 && nowTop < (H1 - H0) * PX && <div className="nowl" style={{ top: nowTop }} />}
          </div>
        </div>

        <div className="sd-side2">
          {needSummary.length > 0 && (
            <div className="sd-ag"><h3>Add meeting summary · {needSummary.length}</h3>
              {needSummary.slice(0, 5).map(m => (
                <button key={m._id} type="button" className="agi" onClick={() => onOpen(m)}>
                  <span className="tm">{fds(m.date)}</span><span><b>{nameOf(m)}</b><small>{m.title}</small></span>
                </button>
              ))}
            </div>
          )}
          <div className="sd-ag"><h3>Today</h3>
            {today.map(m => (
              <button key={m._id} type="button" className="agi" onClick={() => onOpen(m)}>
                <span className="tm">{ampm(m.time)}</span><span><b>{nameOf(m)}</b><small>{MODE[m.mode] || "Meeting"} · {m.duration || 30} min · {m.title}</small></span>
              </button>
            ))}
            {!today.length && <div className="agi"><small>No meetings today.</small></div>}
          </div>
          <div className="sd-ag"><h3>Next 7 days</h3>
            {upcoming.slice(0, 8).map(m => (
              <button key={m._id} type="button" className="agi" onClick={() => onOpen(m)}>
                <span className="tm">{fds(m.date)}<small>{ampm(m.time)}</small></span><span><b>{nameOf(m)}</b><small>{MODE[m.mode] || "Meeting"} · {m.title}</small></span>
              </button>
            ))}
            {!upcoming.length && <div className="agi"><small>Nothing scheduled.</small></div>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────── Schedule / edit a meeting (CRM calendar entry) ───────── */
const kindOf = (c) => (c.src === "enq" ? "Enquiry" : c.completed ? "Completed project" : c.group === "project" ? "Project" : "Lead");

export function MeetingModal({ ev, presetClientId, clients, onClose, onSaved, onShare }) {
  const isNew = !ev;
  const [clientId, setClientId] = useState(ev ? String(ev.leadId || ev.enquiryId || "") : (presetClientId || ""));
  const [find, setFind] = useState("");
  const [f, setF] = useState(() => ({
    date: ev ? ymd(ev.date) : ymd(Date.now() + DAY),
    time: ev ? (ev.time || "") : "11:00",
    duration: ev?.duration || 30,
    mode: ev ? (ev.mode || "") : "meet",
    title: ev?.title || "",
    email: ev?.email || "",
    link: ev?.link || "",
    summary: ev?.summary || "",
    outcome: ev?.outcome || "",
    next: "",
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const client = clients.find(c => c.id === clientId) || null;
  const options = useMemo(() => {
    const s = find.trim().toLowerCase();
    const L = clients.filter(c => c.src !== "event" && (!s || [c.name, c.company, c.phone, c.project].some(v => String(v || "").toLowerCase().includes(s))));
    return L.slice(0, 200);
  }, [clients, find]);
  // Picking a client also fills in their email if it is still empty
  const pickClient = (c) => { setClientId(c.id); if (c.email) setF(s => (s.email ? s : { ...s, email: c.email })); };

  const body = () => ({
    date: f.date, time: f.time, duration: Number(f.duration) || 30, mode: f.mode, title: f.title.trim(),
    email: f.email.trim(), link: f.link.trim(), summary: f.summary.trim(), outcome: f.outcome,
  });

  const save = async (e) => {
    e.preventDefault();
    if (isNew && !client) { toast.error("Pick a client"); return; }
    if (!f.title.trim()) { toast.error("Add an agenda"); return; }
    setBusy(true);
    try {
      let saved;
      if (isNew) {
        const json = await billingApi("/calendar-events", { method: "POST", body: {
          ...(client.src === "lead" ? { leadId: client.id } : { enquiryId: client.id }), type: "demo", ...body(),
        } });
        saved = json.data;
        toast.success(`Scheduled for ${fdw(f.date)}${f.time ? `, ${ampm(f.time)}` : ""}`);
      } else {
        const b = body();
        const moved = ymd(ev.date) !== f.date || (ev.time || "") !== f.time;
        // A summary on a meeting that has happened marks it done
        if (!moved && b.summary && daysFrom(f.date) <= 0) b.status = "done";
        const json = await billingApi(`/calendar-events/${ev._id}`, { method: "PUT", body: b });
        saved = json.data;
        toast.success(moved ? "Rescheduled" : "Saved");
      }
      if (f.next && client) {
        await billingApi("/calendar-events", { method: "POST", body: {
          ...(client.src === "lead" ? { leadId: client.id } : { enquiryId: client.id }),
          type: client.src === "enq" ? "enquiry_followup" : "call_followup", date: f.next,
          title: `Follow-up after meeting${f.outcome ? `: ${f.outcome}` : ""}`,
        } });
      }
      onSaved(saved);
    } catch (err) { toast.error(err.message || "Save failed"); }
    finally { setBusy(false); }
  };

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await billingApi(`/calendar-events/${ev._id}`, { method: "PUT", body: { status, done: status !== "scheduled" } });
      if (status === "noshow" && client) {
        await billingApi("/calendar-events", { method: "POST", body: {
          ...(client.src === "lead" ? { leadId: client.id } : { enquiryId: client.id }),
          type: "client_response", date: ymd(new Date()), title: `Missed the meeting on ${fds(ev.date)}. Reschedule.`,
        } });
      }
      toast.success(status === "cancelled" ? "Meeting cancelled" : status === "noshow" ? "Marked no-show. Reschedule reminder added." : "Updated");
      onSaved();
    } catch (err) { toast.error(err.message || "Failed"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm("Delete this calendar entry?")) return;
    setBusy(true);
    try { await billingApi(`/calendar-events/${ev._id}`, { method: "DELETE" }); toast.success("Deleted"); onSaved(); }
    catch (err) { toast.error(err.message || "Delete failed"); setBusy(false); }
  };

  return (
    <>
      <div className="sd-mscrim" onClick={onClose} />
      <form className="sd-modal" role="dialog" aria-modal="true" onSubmit={save}>
        <div className="m-h">
          <h3>{isNew ? "Schedule meeting" : client?.name || ev.leadName || ev.title}</h3>
          <button type="button" className="sd-btn sm" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>
        <div className="m-b">
          {isNew ? (
            <div className="sd-f"><span>Client or project</span>
              {client ? (
                <div className="sd-picked">
                  <div><b>{client.name}</b><span>{[client.company, kindOf(client), client.phone].filter(Boolean).join(" · ")}</span></div>
                  <button type="button" className="sd-btn sm" onClick={() => setClientId("")}>Change</button>
                </div>
              ) : (
                <>
                  <input value={find} onChange={e => setFind(e.target.value)} placeholder="Search name, company, project or phone" autoFocus />
                  <div className="sd-picklist" role="listbox" aria-label="Clients">
                    {options.map(c => (
                      <button type="button" role="option" aria-selected="false" key={`${c.src}-${c.id}`} onClick={() => pickClient(c)}>
                        <b>{c.name}</b>{c.company ? ` · ${c.company}` : ""}<span className={`sd-pk ${c.group === "project" ? "pj" : ""}`}>{kindOf(c)}</span>
                      </button>
                    ))}
                    {!options.length && <div className="sd-note">No client matches “{find}”.</div>}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="sd-note">{TYPE_LABEL[ev.type] || ev.type}{client ? ` · ${client.project} · ${client.owner}` : ""}{ev.email ? ` · ${ev.email}` : ""}{ev.status && ev.status !== "scheduled" ? ` · ${ev.status}` : ""}</div>
          )}
          <div className="sd-g3">
            <label className="sd-f"><span>Date</span><input type="date" value={f.date} onChange={set("date")} required /></label>
            <label className="sd-f"><span>Start</span><input type="time" step="900" value={f.time} onChange={set("time")} /></label>
            <label className="sd-f"><span>Minutes</span>
              <select value={f.duration} onChange={set("duration")}>{[15, 30, 45, 60, 90].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          <div className="sd-g2">
            <label className="sd-f"><span>Type</span>
              <select value={f.mode} onChange={set("mode")}>
                <option value="">Not set</option>
                {Object.entries(MODE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="sd-f"><span>Agenda</span><input value={f.title} onChange={set("title")} placeholder="Eg. Requirement call" required /></label>
          </div>
          <div className="sd-g2">
            <label className="sd-f"><span>Client email</span><input type="email" value={f.email} onChange={set("email")} placeholder={client?.email || "name@company.com"} /></label>
            {f.mode === "meet" && <label className="sd-f"><span>Google Meet link</span><input value={f.link} onChange={set("link")} placeholder="meet.google.com/…" /></label>}
          </div>
          {!isNew && (
            <>
              <label className="sd-f"><span>Meeting summary</span>
                <textarea rows={4} value={f.summary} onChange={set("summary")} placeholder="What was discussed, what was agreed, what the client will send" /></label>
              <div className="sd-g2">
                <label className="sd-f"><span>Outcome</span>
                  <select value={f.outcome} onChange={set("outcome")}>{OUTCOMES.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                <label className="sd-f"><span>Next follow-up (optional)</span><input type="date" value={f.next} onChange={set("next")} /></label>
              </div>
            </>
          )}
          <div className="sd-macts">
            {!isNew ? (
              <span className="sd-acts">
                {(!ev.status || ev.status === "scheduled") && <button type="button" className="sd-btn" onClick={() => setStatus("cancelled")} disabled={busy}>Cancel meeting</button>}
                {(!ev.status || ev.status === "scheduled") && isMeeting(ev) && <button type="button" className="sd-btn" onClick={() => setStatus("noshow")} disabled={busy}>No-show</button>}
                {ev.status && ev.status !== "scheduled" && <button type="button" className="sd-btn" onClick={() => setStatus("scheduled")} disabled={busy}>Reopen</button>}
                <button type="button" className="sd-btn" onClick={remove} disabled={busy}>Delete</button>
              </span>
            ) : <span />}
            <span className="sd-acts">
              {!isNew && client?.phone && <button type="button" className="sd-btn wa" onClick={() => onShare({ ...ev, ...body() }, client)}>Share on WhatsApp</button>}
              <button type="submit" className="sd-btn main" disabled={busy || !active(ev || {})}>{isNew ? "Schedule" : "Save"}</button>
            </span>
          </div>
        </div>
      </form>
    </>
  );
}
