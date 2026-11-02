import { useState } from "react";
import { Pencil, Trash2, ChevronDown, ChevronUp, IndianRupee, Square, Play, X } from "lucide-react";
import { toast } from "../../utils/toast";
import { PaymentModal } from "./BillingModals";
import {
  billingApi, EXTRA_STATUS, MONTH_STATUS, SERVICE_ICON, fmtDate, monthLabel, today,
} from "./billingMeta";
import { inr } from "../../Leads/gst";

function PaymentList({ payments, onDelete, canEdit }) {
  if (!payments?.length) return null;
  return (
    <ul className="bill-pay-list">
      {payments.map(p => (
        <li key={p._id}>
          {p.waived
            ? <span>Skipped{p.note ? ` — ${p.note}` : ""}</span>
            : <span><strong>{inr(p.amount)}</strong> · {fmtDate(p.date)} · {p.mode}{p.reference ? ` · ${p.reference}` : ""}{p.note ? ` — ${p.note}` : ""}</span>}
          {canEdit && (
            <button type="button" className="bill-x" onClick={() => onDelete(p)} title="Delete payment"><X size={12} /></button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ── One additional-work item ────────────────────────────────────────────── */
export function ExtraCard({ item, canEdit, showProject, onChange, onEdit, onDelete }) {
  const [paying, setPaying] = useState(false);
  const st = EXTRA_STATUS[item.status] || EXTRA_STATUS.quoted;

  const setStatus = async (status) => {
    try {
      const json = await billingApi(`/project-extras/${item._id}`, { method: "PUT", body: { status } });
      onChange(json.data);
    } catch (err) { toast.error(err.message || "Update failed"); }
  };

  const deletePayment = async (p) => {
    if (!window.confirm(`Delete payment of ${inr(p.amount)}?`)) return;
    try {
      const json = await billingApi(`/project-extras/${item._id}/payments/${p._id}`, { method: "DELETE" });
      onChange(json.data);
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  return (
    <div className={`intg-card${item.balance > 0 && item.status === "done" ? " soon" : ""}`}>
      <div className="intg-card-top">
        <div className="intg-card-icon">🧩</div>
        <div className="intg-card-main">
          <div className="intg-card-title">
            {item.title}
            <span className={`intg-badge ${st.cls}`}>{st.label}</span>
          </div>
          <div className="intg-card-sub">
            {showProject && item.lead?.name ? `${item.lead.name} · ` : ""}Requested {fmtDate(item.requestedDate)}
          </div>
        </div>
        {canEdit && (
          <div className="intg-card-acts">
            <button type="button" className="intg-icon-btn" onClick={() => onEdit(item)} title="Edit"><Pencil size={14} /></button>
            <button type="button" className="intg-icon-btn danger" onClick={() => onDelete(item)} title="Delete"><Trash2 size={14} /></button>
          </div>
        )}
      </div>

      {item.description && <div className="intg-card-notes">{item.description}</div>}

      <div className="bill-figs">
        <div><span>Amount</span><strong>{inr(item.amount)}</strong></div>
        <div><span>GST</span><strong>{item.gstApplicable ? inr(item.gst) : "₹0"}</strong></div>
        <div><span>Total</span><strong>{inr(item.total)}</strong></div>
        <div><span>Received</span><strong className="ok">{inr(item.paid)}</strong></div>
        <div><span>Balance</span><strong className={item.balance > 0 ? "due" : "ok"}>{inr(item.balance)}</strong></div>
      </div>

      <PaymentList payments={item.payments} onDelete={deletePayment} canEdit={canEdit} />

      {canEdit && (
        <div className="bill-actions">
          <select value={item.status} onChange={e => setStatus(e.target.value)} aria-label="Status">
            {Object.entries(EXTRA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {item.balance > 0 && (
            <button type="button" className="intg-btn primary" onClick={() => setPaying(true)}>
              <IndianRupee size={13} /> Record Payment
            </button>
          )}
        </div>
      )}

      {paying && (
        <PaymentModal kind="extra" item={item} suggested={item.balance} onSaved={onChange} onClose={() => setPaying(false)} />
      )}
    </div>
  );
}

/* ── One monthly service, with its month-by-month dues ──────────────────── */
export function ServiceCard({ item, canEdit, showProject, onChange, onEdit, onDelete }) {
  const [open, setOpen]     = useState(false);
  const [paying, setPaying] = useState(null); // month row being paid
  const cur = item.current;
  // Next month to collect: oldest overdue, else this month if unpaid
  const nextDue = [...item.schedule].reverse().find(r => ["overdue", "due", "partial"].includes(r.status));

  const update = async (body, msg) => {
    try {
      const json = await billingApi(`/recurring-services/${item._id}`, { method: "PUT", body });
      onChange(json.data);
      toast.success(msg);
    } catch (err) { toast.error(err.message || "Update failed"); }
  };

  const stop = () => {
    if (window.confirm(`Stop ${item.name}? No new monthly dues will be added after today.`)) update({ endDate: today() }, "Service stopped");
  };

  const deletePayment = async (p) => {
    if (!window.confirm(p.waived ? "Undo skip for this month?" : `Delete payment of ${inr(p.amount)}?`)) return;
    try {
      const json = await billingApi(`/recurring-services/${item._id}/payments/${p._id}`, { method: "DELETE" });
      onChange(json.data);
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  return (
    <div className={`intg-card${item.overdueCount ? " overdue" : ""}${item.active ? "" : " bill-stopped"}`}>
      <div className="intg-card-top">
        <div className="intg-card-icon">{SERVICE_ICON[item.type] || "🔁"}</div>
        <div className="intg-card-main">
          <div className="intg-card-title">
            {item.name}
            <span className={`intg-badge ${item.active ? "intg-st-live" : "intg-st-inactive"}`}>{item.active ? "Active" : "Stopped"}</span>
            {cur && <span className={`intg-badge ${MONTH_STATUS[cur.status].cls}`}>{monthLabel(cur.period)}: {MONTH_STATUS[cur.status].label}</span>}
          </div>
          <div className="intg-card-sub">
            {showProject && item.lead?.name ? `${item.lead.name} · ` : ""}
            <strong>{inr(item.monthlyTotal)}</strong>/month{item.gstApplicable ? ` (incl. ${item.gstRate}% GST)` : ""} · bill on {item.billingDay}th
            · since {fmtDate(item.startDate)}{item.endDate ? ` · ends ${fmtDate(item.endDate)}` : ""}
          </div>
        </div>
        {canEdit && (
          <div className="intg-card-acts">
            <button type="button" className="intg-icon-btn" onClick={() => onEdit(item)} title="Edit"><Pencil size={14} /></button>
            <button type="button" className="intg-icon-btn danger" onClick={() => onDelete(item)} title="Delete"><Trash2 size={14} /></button>
          </div>
        )}
      </div>

      <div className="bill-figs">
        <div><span>Billed so far</span><strong>{inr(item.billed)}</strong></div>
        <div><span>Collected</span><strong className="ok">{inr(item.collected)}</strong></div>
        <div><span>Overdue</span><strong className={item.overdueCount ? "due" : "ok"}>{item.overdueCount ? `${inr(item.overdueAmount)} (${item.overdueCount} mo)` : "—"}</strong></div>
      </div>

      <div className="bill-actions">
        <button type="button" className="intg-btn ghost" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Months ({item.schedule.length})
        </button>
        {canEdit && (item.active
          ? <button type="button" className="intg-btn ghost" onClick={stop}><Square size={12} /> Stop</button>
          : <button type="button" className="intg-btn ghost" onClick={() => update({ endDate: null }, "Service resumed")}><Play size={12} /> Resume</button>)}
        {canEdit && nextDue && (
          <button type="button" className="intg-btn primary" onClick={() => setPaying(nextDue)}>
            <IndianRupee size={13} /> Record {monthLabel(nextDue.period)}
          </button>
        )}
      </div>

      {open && (
        <div className="bill-months">
          {item.schedule.length === 0 && <div className="intg-empty">Starts {fmtDate(item.startDate)} — no months due yet.</div>}
          {item.schedule.map(r => (
            <div key={r.period} className="bill-month">
              <div className="bill-month-row">
                <span className="bill-month-name">{monthLabel(r.period)}</span>
                <span className="bill-month-due">due {fmtDate(r.dueDate)}</span>
                <span className={`intg-badge ${MONTH_STATUS[r.status].cls}`}>{MONTH_STATUS[r.status].label}</span>
                <span className="bill-month-amt">{inr(r.paid)} / {inr(r.amount)}</span>
                {canEdit && r.status !== "paid" && r.status !== "waived" && (
                  <button type="button" className="intg-link" onClick={() => setPaying(r)}>Record</button>
                )}
              </div>
              <PaymentList payments={r.payments} onDelete={deletePayment} canEdit={canEdit} />
            </div>
          ))}
        </div>
      )}

      {item.notes && <div className="intg-card-notes">{item.notes}</div>}

      {paying && (
        <PaymentModal
          kind="service" item={item} period={paying.period} suggested={paying.balance}
          onSaved={onChange} onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}
