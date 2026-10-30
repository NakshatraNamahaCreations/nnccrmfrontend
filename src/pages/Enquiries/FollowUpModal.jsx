import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Calendar } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad2 = (n) => String(n).padStart(2, "0");
const ymd  = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return ymd(d); };

const QUICK = [
  { label: "Today",    days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "+3 days",  days: 3 },
  { label: "+1 week",  days: 7 },
];

function fmtLong(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

/**
 * Calendar popup for scheduling an enquiry follow-up.
 * onSave(dateKey, note) / onClear() must return promises; the modal closes on success.
 */
export default function FollowUpModal({ enquiry, onSave, onClear, onClose }) {
  const current  = enquiry.followUpDate ? String(enquiry.followUpDate).split("T")[0] : "";
  const todayKey = ymd(new Date());

  const [selected, setSelected] = useState(current);
  const [note, setNote]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [month, setMonth]       = useState(() => {
    const base = current ? new Date(current + "T00:00:00") : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // 6-row grid starting on the Sunday before the 1st
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const cells = Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );

  const shiftMonth = (n) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const pick = (key) => {
    setSelected(key);
    const [y, m] = key.split("-").map(Number);
    setMonth(new Date(y, m - 1, 1));
  };

  const run = async (fn) => {
    setSaving(true);
    try { if (await fn()) onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="enq-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="enq-modal" role="dialog" aria-modal="true" aria-label="Schedule follow-up">
        <div className="enq-modal-head">
          <div>
            <div className="enq-modal-title"><Calendar size={16} /> Schedule Follow-up</div>
            <div className="enq-modal-sub">{enquiry.name} · {enquiry.phone}</div>
          </div>
          <button className="enq-modal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="enq-modal-body">
          <div className="enq-fu-quick">
            {QUICK.map(q => {
              const key = addDays(q.days);
              return (
                <button
                  key={q.label}
                  type="button"
                  className={`enq-fu-quick-btn${selected === key ? " active" : ""}`}
                  onClick={() => pick(key)}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          <div className="enq-cal">
            <div className="enq-cal-head">
              <button type="button" className="enq-cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <span>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
              <button type="button" className="enq-cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="enq-cal-grid">
              {WEEKDAYS.map(w => <div key={w} className="enq-cal-wd">{w}</div>)}
              {cells.map(d => {
                const key = ymd(d);
                const cls = [
                  "enq-cal-day",
                  d.getMonth() !== month.getMonth() && "out",
                  key === todayKey && "today",
                  key === current  && "current",
                  key === selected && "selected",
                ].filter(Boolean).join(" ");
                return (
                  <button
                    key={key}
                    type="button"
                    className={cls}
                    disabled={key < todayKey}
                    onClick={() => setSelected(key)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="enq-fu-picked">
            {selected ? <>Follow-up on <strong>{fmtLong(selected)}</strong></> : "Pick a date"}
          </div>

          <div className="enq-field">
            <label className="enq-label">Note (optional)</label>
            <textarea
              className="enq-textarea"
              rows={2}
              placeholder="e.g. Call back to discuss pricing…"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div className="enq-modal-foot">
          {current && (
            <button type="button" className="enq-fu-clear" disabled={saving} onClick={() => run(onClear)}>
              Remove follow-up
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="enq-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="enq-note-save-btn"
              disabled={saving || !selected || (selected === current && !note.trim())}
              onClick={() => run(() => onSave(selected, note.trim()))}
            >
              {saving ? "Saving…" : "Save Follow-up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
