import { useEffect, useState } from "react";
import { X, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "../../utils/toast";
import { api, API, CATEGORIES, CATEGORY_META, STATUS_META } from "./integrationMeta";

const toDateInput = (d) => (d ? String(d).slice(0, 10) : "");
const secretRows = (labels) => labels.map(label => ({ label, value: "", hasValue: false }));

/**
 * Add / edit one integration of a project.
 * Opened from a project's Integrations tab (leadId given), or from the
 * Integrations page without a leadId — then the user picks the project here.
 */
export default function IntegrationFormModal({ initial, leadId, leadName, onSaved, onClose }) {
  const editing = !!initial?._id;
  const [form, setForm] = useState(() => ({
    service:      initial?.service || "",
    category:     initial?.category || "Payment",
    accountOwner: initial?.accountOwner || "client",
    mode:         initial?.mode || "live",
    status:       initial?.status || "pending",
    loginUrl:     initial?.loginUrl || "",
    username:     initial?.username || "",
    cost:         initial?.cost || "",
    billingCycle: initial?.billingCycle || "",
    renewalDate:  toDateInput(initial?.renewalDate),
    notes:        initial?.notes || "",
  }));
  const [secrets, setSecrets] = useState(() =>
    editing
      ? (initial.secrets || []).map(s => ({ _id: s._id, label: s.label, value: "", hasValue: s.hasValue }))
      : secretRows(CATEGORY_META.Payment.secrets)
  );
  const [showValues, setShowValues] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickProject = !editing && !leadId;
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects]   = useState([]);

  useEffect(() => {
    if (!pickProject) return;
    const token = localStorage.getItem("nnc_token");
    fetch(`${API}/api/leads?limit=200`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(json => {
        const list = (json.data || []).map(l => ({ _id: l._id || l.id, name: l.name, business: l.business || l.company || "" }));
        setProjects(list.sort((a, b) => String(a.name).localeCompare(String(b.name))));
      })
      .catch(() => toast.error("Could not load projects"));
  }, [pickProject]);

  const set =(k, v) => setForm(f => ({ ...f, [k]: v }));

  // New integration: switching category swaps in that category's usual secret fields,
  // as long as nothing has been typed into them yet
  const changeCategory = (cat) => {
    set("category", cat);
    if (!editing && secrets.every(s => !s.value)) setSecrets(secretRows(CATEGORY_META[cat].secrets));
  };

  const setSecret = (i, k, v) => setSecrets(list => list.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));

  const save = async (e) => {
    e.preventDefault();
    if (pickProject && !projectId) return toast.warning("Select a project");
    if (!form.service.trim()) return toast.warning("Service name is required");
    setSaving(true);
    try {
      const body = {
        ...form,
        lead: leadId || projectId,
        cost: form.cost === "" ? 0 : Number(form.cost),
        renewalDate: form.renewalDate || null,
        // Blank value on an existing secret = keep the stored one
        secrets: secrets
          .filter(s => s.label.trim())
          .map(s => ({ ...(s._id ? { _id: s._id } : {}), label: s.label.trim(), value: s.value })),
      };
      const json = editing
        ? await api(`/${initial._id}`, { method: "PUT", body })
        : await api("", { method: "POST", body });
      toast.success(editing ? "Integration updated" : "Integration added");
      onSaved(json.data, projects.find(p => p._id === projectId));
      onClose();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally { setSaving(false); }
  };

  const suggestions = CATEGORY_META[form.category]?.services || [];

  return (
    <div className="intg-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="intg-modal" onSubmit={save} role="dialog" aria-modal="true" aria-label="Integration">
        <div className="intg-modal-head">
          <div>
            <div className="intg-modal-title">{editing ? "Edit Integration" : "Add Integration"}</div>
            {leadName && <div className="intg-modal-sub">Project: {leadName}</div>}
          </div>
          <button type="button" className="intg-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="intg-modal-body">
          {pickProject && (
            <div className="intg-field">
              <label>Project *</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} required>
                <option value="">{projects.length ? "Select a project…" : "Loading projects…"}</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}{p.business ? ` — ${p.business}` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <div className="intg-field">
            <label>Type</label>
            <div className="intg-cat-grid">
              {CATEGORIES.map(c => (
                <button
                  type="button"
                  key={c}
                  className={`intg-cat-btn${form.category === c ? " active" : ""}`}
                  onClick={() => changeCategory(c)}
                >
                  <span>{CATEGORY_META[c].icon}</span> {c}
                </button>
              ))}
            </div>
          </div>

          <div className="intg-grid">
            <div className="intg-field">
              <label>Service *</label>
              <input list="intg-service-list" value={form.service} onChange={e => set("service", e.target.value)} placeholder={suggestions[0] ? `e.g. ${suggestions[0]}` : "Service name"} />
              <datalist id="intg-service-list">{suggestions.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="intg-field">
              <label>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
            <div className="intg-field">
              <label>Account owner</label>
              <select value={form.accountOwner} onChange={e => set("accountOwner", e.target.value)}>
                <option value="client">Client's account</option>
                <option value="nnc">NNC's account</option>
              </select>
            </div>
            <div className="intg-field">
              <label>Mode</label>
              <select value={form.mode} onChange={e => set("mode", e.target.value)}>
                <option value="live">Live</option>
                <option value="test">Test / Sandbox</option>
              </select>
            </div>
            <div className="intg-field">
              <label>Login / dashboard URL</label>
              <input value={form.loginUrl} onChange={e => set("loginUrl", e.target.value)} placeholder="https://dashboard.razorpay.com" />
            </div>
            <div className="intg-field">
              <label>Login ID / email</label>
              <input value={form.username} onChange={e => set("username", e.target.value)} placeholder="client@company.com" />
            </div>
          </div>

          <div className="intg-field">
            <div className="intg-secret-head">
              <label>Keys &amp; passwords <span className="intg-hint">— encrypted, hidden until revealed</span></label>
              <button type="button" className="intg-icon-btn" onClick={() => setShowValues(v => !v)} title={showValues ? "Hide typing" : "Show typing"}>
                {showValues ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {secrets.map((s, i) => (
              <div key={s._id || `new-${i}`} className="intg-secret-row">
                <input className="intg-secret-label" value={s.label} onChange={e => setSecret(i, "label", e.target.value)} placeholder="Name, e.g. Key Secret" />
                <input
                  type={showValues ? "text" : "password"}
                  autoComplete="new-password"
                  value={s.value}
                  onChange={e => setSecret(i, "value", e.target.value)}
                  placeholder={s.hasValue ? "•••••• saved — leave blank to keep" : "Value"}
                />
                <button type="button" className="intg-icon-btn danger" onClick={() => setSecrets(list => list.filter((_, idx) => idx !== i))} title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="intg-link" onClick={() => setSecrets(list => [...list, { label: "", value: "", hasValue: false }])}>
              <Plus size={13} /> Add field
            </button>
          </div>

          <div className="intg-grid">
            <div className="intg-field">
              <label>Cost (₹)</label>
              <input type="number" min="0" value={form.cost} onChange={e => set("cost", e.target.value)} placeholder="0" />
            </div>
            <div className="intg-field">
              <label>Billing</label>
              <select value={form.billingCycle} onChange={e => set("billingCycle", e.target.value)}>
                <option value="">Free / not set</option>
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="intg-field">
              <label>Renewal / expiry date</label>
              <input type="date" value={form.renewalDate} onChange={e => set("renewalDate", e.target.value)} />
            </div>
          </div>

          <div className="intg-field">
            <label>Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="e.g. Webhook URL: https://site.com/api/payment/callback" />
          </div>
        </div>

        <div className="intg-modal-foot">
          <button type="button" className="intg-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="intg-btn primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Integration"}
          </button>
        </div>
      </form>
    </div>
  );
}
