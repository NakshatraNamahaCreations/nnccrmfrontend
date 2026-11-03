import { useCallback, useEffect, useState } from "react";
import { Plus, Eye, EyeOff, Copy, Check, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "../../utils/toast";
import IntegrationFormModal from "./IntegrationFormModal";
import {
  api, canEditIntegrations, CATEGORY_META, STATUS_META, BILLING_LABEL,
  renewalState, daysLabel, fmtDate, inr,
} from "./integrationMeta";
import "./Integrations.css";

/* One stored secret: masked until revealed (reveal is logged on the server) */
function SecretRow({ integrationId, secret, canReveal }) {
  const [value, setValue]   = useState(null);
  const [busy, setBusy]     = useState(false);
  const [copied, setCopied] = useState(false);

  const reveal = async () => {
    if (value != null) { setValue(null); return; }
    setBusy(true);
    try {
      const json = await api(`/${integrationId}/secrets/${secret._id}/reveal`, { method: "POST" });
      setValue(json.value);
    } catch (err) { toast.error(err.message || "Could not reveal"); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Copy failed"); }
  };

  return (
    <div className="intg-secret-view">
      <span className="intg-secret-name">{secret.label}</span>
      <code className="intg-secret-val">{!secret.hasValue ? "— not set —" : value != null ? value : "••••••••"}</code>
      {secret.hasValue && canReveal && (
        <>
          <button type="button" className="intg-icon-btn" onClick={reveal} disabled={busy} title={value != null ? "Hide" : "Reveal"}>
            {value != null ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          {value != null && (
            <button type="button" className="intg-icon-btn" onClick={copy} title="Copy">
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function IntegrationCard({ item, canEdit, onEdit, onDelete }) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;
  const st   = STATUS_META[item.status] || STATUS_META.pending;
  const ren  = renewalState(item.renewalDate);

  return (
    <div className={`intg-card${ren === "overdue" ? " overdue" : ren === "soon" ? " soon" : ""}`}>
      <div className="intg-card-top">
        <div className="intg-card-icon">{meta.icon}</div>
        <div className="intg-card-main">
          <div className="intg-card-title">
            {item.service}
            <span className={`intg-badge ${st.cls}`}>{st.label}</span>
            {item.mode === "test" && <span className="intg-badge intg-st-test">Test</span>}
          </div>
          <div className="intg-card-sub">
            {item.category} · {item.accountOwner === "nnc" ? "NNC's account" : "Client's account"}
          </div>
        </div>
        {canEdit && (
          <div className="intg-card-acts">
            <button type="button" className="intg-icon-btn" onClick={() => onEdit(item)} title="Edit"><Pencil size={14} /></button>
            <button type="button" className="intg-icon-btn danger" onClick={() => onDelete(item)} title="Delete"><Trash2 size={14} /></button>
          </div>
        )}
      </div>

      {(item.loginUrl || item.username) && (
        <div className="intg-card-row">
          {item.username && <span>👤 {item.username}</span>}
          {item.loginUrl && (
            <a href={/^https?:\/\//i.test(item.loginUrl) ? item.loginUrl : `https://${item.loginUrl}`} target="_blank" rel="noreferrer noopener">
              Open dashboard <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {item.secrets?.length > 0 && (
        <div className="intg-secrets">
          {item.secrets.map(s => <SecretRow key={s._id} integrationId={item._id} secret={s} canReveal={canEdit} />)}
        </div>
      )}

      {(item.cost > 0 || item.renewalDate) && (
        <div className="intg-card-row">
          {item.cost > 0 && <span>💰 {inr(item.cost)} {BILLING_LABEL[item.billingCycle] || ""}</span>}
          {item.renewalDate && (
            <span className={`intg-renew ${ren}`}>
              🔁 Renews {fmtDate(item.renewalDate)} ({daysLabel(item.renewalDate)})
            </span>
          )}
        </div>
      )}

      {item.notes && <div className="intg-card-notes">{item.notes}</div>}
    </div>
  );
}

/** "Integrations" tab inside a project (lead) drawer */
export default function ProjectIntegrations({ lead }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [modal, setModal]     = useState(null); // null | {} (new) | item (edit)
  const canEdit = canEditIntegrations();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const json = await api(`?lead=${lead._id}`);
      setItems(json.data || []);
    } catch (err) {
      setError(err.status === 403 ? "You don't have access to integrations." : err.message);
    } finally { setLoading(false); }
  }, [lead._id]);

  useEffect(() => { load(); }, [load]);

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.service} from this project? Its stored keys will be deleted too.`)) return;
    try {
      await api(`/${item._id}`, { method: "DELETE" });
      setItems(list => list.filter(x => x._id !== item._id));
      toast.success("Integration deleted");
    } catch (err) { toast.error(err.message || "Delete failed"); }
  };

  const saved = (doc) =>
    setItems(list => (list.some(x => x._id === doc._id) ? list.map(x => (x._id === doc._id ? doc : x)) : [doc, ...list]));

  return (
    <div className="intg-tab">
      <div className="intg-tab-head">
        <div>
          <div className="intg-tab-title">Credential Vault</div>
          <div className="intg-tab-sub">Payment gateways, SMS, hosting, domains and other services used in this project</div>
        </div>
        {canEdit && (
          <button type="button" className="intg-btn primary" onClick={() => setModal({})}>
            <Plus size={14} /> Add Integration
          </button>
        )}
      </div>

      {loading && <div className="intg-empty">Loading…</div>}
      {!loading && error && <div className="intg-empty error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="intg-empty">
          No integrations yet.{canEdit && " Click “Add Integration” to record Razorpay, SMS, hosting, domain…"}
        </div>
      )}

      <div className="intg-card-list">
        {items.map(item => (
          <IntegrationCard key={item._id} item={item} canEdit={canEdit} onEdit={setModal} onDelete={remove} />
        ))}
      </div>

      {modal && (
        <IntegrationFormModal
          initial={modal._id ? modal : null}
          leadId={lead._id}
          leadName={lead.name}
          onSaved={saved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
