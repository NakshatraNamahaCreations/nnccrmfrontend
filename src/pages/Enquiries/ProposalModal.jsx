import { useState } from "react";
import { X, FileText } from "lucide-react";
import { PROPOSAL_STATUS_META, proposalLabel } from "./proposalStatus";

function fmtDateTime(d) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

/**
 * Popup to set an enquiry's proposal status and add a comment.
 * onSave(status, comment) must return a promise resolving truthy on success.
 */
export default function ProposalModal({ enquiry, onSave, onClose }) {
  const current = enquiry.proposalStatus || "";
  const [status, setStatus]   = useState(current || "preparing");
  const [comment, setComment] = useState("");
  const [saving, setSaving]   = useState(false);

  const history = [...(enquiry.proposalComments || [])].reverse();
  const unchanged = status === current && !comment.trim();

  const save = async () => {
    setSaving(true);
    try { if (await onSave(status, comment.trim())) onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="enq-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="enq-modal" role="dialog" aria-modal="true" aria-label="Proposal">
        <div className="enq-modal-head">
          <div>
            <div className="enq-modal-title"><FileText size={16} /> Proposal</div>
            <div className="enq-modal-sub">{enquiry.name} · {enquiry.phone}</div>
          </div>
          <button className="enq-modal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="enq-modal-body">
          <div className="enq-field">
            <label className="enq-label">Status</label>
            <div className="enq-ps-pills">
              {Object.entries(PROPOSAL_STATUS_META).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  className={`enq-ps-pill ${m.cls}${status === key ? " active" : ""}`}
                  onClick={() => setStatus(key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="enq-field">
            <label className="enq-label">Comment</label>
            <textarea
              className="enq-textarea"
              rows={3}
              autoFocus
              placeholder="e.g. Sent proposal on WhatsApp, client will reply by Monday…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          {history.length > 0 && (
            <div className="enq-ps-history">
              <div className="enq-label" style={{ marginBottom: 6 }}>History</div>
              {history.map(c => (
                <div key={c._id || c.at} className="enq-ps-history-item">
                  <span className={`enq-ps-badge ${PROPOSAL_STATUS_META[c.status]?.cls || ""}`}>
                    {proposalLabel(c.status)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    {c.text && <div className="enq-ps-history-text">{c.text}</div>}
                    <div className="enq-activity-meta">{c.by} · {fmtDateTime(c.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="enq-modal-foot">
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="enq-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="enq-note-save-btn" disabled={saving || unchanged} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
