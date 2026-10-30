import { useState } from "react";
import { X, XCircle } from "lucide-react";

const QUICK_REASONS = ["Budget too low", "Went with competitor", "Not responding", "Not interested", "Duplicate / spam"];

/**
 * Popup to mark an enquiry as lost with an optional reason.
 * onSave(reason) must return a promise resolving truthy on success.
 */
export default function LostModal({ enquiry, onSave, onClose }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { if (await onSave(reason.trim())) onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="enq-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="enq-modal" role="dialog" aria-modal="true" aria-label="Mark as lost">
        <div className="enq-modal-head">
          <div>
            <div className="enq-modal-title" style={{ color: "#b91c1c" }}><XCircle size={16} /> Mark as Lost</div>
            <div className="enq-modal-sub">{enquiry.name} · {enquiry.phone}</div>
          </div>
          <button className="enq-modal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="enq-modal-body">
          <div className="enq-field">
            <label className="enq-label">Reason (optional)</label>
            <div className="enq-fu-quick" style={{ marginBottom: 8 }}>
              {QUICK_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`enq-fu-quick-btn${reason === r ? " active" : ""}`}
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              className="enq-textarea"
              rows={3}
              placeholder="Why was this lead lost?"
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div className="enq-modal-foot">
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="enq-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="enq-lost-confirm" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Mark as Lost"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
