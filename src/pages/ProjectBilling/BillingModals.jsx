import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "../../utils/toast";
import GstPicker from "../../Leads/GstPicker";
import {
  billingApi, fetchProjects, PAYMENT_MODES, EXTRA_STATUS, SERVICE_TYPES,
  today, toDateInput, monthLabel,
} from "./billingMeta";
import { inr } from "../../Leads/gst";
import "../Integrations/Integrations.css";
import "./ProjectBilling.css";

function Modal({ title, sub, onClose, onSubmit, saving, submitLabel, children }) {
  return (
    <div className="intg-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="intg-modal bill-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label={title}>
        <div className="intg-modal-head">
          <div>
            <div className="intg-modal-title">{title}</div>
            {sub && <div className="intg-modal-sub">{sub}</div>}
          </div>
          <button type="button" className="intg-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="intg-modal-body">{children}</div>
        <div className="intg-modal-foot">
          <button type="button" className="intg-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="intg-btn primary" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

/* Project dropdown, shown when the form is opened outside a project */
function ProjectPicker({ value, onChange }) {
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => toast.error("Could not load projects"));
  }, []);
  return (
    <div className="intg-field">
      <label>Project *</label>
      <select value={value} onChange={e => onChange(e.target.value, projects.find(p => p._id === e.target.value))} required>
        <option value="">{projects.length ? "Select a project…" : "Loading projects…"}</option>
        {projects.map(p => <option key={p._id} value={p._id}>{p.name}{p.business ? ` — ${p.business}` : ""}</option>)}
      </select>
    </div>
  );
}

