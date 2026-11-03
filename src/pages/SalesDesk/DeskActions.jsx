import { useState } from "react";
import { billingApi } from "../ProjectBilling/billingMeta";
import { addDays, fds } from "./deskData";
import { PROJECT_STAGES } from "../../Leads/projectStages";

const PROPOSAL = [
  ["preparing", "Preparing"], ["sent", "Sent"], ["negotiation", "Negotiation"], ["accepted", "Accepted"], ["rejected", "Rejected"],
];
const ACTIONS = ["Called", "No answer", "Sent proposal", "Sent quotation", "Meeting done", "Follow-up done", "Client will call back"];

/**
 * Work on one client from the Sales Desk panel, using the same CRM actions
 * as the Enquiries page (note, follow-up, proposal, lost / reopen, convert)
 * and the Leads drawer (note, call log, follow-up, project stage).
 * `run(fn, successMessage)` saves and reloads the desk.
 */
export default function DeskActions({ c, run, busy }) {
  const isEnq = c.src === "enq";
  const tabs = isEnq
    ? [["note", "Note"], ["follow", "Follow-up"], ["proposal", "Proposal"], ["lost", c.lost ? "Reopen" : "Lost"]]
    : [["note", "Note"], ["call", "Log call"], ["follow", "Follow-up"], ...(c.closed ? [["stage", "Stage"]] : [])];
  const [tab, setTab] = useState("note");
  const e = c.raw;

  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [fuDate, setFuDate] = useState(addDays(2));
  const [fuTitle, setFuTitle] = useState("");
  const [fuChannel, setFuChannel] = useState("Call");
  const [prop, setProp] = useState(e.proposalStatus || "preparing");
  const [propText, setPropText] = useState("");
  const [reason, setReason] = useState("");
  const [mins, setMins] = useState("");
  const [stage, setStage] = useState(e.projectStage || "");

  const enq = (path, body) => billingApi(`/enquiries/${c.id}/${path}`, { method: "POST", body });
  const lead = (path, body) => billingApi(`/leads/${c.id}/${path}`, { method: "POST", body });
  const [dealValue, setDealValue] = useState("");
  // New lead → project: enquiries become a lead first; then the deal is closed and onboarded
  const convertToProject = async () => {
    let leadId = c.id;
    if (isEnq) {
      const j = await enq("convert", {});
      leadId = j.data?.lead?._id;
      if (!leadId) throw new Error("Converted, but the new lead was not returned");
    }
    await billingApi(`/leads/${leadId}`, { method: "PUT", body: {
      stage: "Closed", projectStage: "Onboarded", ...(Number(dealValue) > 0 ? { value: Number(dealValue) } : {}),
    } });
  };
  const clear = () => { setAction(""); setNote(""); setFuTitle(""); setPropText(""); setReason(""); setMins(""); };
  const go = (fn, msg) => run(async () => { await fn(); clear(); }, msg);

  return (
    <div className="sd-actbox">
      <h3>
        Actions
        <span className="sd-actmeta">
          {isEnq && e.proposalStatus && <span className="pill blue">Proposal: {e.proposalStatus}</span>}
          {isEnq && e.followUpDate && <span className="pill">Follow-up {fds(e.followUpDate)}</span>}
          {!isEnq && c.closed && <span className="pill">{e.projectStage || "Not started"}</span>}
        </span>
      </h3>
      <div className="sd-chtabs" role="tablist">
        {tabs.map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button>)}
      </div>

      {tab === "note" && (
        <div className="sd-actform">
          {isEnq && (
            <>
              <input className="sd-in" list="sd-actions" value={action} onChange={ev => setAction(ev.target.value)} placeholder="Action, eg. Called, Sent proposal, Follow-up done" aria-label="Action" />
              <datalist id="sd-actions">{ACTIONS.map(a => <option key={a} value={a} />)}</datalist>
            </>
          )}
          <textarea rows={3} value={note} onChange={ev => setNote(ev.target.value)} placeholder="Additional notes…" aria-label="Note" />
          <div className="sd-acts">
            <button type="button" className="sd-btn main" disabled={busy || !(note.trim() || action.trim())}
              onClick={() => go(() => (isEnq ? enq("activity", { action: action.trim(), note: note.trim() }) : lead("notes", { text: note.trim() })), "Note saved")}>
              Save note
            </button>
          </div>
        </div>
      )}

      {tab === "call" && !isEnq && (
        <div className="sd-actform">
          <textarea rows={3} value={note} onChange={ev => setNote(ev.target.value)} placeholder="What was discussed on the call" aria-label="Call summary" />
          <div className="sd-actrow">
            <input className="sd-in" type="number" min="0" value={mins} onChange={ev => setMins(ev.target.value)} placeholder="Minutes" aria-label="Call minutes" />
            <button type="button" className="sd-btn main" disabled={busy || !note.trim()}
              onClick={() => go(() => lead("comms", { type: "Call", summary: note.trim(), durationMin: Number(mins) || 0 }), "Call logged")}>Log call</button>
          </div>
        </div>
      )}

      {tab === "follow" && (
        <div className="sd-actform">
          <div className="sd-actrow">
            <input className="sd-in" type="date" value={fuDate} onChange={ev => setFuDate(ev.target.value)} aria-label="Follow-up date" />
            {!isEnq && (
              <select className="sd-in" value={fuChannel} onChange={ev => setFuChannel(ev.target.value)} aria-label="Channel">
                {["Call", "WhatsApp", "Email", "Meeting"].map(x => <option key={x}>{x}</option>)}
              </select>
            )}
          </div>
          <input className="sd-in" value={fuTitle} onChange={ev => setFuTitle(ev.target.value)} placeholder={isEnq ? "Note (optional)" : "What to do, eg. Call for advance"} aria-label="Follow-up note" />
          <div className="sd-acts">
            {isEnq && e.followUpDate && (
              <button type="button" className="sd-btn" disabled={busy}
                onClick={() => go(() => enq("activity", { action: "Follow-up", note: "", followUpDate: null }), "Follow-up removed")}>Remove follow-up</button>
            )}
            <button type="button" className="sd-btn main" disabled={busy || !fuDate}
              onClick={() => go(() => (isEnq
                ? enq("activity", { action: "Follow-up", note: fuTitle.trim(), followUpDate: fuDate })
                : lead("followups", { title: fuTitle.trim() || "Follow-up", channel: fuChannel, dueDate: fuDate })), `Follow-up set for ${fds(fuDate)}`)}>
              Schedule follow-up
            </button>
          </div>
        </div>
      )}

      {tab === "stage" && !isEnq && (
        <div className="sd-actform">
          <div className="sd-propsteps">
            {[["", "Not started"], ...PROJECT_STAGES.map(s => [s, s])].map(([k, t]) => (
              <button key={k || "none"} type="button" className={stage === k ? "on" : ""} onClick={() => setStage(k)}>{t}</button>
            ))}
          </div>
          <p className="sd-note" style={{ margin: 0 }}>“Project Completed” also marks the project completed; “On Hold” pauses routine reminders.</p>
          <div className="sd-acts">
            <button type="button" className="sd-btn main" disabled={busy || stage === (e.projectStage || "")}
              onClick={() => go(() => billingApi(`/leads/${c.id}`, { method: "PUT", body: { projectStage: stage } }), `Stage set to ${stage || "Not started"}`)}>Save stage</button>
          </div>
        </div>
      )}

      {tab === "proposal" && isEnq && (
        <div className="sd-actform">
          <div className="sd-propsteps">
            {PROPOSAL.map(([k, t]) => <button key={k} type="button" className={prop === k ? "on" : ""} onClick={() => setProp(k)}>{t}</button>)}
          </div>
          <textarea rows={2} value={propText} onChange={ev => setPropText(ev.target.value)} placeholder="Comment, eg. sent ₹45,000 proposal for website" aria-label="Proposal comment" />
          <div className="sd-acts">
            <button type="button" className="sd-btn main" disabled={busy || (prop === e.proposalStatus && !propText.trim())}
              onClick={() => go(() => enq("proposal", { status: prop, comment: propText.trim() }), "Proposal updated")}>Save proposal</button>
          </div>
          {(e.proposalComments || []).length > 0 && (
            <div className="sd-list">
              {[...e.proposalComments].reverse().slice(0, 4).map((p, i) => (
                <div key={i}><span><b className="sd-fd">{fds(p.at)}</b>{p.status}<small>{p.text || "-"}</small></span></div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "lost" && isEnq && (
        c.lost ? (
          <div className="sd-actform">
            <p className="sd-note" style={{ margin: 0 }}>This lead is marked lost. Reopening sets it back to “Contacted”.</p>
            <div className="sd-acts">
              <button type="button" className="sd-btn main" disabled={busy} onClick={() => go(() => enq("lost", { lost: false }), "Lead reopened")}>Reopen</button>
            </div>
          </div>
        ) : (
          <div className="sd-actform">
            <input className="sd-in" value={reason} onChange={ev => setReason(ev.target.value)} placeholder="Reason, eg. budget too low, went with another agency" aria-label="Lost reason" />
            <div className="sd-acts">
              <button type="button" className="sd-btn danger" disabled={busy}
                onClick={() => go(() => enq("lost", { lost: true, reason: reason.trim() }), "Marked lost")}>Mark as lost</button>
            </div>
          </div>
        )
      )}

      {c.group === "new" && !c.lost && !e.convertedToLead && (
        <div className="sd-convert">
          <span>Deal closed? Convert it and it moves to Projects.</span>
          <span className="sd-actrow" style={{ flex: "0 1 auto" }}>
            <input className="sd-in" type="number" min="0" value={dealValue} onChange={ev => setDealValue(ev.target.value)}
              placeholder="Project value ₹ (optional)" aria-label="Project value" style={{ width: 200 }} />
            <button type="button" className="sd-btn ok" disabled={busy}
              onClick={() => { if (window.confirm(`Convert ${c.name} to a project?`)) go(() => convertToProject(), `${c.name} moved to Projects`); }}>
              Convert to project
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
