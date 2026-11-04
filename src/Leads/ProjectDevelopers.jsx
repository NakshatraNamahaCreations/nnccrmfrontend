import { useCallback, useEffect, useState } from "react";
import { Code2, Pencil, Check, X } from "lucide-react";
import { toast } from "../utils/toast";
import { billingApi, canEditBilling } from "../pages/ProjectBilling/billingMeta";

/** Developers assigned to one project — shown at the top of the drawer's Profile tab */
export default function ProjectDevelopers({ lead }) {
  const [assigned, setAssigned] = useState([]);
  const [all, setAll]           = useState(null); // loaded when editing
  const [picked, setPicked]     = useState([]);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const canEdit = canEditBilling();

  const load = useCallback(async () => {
    try {
      const json = await billingApi(`/developers?lead=${lead._id}`);
      setAssigned(json.data || []);
    } catch { setAssigned([]); }
  }, [lead._id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = async () => {
    setPicked(assigned.map(d => d._id));
    setEditing(true);
    if (!all) {
      try {
        const json = await billingApi("/developers");
        setAll(json.data || []);
      } catch (err) { toast.error(err.message || "Could not load developers"); }
    }
  };

  const toggle = (id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const save = async () => {
    setSaving(true);
    try {
      await billingApi(`/developers/project/${lead._id}`, { method: "PUT", body: { developerIds: picked } });
      toast.success("Developers updated");
      setEditing(false);
      setAll(null); // project counts changed
      load();
    } catch (err) { toast.error(err.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const options = (all || []).filter(d => d.isActive || picked.includes(d._id));

  return (
    <div className="pdev">
      <div className="pdev-head">
        <span className="pdev-title"><Code2 size={14} /> Developers</span>
        {canEdit && !editing && (
          <button type="button" className="pdev-btn" onClick={startEdit}><Pencil size={12} /> {assigned.length ? "Change" : "Assign"}</button>
        )}
        {editing && (
          <span className="pdev-acts">
            <button type="button" className="pdev-btn" onClick={() => setEditing(false)}><X size={12} /> Cancel</button>
            <button type="button" className="pdev-btn primary" onClick={save} disabled={saving}><Check size={12} /> {saving ? "Saving…" : "Save"}</button>
          </span>
        )}
      </div>

      {!editing && (
        assigned.length === 0
          ? <div className="pdev-empty">No developer assigned yet.</div>
          : (
            <div className="pdev-list">
              {assigned.map(d => (
                <span key={d._id} className="pdev-chip" title={[d.phone, d.email].filter(Boolean).join(" · ")}>
                  <strong>{d.name}</strong> · {d.role}
                </span>
              ))}
            </div>
          )
      )}

      {editing && (
        all == null ? <div className="pdev-empty">Loading…</div>
          : options.length === 0 ? <div className="pdev-empty">No developers yet — add them in Employee Portal → Add employee.</div>
          : (
            <div className="pdev-pick">
              {options.map(d => (
                <label key={d._id} className={`pdev-opt${picked.includes(d._id) ? " on" : ""}`}>
                  <input type="checkbox" checked={picked.includes(d._id)} onChange={() => toggle(d._id)} />
                  <span><strong>{d.name}</strong> · {d.role}</span>
                  <span className="pdev-load">{d.activeProjects} active</span>
                </label>
              ))}
            </div>
          )
      )}
    </div>
  );
}