/* ── Additional work: add / edit ─────────────────────────────────────────── */
export function ExtraFormModal({ initial, leadId, leadName, onSaved, onClose }) {
  const editing = !!initial?._id;
  const pickProject = !editing && !leadId;
  const [projectId, setProjectId] = useState("");
  const [project, setProject]     = useState(null);
  const [form, setForm] = useState(() => ({
    title:         initial?.title || "",
    description:   initial?.description || "",
    amount:        initial?.amount ?? "",
    gstApplicable: initial?.gstApplicable ?? false,
    gstRate:       initial?.gstRate ?? 18,
    status:        initial?.status || "quoted",
    requestedDate: toDateInput(initial?.requestedDate) || today(),
  }));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    if (pickProject && !projectId) return toast.warning("Select a project");
    if (!form.title.trim()) return toast.warning("Title is required");
    setSaving(true);
    try {
      const body = { ...form, lead: leadId || projectId, amount: Number(form.amount) || 0 };
      const json = editing
        ? await billingApi(`/project-extras/${initial._id}`, { method: "PUT", body })
        : await billingApi("/project-extras", { method: "POST", body });
      toast.success(editing ? "Updated" : "Additional work added");
      onSaved(json.data, project);
      onClose();
    } catch (err) { toast.error(err.message || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={editing ? "Edit Additional Work" : "Add Additional Work"}
      sub={leadName ? `Project: ${leadName}` : "Changes or new work after the original deal"}
      onClose={onClose} onSubmit={save} saving={saving} submitLabel={editing ? "Save" : "Add"}
    >
      {pickProject && <ProjectPicker value={projectId} onChange={(id, p) => { setProjectId(id); setProject(p); }} />}
      <div className="intg-field">
        <label>Work *</label>
        <input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Add blog page, payment gateway, redesign home page" autoFocus />
      </div>
      <div className="intg-field">
        <label>Details</label>
        <textarea rows={2} value={form.description} onChange={e => set({ description: e.target.value })} placeholder="What the client asked for" />
      </div>
      <div className="intg-grid">
        <div className="intg-field">
          <label>Amount (before GST)</label>
          <input type="number" min="0" value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder="0" />
        </div>
        <div className="intg-field">
          <label>Requested on</label>
          <input type="date" value={form.requestedDate} onChange={e => set({ requestedDate: e.target.value })} />
        </div>
      </div>
      <GstPicker value={form.amount} gstApplicable={form.gstApplicable} gstRate={form.gstRate} onChange={set} />
      <div className="intg-field">
        <label>Status</label>
        <select value={form.status} onChange={e => set({ status: e.target.value })}>
          {Object.entries(EXTRA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
    </Modal>
  );
}

/* ── Monthly service: add / edit ─────────────────────────────────────────── */
export function ServiceFormModal({ initial, leadId, leadName, onSaved, onClose }) {
  const editing = !!initial?._id;
  const [projectId, setProjectId] = useState("");
  const [project, setProject]     = useState(null);
  const [form, setForm] = useState(() => ({
    name:          initial?.name || "",
    type:          initial?.type || "Google Ads",
    amount:        initial?.amount ?? "",
    gstApplicable: initial?.gstApplicable ?? false,
    gstRate:       initial?.gstRate ?? 18,
    billingDay:    initial?.billingDay ?? 5,
    startDate:     toDateInput(initial?.startDate) || today(),
    endDate:       toDateInput(initial?.endDate),
    notes:         initial?.notes || "",
  }));
  const [saving, setSaving] = useState(false);
  const pickProject = !editing && !leadId;
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const changeType = (type) =>
    set({ type, ...(!form.name || SERVICE_TYPES.includes(form.name) ? { name: type === "Other" ? "" : type } : {}) });

  const save = async (e) => {
    e.preventDefault();
    if (pickProject && !projectId) return toast.warning("Select a project");
    if (!form.name.trim()) return toast.warning("Service name is required");
    if (!form.startDate) return toast.warning("Start date is required");
    setSaving(true);
    try {
      const body = {
        ...form,
        lead: leadId || projectId,
        amount: Number(form.amount) || 0,
        endDate: form.endDate || null,
      };
      const json = editing
        ? await billingApi(`/recurring-services/${initial._id}`, { method: "PUT", body })
        : await billingApi("/recurring-services", { method: "POST", body });
      toast.success(editing ? "Service updated" : "Monthly service added");
      onSaved(json.data, project);
      onClose();
    } catch (err) { toast.error(err.message || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={editing ? "Edit Monthly Service" : "Add Monthly Service"}
      sub={leadName ? `Project: ${leadName}` : "Billed to the client every month"}
      onClose={onClose} onSubmit={save} saving={saving} submitLabel={editing ? "Save" : "Add"}
    >
      {pickProject && <ProjectPicker value={projectId} onChange={(id, p) => { setProjectId(id); setProject(p); }} />}
      <div className="intg-field">
        <label>Type</label>
        <div className="intg-cat-grid">
          {SERVICE_TYPES.map(t => (
            <button type="button" key={t} className={`intg-cat-btn${form.type === t ? " active" : ""}`} onClick={() => changeType(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="intg-field">
        <label>Service name *</label>
        <input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Google Ads Management" />
      </div>
      <div className="intg-grid">
        <div className="intg-field">
          <label>Monthly amount (before GST)</label>
          <input type="number" min="0" value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder="0" />
        </div>
        <div className="intg-field">
          <label>Bill on day <span className="intg-hint">(1–28 of each month)</span></label>
          <input type="number" min="1" max="28" value={form.billingDay} onChange={e => set({ billingDay: e.target.value })} />
        </div>
      </div>
      <GstPicker value={form.amount} gstApplicable={form.gstApplicable} gstRate={form.gstRate} onChange={set} />
      <div className="intg-grid">
        <div className="intg-field">
          <label>Start date *</label>
          <input type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value })} />
        </div>
        <div className="intg-field">
          <label>End date <span className="intg-hint">(blank = ongoing)</span></label>
          <input type="date" value={form.endDate} onChange={e => set({ endDate: e.target.value })} />
        </div>
      </div>
      <div className="intg-field">
        <label>Notes</label>
        <textarea rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Ad budget paid by client separately, scope, etc." />
      </div>
    </Modal>
  );
}

/*
 * Record a payment.
 *   kind "extra"   → payment against one additional-work item
 *   kind "service" → payment for one month of a monthly service (or skip that month)
 */
export function PaymentModal({ kind, item, period, suggested, onSaved, onClose }) {
  const [form, setForm] = useState({
    amount: suggested || "", date: today(), mode: "UPI", reference: "", note: "", waived: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.waived && !(Number(form.amount) > 0)) return toast.warning("Enter the amount received");
    setSaving(true);
    try {
      const path = kind === "extra" ? `/project-extras/${item._id}/payments` : `/recurring-services/${item._id}/payments`;
      const json = await billingApi(path, { method: "POST", body: { ...form, amount: Number(form.amount) || 0, period } });
      toast.success(form.waived ? `${monthLabel(period)} marked as skipped` : "Payment recorded");
      onSaved(json.data);
      onClose();
    } catch (err) { toast.error(err.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const name = kind === "extra" ? item.title : `${item.name} — ${monthLabel(period)}`;

  return (
    <Modal title="Record Payment" sub={`${name} · balance ${inr(suggested)}`} onClose={onClose} onSubmit={save} saving={saving} submitLabel="Save">
      {kind === "service" && (
        <label className="bill-check">
          <input type="checkbox" checked={form.waived} onChange={e => set({ waived: e.target.checked })} />
          Skip this month (not billed — e.g. service paused)
        </label>
      )}
      {!form.waived && (
        <>
          <div className="intg-grid">
            <div className="intg-field">
              <label>Amount received *</label>
              <input type="number" min="0" value={form.amount} onChange={e => set({ amount: e.target.value })} autoFocus />
            </div>
            <div className="intg-field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set({ date: e.target.value })} />
            </div>
          </div>
          <div className="intg-grid">
            <div className="intg-field">
              <label>Mode</label>
              <select value={form.mode} onChange={e => set({ mode: e.target.value })}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="intg-field">
              <label>UTR / Reference</label>
              <input value={form.reference} onChange={e => set({ reference: e.target.value })} />
            </div>
          </div>
        </>
      )}
      <div className="intg-field">
        <label>Note</label>
        <input value={form.note} onChange={e => set({ note: e.target.value })} />
      </div>
    </Modal>
  );
}
