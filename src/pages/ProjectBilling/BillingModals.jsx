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

/* Project search, shown when the form is opened outside a project.
   Type a business, client name or phone; every project in the CRM is searched, not only the latest ones. */
const pLabel = (p) => (p.business ? `${p.business} — ${p.name}` : p.name);
function ProjectPicker({ value, onChange }) {
  const [q, setQ]       = useState("");
  const [list, setList] = useState(null);
  const [pick, setPick] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      fetchProjects(q.trim())
        .then(L => live && setList([...L].sort((a, b) => String(a.business || a.name).localeCompare(String(b.business || b.name)))))
        .catch(() => live && setList([]));
    }, q.trim() ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const choose = (p) => { setPick(p); setQ(""); setOpen(false); onChange(p._id, p); };
  return (
    <div className="intg-field bp-pick">
      <label>Project *</label>
      {value && pick ? (
        <div className="bp-chosen">
          <b>{pLabel(pick)}</b>
          <button type="button" className="intg-btn ghost" onClick={() => { setPick(null); onChange("", null); setOpen(true); }}>Change</button>
        </div>
      ) : (
        <>
          <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            placeholder="Search business, client name or phone…" aria-label="Search project" autoComplete="off" />
          {open && (
            <div className="bp-list">
              {list == null ? <div className="bp-empty">Loading…</div>
                : !list.length ? <div className="bp-empty">No project matches “{q}”</div>
                : list.slice(0, 60).map(p => (
                  <button type="button" key={p._id} onClick={() => choose(p)}>
                    <b>{p.business || p.name}</b>{p.business && p.name !== p.business && <span>{p.name}</span>}
                  </button>
                ))}
            </div>
          )}
        </>
      )}
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
    types:         initial?.types?.length ? initial.types : [initial?.type || "Google Ads"],
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

  // several types can be picked, e.g. Google Ads + Meta Ads; the name follows them until it is typed by hand
  const autoName = (L) => L.filter(t => t !== "Other").join(" + ");
  const toggleType = (t) => {
    const on = form.types.includes(t);
    if (on && form.types.length === 1) return;          // keep at least one
    const L = on ? form.types.filter(x => x !== t) : SERVICE_TYPES.filter(x => x === t || form.types.includes(x));
    const typed = form.name && form.name !== autoName(form.types) && !SERVICE_TYPES.includes(form.name);
    set({ types: L, ...(typed ? {} : { name: autoName(L) }) });
  };

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
        <label>Type <span className="bp-hint">(pick one or more)</span></label>
        <div className="intg-cat-grid">
          {SERVICE_TYPES.map(t => (
            <button type="button" key={t} aria-pressed={form.types.includes(t)} className={`intg-cat-btn${form.types.includes(t) ? " active" : ""}`} onClick={() => toggleType(t)}>{form.types.includes(t) ? "✓ " : ""}{t}</button>
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
