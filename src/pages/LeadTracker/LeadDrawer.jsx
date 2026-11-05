import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import {
  STAGES, STL, isOpen, LOST_REASONS, TPL, fillTpl, tplFor, waLink, why, val,
  TODAY, plusDays, fd, fdw, hm, L, inr, fmin, phF, ph10, band,
} from "./leadData";

const ACTIONS = ["log", "wa", "lost"];
const MODE = { meet: "Google Meet", office: "Office", phone: "Phone" };

// The lead panel on the right: details, next step, meetings, quotations, payments and activity
export default function LeadDrawer({ l, tab, setTab, onClose, onOpen, owners, act, run }) {
  const dtab = ACTIONS.includes(tab) ? "ov" : tab;
  const [dact, setDact] = useState(ACTIONS.includes(tab) ? tab : "");
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  const save = async (fn, ok) => { setBusy(true); const r = await run(fn, ok); setBusy(false); if (r) setDact(""); return r; };
  const [w] = why(l);
  const enq = l.src === "enq";
  const T = [["ov", "Overview"], ["mt", "Meetings", l.meets.length], ["qt", "Quotations", l.quotes.length], ...(l.st === "won" ? [["tx", "Payments"]] : []), ["act", "Activity", l.acts.filter(a => !a.auto).length]];

  return (
    <>
      <div className="lt-scrim" onClick={onClose} />
      <aside className="lt-drawer" aria-label="Lead details">
        <div className="dh">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="lt-sub">{l.source}{l.landing ? ` · ${l.landing}` : ""}{enq ? "" : " · added in Projects"}</span>
              <h3>{l.name}</h3>
              <span className="lt-sub">{l.company || "Individual"}{l.branch ? ` · ${l.branch}` : ""}{l.ownerWas ? ` · was assigned to ${l.ownerWas}` : ""}</span>
            </div>
            <span className={`lt-sc ${band(l.sc)}`} title="Lead score">{l.sc}</span>
            <button type="button" className="lt-xb" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
          <div className="lt-g2" style={{ marginTop: 12 }}>
            <div className="lt-f" style={{ margin: 0 }}>
              <label htmlFor="d-st">Stage</label>
              <select id="d-st" value={l.st} disabled={!enq || busy} onChange={e => {
                const v = e.target.value;
                if (v === "lost") return setDact("lost");
                save(() => (l.st === "lost" && v !== "lost" ? act.reopen(l).then(() => v !== "contacted" && act.stage(l, v)) : act.stage(l, v)), `Moved to ${STL[v]}`);
              }}>{STAGES.map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select>
            </div>
            <div className="lt-f" style={{ margin: 0 }}>
              <label htmlFor="d-ow">Owner</label>
              <select id="d-ow" value={l.owner} disabled={busy} onChange={e => save(() => act.owner(l, e.target.value === "Unassigned" ? "" : e.target.value), `Assigned to ${e.target.value}`)}>
                {[...new Set([...owners, l.owner])].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="lt-acts">
            {ph10(l.phone) && <a className="lt-btn sm" href={`tel:+91${ph10(l.phone)}`} onClick={() => setTimeout(() => setDact("log"), 300)}>Call</a>}
            {ph10(l.phone) && <button type="button" className="lt-btn sm g" onClick={() => { setTab("ov"); setDact("wa"); }}>WhatsApp</button>}
            {l.email && <a className="lt-btn sm" href={`mailto:${l.email}`}>Email</a>}
            <button type="button" className="lt-btn sm" onClick={() => { setTab("ov"); setDact("log"); }}>Log call or note</button>
            {enq && isOpen(l) && <button type="button" className="lt-btn sm r" onClick={() => { setTab("ov"); setDact("lost"); }}>Lost</button>}
            {enq && !l.raw.convertedToLead && l.st !== "lost" && (
              sure
                ? <><button type="button" className="lt-btn sm p" disabled={busy} onClick={() => { setSure(false); save(() => act.convert(l), "Converted. The project is in Projects."); }}>Yes, create the project</button><button type="button" className="lt-btn sm" onClick={() => setSure(false)}>No</button></>
                : <button type="button" className="lt-btn sm" style={{ color: "var(--ok)" }} disabled={busy} title="Creates the client and project in Projects" onClick={() => setSure(true)}>Won: convert to project</button>
            )}
            {enq && l.st === "lost" && <button type="button" className="lt-btn sm" disabled={busy} onClick={() => save(() => act.reopen(l), "Lead reopened")}>Reopen</button>}
          </div>
        </div>
        <div className="db">
          <div className="lt-dtabs" role="tablist">
            {T.map(([k, t, n]) => <button type="button" key={k} role="tab" aria-selected={dtab === k} className={dtab === k ? "on" : ""} onClick={() => { setTab(k); setDact(""); }}>{t}{n ? <i>{n}</i> : null}</button>)}
          </div>
          {dtab === "ov" && <Overview l={l} w={w} dact={dact} setDact={setDact} save={save} busy={busy} act={act} onOpen={onOpen} />}
          {dtab === "mt" && <Meetings l={l} />}
          {dtab === "qt" && <Quotes l={l} />}
          {dtab === "tx" && <Payments l={l} />}
          {dtab === "act" && <Activity l={l} />}
        </div>
      </aside>
    </>
  );
}

function Overview({ l, w, dact, setDact, save, busy, act, onOpen }) {
  const [tk, setTk] = useState(() => tplFor(l));
  const [msg, setMsg] = useState(() => fillTpl(TPL[tplFor(l)][1], l));
  const cancel = <button type="button" className="lt-btn sm" onClick={() => setDact("")}>Cancel</button>;
  const sub = (e) => Object.fromEntries(new FormData(e.target));
  return (
    <>
      {dact === "wa" && (
        <div className="lt-box">
          <h6>WhatsApp {l.name.split(" ")[0]}</h6>
          <div className="lt-f"><label htmlFor="d-tk">Template</label>
            <select id="d-tk" value={tk} onChange={e => { setTk(e.target.value); setMsg(fillTpl(TPL[e.target.value][1], l)); }}>{Object.entries(TPL).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></div>
          <label className="lt-sr" htmlFor="d-wa">Message</label>
          <textarea id="d-wa" className="lt-wa" value={msg} onChange={e => setMsg(e.target.value)} />
          <div className="lt-row"><button type="button" className="lt-btn sm g" disabled={busy} onClick={() => {
            window.open(waLink(l, msg), "_blank", "noopener");
            save(async () => { await act.log(l, "WhatsApp", `${TPL[tk][0]}: ${msg.slice(0, 300)}`); if (l.st === "new" && l.src === "enq") await act.stage(l, "contacted"); }, "WhatsApp logged");
          }}>Open in WhatsApp</button>{cancel}</div>
          <p className="lt-note">Opens WhatsApp with the message, and logs it on the lead{l.st === "new" ? " and moves it to Contacted" : ""}.</p>
        </div>
      )}
      {dact === "log" && (
        <form className="lt-box" onSubmit={e => {
          e.preventDefault(); const d = sub(e);
          save(async () => {
            await act.log(l, d.res === "note" ? "Note" : `Call: ${d.res}`, d.txt, d.nf || null);
            if (d.res === "Connected" && l.st === "new" && l.src === "enq") await act.stage(l, "contacted");
            if (d.res === "Wrong number" && l.src === "enq") await act.lost(l, "Wrong number or spam");
          }, "Saved");
        }}>
          <h6>Log a call or note</h6>
          <div className="lt-f"><label htmlFor="n1">Call result</label><select id="n1" name="res"><option>Connected</option><option>No answer</option><option>Busy, call back</option><option>Switched off</option><option>Wrong number</option><option value="note">Just a note</option></select></div>
          <div className="lt-f"><label htmlFor="n2">What was discussed</label><textarea id="n2" name="txt" required placeholder="Wants a 6 page website, ready in 3 weeks, will share content Monday" /></div>
          <div className="lt-f"><label htmlFor="n3">Next follow-up</label><input id="n3" name="nf" type="date" defaultValue={plusDays(1)} min={TODAY()} /></div>
          <div className="lt-row"><button className="lt-btn sm p" disabled={busy}>Save</button>{cancel}</div>
        </form>
      )}
      {dact === "lost" && (
        <form className="lt-box" onSubmit={e => { e.preventDefault(); const d = sub(e); save(() => act.lost(l, d.r), "Marked lost"); }}>
          <h6>Mark as lost</h6>
          <div className="lt-f"><label htmlFor="l1">Reason</label><select id="l1" name="r">{LOST_REASONS.map(r => <option key={r}>{r}</option>)}</select></div>
          <div className="lt-row"><button className="lt-btn sm p" disabled={busy}>Mark lost</button>{cancel}</div>
        </form>
      )}

      {l.same.length > 0 && (
        <div className="lt-box bl"><h6>Same mobile number</h6>
          {l.same.map(x => <div key={x.id} style={{ fontSize: 13 }}>{x.created < l.created ? "Enquired before" : "Enquired again"} on {fd(x.created)} as <button type="button" className="lt-link" onClick={() => onOpen(x.id)}>{x.name}</button> ({STL[x.st]})</div>)}
        </div>
      )}

      <div className={`lt-box ${isOpen(l) ? "am" : ""}`}>
        <h6>Next step</h6><b className="nmb">{w}</b>
        {isOpen(l) && (
          <div className="lt-row" style={{ marginTop: 10 }}>
            <span className="lt-note">Follow up on</span>
            <label className="lt-sr" htmlFor="d-nf">Next follow-up</label>
            <input id="d-nf" type="date" className="lt-in sm" value={l.nf || ""} min={TODAY()} disabled={busy} onChange={e => save(() => act.follow(l, e.target.value || null), `Follow-up on ${fd(e.target.value)}`)} />
            {[[1, "Tomorrow"], [3, "3 days"], [7, "1 week"]].map(([n, t]) => <button type="button" key={n} className="lt-btn sm" disabled={busy} onClick={() => save(() => act.follow(l, plusDays(n)), `Follow-up on ${fd(plusDays(n))}`)}>{t}</button>)}
          </div>
        )}
      </div>

      <div className="lt-sumg">
        <div><span>Meetings</span><b>{l.meets.length}</b><small>{l.meets[0] ? fd(l.meets[0].date) : "None yet"}</small></div>
        <div><span>Quotations</span><b>{l.quotes.length}</b><small>{l.quotes[0] ? `${L(l.quotes[0].total)} · ${l.quotes[0].status}` : "None yet"}</small></div>
        <div><span>Value</span><b>{val(l) ? L(val(l)) : "-"}</b><small>{l.st === "won" && l.money ? (l.money.balance > 0 ? `${L(l.money.balance)} due` : "Fully paid") : l.budget ? "Budget said" : "No budget given"}</small></div>
      </div>

      <div className="lt-kv">
        <div><span>Mobile</span><b>{phF(l.phone)}</b></div><div><span>Email</span><b>{l.email || "-"}</b></div>
        <div><span>Service</span><b>{l.svc}</b></div><div><span>Budget said</span><b>{l.budget ? L(l.budget) : "-"}</b></div>
        <div><span>Enquired</span><b>{fd(l.created)}, {hm(l.created)}</b></div>
        <div><span>First reply</span><b>{l.fr == null ? (l.src === "enq" ? <span style={{ color: "var(--red)" }}>Not logged</span> : "-") : `${fmin(l.fr)} later`}</b></div>
        <div><span>Branch</span><b>{l.branch || "-"}</b></div><div><span>Last activity</span><b>{fd(l.last)}</b></div>
        {l.st === "won" && <div><span>Won</span><b style={{ color: "var(--ok)" }}>{fd(l.wonDate)}</b></div>}
        {l.st === "lost" && <div><span>Lost</span><b>{l.reason || "No reason"}, {fd(l.lostDate)}</b></div>}
      </div>
      {(l.services || l.need) && (
        <div className="lt-box"><h6>What they asked for</h6>
          {l.services && <div style={{ fontSize: 13, fontWeight: 500, color: "var(--navy)" }}>{l.services}</div>}
          {l.need && l.need !== l.services && <div className="lt-pre">{l.need}</div>}
        </div>
      )}
      <div className="lt-box"><h6>Why the score is {l.sc}</h6>
        {l.sb.map(([t, v]) => <div key={t} className="lt-sbr"><span>{t}</span><b style={{ color: v < 0 ? "var(--red)" : "var(--ok)" }}>{v > 0 ? "+" : ""}{v}</b></div>)}
      </div>
    </>
  );
}

function Meetings({ l }) {
  return (
    <>
      <div className="lt-row" style={{ marginBottom: 10 }}><Link className="lt-btn sm p" to="/calendar">Book a meeting in Calendar</Link></div>
      {l.meets.length ? l.meets.map(m => (
        <div className="lt-hc" key={m._id}>
          <div className="hh"><b>{m.title || m.type || "Meeting"}</b><span className={`lt-pill ${m.done ? "p-ok" : m.status === "cancelled" ? "p-gr" : new Date(m.date) < new Date(TODAY()) ? "p-amb" : "p-blue"}`}>{m.done ? "Done" : m.status === "cancelled" ? "Cancelled" : new Date(m.date) < new Date(TODAY()) ? "Outcome not updated" : "Upcoming"}</span></div>
          <span className="lt-sub">{fdw(m.date)}{m.time ? `, ${m.time}` : ""} · {MODE[m.mode] || m.mode || "Meeting"}{m.duration ? ` · ${m.duration} min` : ""}</span>
          {m.summary && <div className="lt-pre">{m.summary}</div>}
          {m.outcome && <div className="lt-sub" style={{ color: "var(--text)", marginTop: 4 }}><b>Outcome:</b> {m.outcome}</div>}
          {m.link && <a className="lt-sub" href={m.link} target="_blank" rel="noreferrer">{m.link}</a>}
        </div>
      )) : <div className="lt-empty">No meetings with this client in the calendar yet.</div>}
    </>
  );
}

function Quotes({ l }) {
  return (
    <>
      <div className="lt-row" style={{ marginBottom: 10 }}><Link className="lt-btn sm p" to="/quotations">Open Quotations</Link></div>
      {l.quotes.length ? l.quotes.map(q => (
        <div className="lt-hc" key={q._id}>
          <div className="hh"><b>{q.quoteNumber || "Quotation"}</b><span className={`lt-pill ${{ accepted: "p-ok", rejected: "p-red", sent: "p-blue", viewed: "p-pur" }[q.status] || "p-gr"}`}>{q.status || "draft"}</span></div>
          <span className="lt-sub">{q.revisionNumber ? `Version ${q.revisionNumber} · ` : ""}{fd(q.createdAt)}{q.validUntil ? ` · valid till ${fd(q.validUntil)}` : ""}</span>
          <table className="lt-qt"><tbody>
            {(q.lineItems || []).map((x, i) => <tr key={i}><td>{x.description}{x.qty > 1 ? ` × ${x.qty}` : ""}</td><td className="r num">{inr(x.amount)}</td></tr>)}
            {q.discount ? <tr><td>Discount</td><td className="r num">- {inr(q.discount)}</td></tr> : null}
            <tr className="t1"><td>Subtotal</td><td className="r num">{inr(q.subtotal)}</td></tr>
            {q.tax ? <tr className="t1"><td>GST {q.tax}%</td><td className="r num">{inr(q.total - (q.subtotal - (q.discount || 0)))}</td></tr> : null}
            <tr className="t2"><td>Total</td><td className="r num">{inr(q.total)}</td></tr>
          </tbody></table>
        </div>
      )) : <div className="lt-empty">No quotations for this client yet.</div>}
    </>
  );
}

function Payments({ l }) {
  const m = l.money || { total: 0, received: 0, balance: 0 };
  return (
    <>
      <div className="lt-kp four">
        <div><span>Project value</span><b>{L(m.total)}</b><small>{l.lead?.gstApplicable ? "incl. GST" : "no GST"}</small></div>
        <div><span>Received</span><b style={{ color: "var(--ok)" }}>{L(m.received)}</b></div>
        <div><span>Balance</span><b style={{ color: m.balance > 0 ? "var(--red)" : "var(--navy)" }}>{L(m.balance)}</b></div>
        <div><span>Project stage</span><b style={{ fontSize: 14 }}>{l.lead?.projectStage || "Not started"}</b></div>
      </div>
      {l.lead ? (
        <div className="lt-kv">
          {l.lead.advanceReceivedDate && <div><span>Advance received on</span><b>{fd(l.lead.advanceReceivedDate)}</b></div>}
          {l.lead.onboardedDate && <div><span>Onboarded</span><b>{fd(l.lead.onboardedDate)}</b></div>}
          {l.lead.finalPaymentDate && <div><span>Final payment due</span><b>{fd(l.lead.finalPaymentDate)}</b></div>}
          {l.lead.projectCompletionDate && <div><span>Completion date</span><b>{fd(l.lead.projectCompletionDate)}</b></div>}
        </div>
      ) : <div className="lt-empty">This enquiry is marked won but has no project yet. Use “Won: convert to project”.</div>}
      <div className="lt-row"><Link className="lt-btn sm p" to="/leads">Open in Projects</Link><Link className="lt-btn sm" to="/payment-tracker">Payment Tracker</Link></div>
    </>
  );
}

function Activity({ l }) {
  return l.acts.length ? (
    <div className="lt-tl">
      {l.acts.map((a, i) => (
        <div key={i} className={a.auto ? "auto" : ""}>
          <b>{a.t}</b>{a.d && <span style={{ color: "var(--text)" }}>{a.d}</span>}
          <span>{fd(a.at)}, {hm(a.at)}{a.by ? ` · ${a.by}` : ""}</span>
        </div>
      ))}
    </div>
  ) : <div className="lt-empty">No activity logged yet.</div>;
}
