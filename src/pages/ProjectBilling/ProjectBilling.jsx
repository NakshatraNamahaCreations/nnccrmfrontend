import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "../../utils/toast";
import { ExtraCard, ServiceCard } from "./BillingCards";
import { ExtraFormModal, ServiceFormModal } from "./BillingModals";
import { billingApi, canEditBilling } from "./billingMeta";
import { calcGst, inr } from "../../Leads/gst";
import "../Integrations/Integrations.css";
import "./ProjectBilling.css";

const upsert = (list, doc) =>
  list.some(x => x._id === doc._id) ? list.map(x => (x._id === doc._id ? doc : x)) : [doc, ...list];

/** "Extras & Monthly" tab inside a project drawer */
export default function ProjectBilling({ lead }) {
  const [extras, setExtras]     = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [modal, setModal]       = useState(null); // { kind: "extra" | "service", item }
  const canEdit = canEditBilling();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [e, s] = await Promise.all([
        billingApi(`/project-extras?lead=${lead._id}`),
        billingApi(`/recurring-services?lead=${lead._id}`),
      ]);
      setExtras(e.data || []);
      setServices(s.data || []);
    } catch (err) {
      setError(err.status === 403 ? "You don't have access to this." : err.message);
    } finally { setLoading(false); }
  }, [lead._id]);

  useEffect(() => { load(); }, [load]);

  const removeExtra = async (item) => {
    if (!window.confirm(`Delete "${item.title}" and its payments?`)) return;
    try {
      await billingApi(`/project-extras/${item._id}`, { method: "DELETE" });
      setExtras(l => l.filter(x => x._id !== item._id));
      toast.success("Deleted");
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  const removeService = async (item) => {
    if (!window.confirm(`Delete ${item.name} and all its monthly payments? To keep the history, use Stop instead.`)) return;
    try {
      await billingApi(`/recurring-services/${item._id}`, { method: "DELETE" });
      setServices(l => l.filter(x => x._id !== item._id));
      toast.success("Deleted");
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  // Original deal + extras (cancelled extras don't count)
  const deal       = calcGst(lead.value, lead.gstApplicable, lead.gstRate).total;
  const dealPaid   = Number(lead.advanceReceived) || 0;
  const live       = extras.filter(x => x.status !== "cancelled");
  const extrasTot  = live.reduce((s, x) => s + x.total, 0);
  const extrasPaid = live.reduce((s, x) => s + x.paid, 0);
  const grand      = deal + extrasTot;
  const received   = dealPaid + extrasPaid;
  const monthly    = services.filter(s => s.active).reduce((s, x) => s + x.monthlyTotal, 0);
  const overdue    = services.reduce((s, x) => s + x.overdueAmount, 0);

  return (
    <div className="intg-tab">
      <div className="bill-summary">
        <div><span>Original deal</span><strong>{inr(deal)}</strong></div>
        <div><span>+ Additional work</span><strong>{inr(extrasTot)}</strong></div>
        <div className="hl"><span>Project total</span><strong>{inr(grand)}</strong></div>
        <div><span>Received</span><strong className="ok">{inr(received)}</strong></div>
        <div><span>Balance</span><strong className={grand - received > 0 ? "due" : "ok"}>{inr(Math.max(0, grand - received))}</strong></div>
        <div><span>Monthly services</span><strong>{monthly ? `${inr(monthly)}/mo` : "—"}</strong></div>
        {overdue > 0 && <div><span>Monthly overdue</span><strong className="due">{inr(overdue)}</strong></div>}
      </div>

      {loading && <div className="intg-empty">Loading…</div>}
      {!loading && error && <div className="intg-empty error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="intg-tab-head">
            <div>
              <div className="intg-tab-title">Additional Work</div>
              <div className="intg-tab-sub">Changes or new work after the original deal — billed once</div>
            </div>
            {canEdit && (
              <button type="button" className="intg-btn primary" onClick={() => setModal({ kind: "extra" })}>
                <Plus size={14} /> Add Work
              </button>
            )}
          </div>
          {extras.length === 0
            ? <div className="intg-empty">No additional work yet.</div>
            : (
              <div className="intg-card-list">
                {extras.map(x => (
                  <ExtraCard
                    key={x._id} item={x} canEdit={canEdit}
                    onChange={doc => setExtras(l => upsert(l, doc))}
                    onEdit={item => setModal({ kind: "extra", item })}
                    onDelete={removeExtra}
                  />
                ))}
              </div>
            )}

          <div className="intg-tab-head bill-section">
            <div>
              <div className="intg-tab-title">Monthly Services</div>
              <div className="intg-tab-sub">Google Ads, SEO, maintenance and other services billed every month</div>
            </div>
            {canEdit && (
              <button type="button" className="intg-btn primary" onClick={() => setModal({ kind: "service" })}>
                <Plus size={14} /> Add Service
              </button>
            )}
          </div>
          {services.length === 0
            ? <div className="intg-empty">No monthly services yet.</div>
            : (
              <div className="intg-card-list">
                {services.map(s => (
                  <ServiceCard
                    key={s._id} item={s} canEdit={canEdit}
                    onChange={doc => setServices(l => upsert(l, doc))}
                    onEdit={item => setModal({ kind: "service", item })}
                    onDelete={removeService}
                  />
                ))}
              </div>
            )}
        </>
      )}

      {modal?.kind === "extra" && (
        <ExtraFormModal
          initial={modal.item} leadId={lead._id} leadName={lead.name}
          onSaved={doc => setExtras(l => upsert(l, doc))} onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "service" && (
        <ServiceFormModal
          initial={modal.item} leadId={lead._id} leadName={lead.name}
          onSaved={doc => setServices(l => upsert(l, doc))} onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
