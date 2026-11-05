import { useState } from "react";
import { X } from "lucide-react";
import { billingApi } from "../ProjectBilling/billingMeta";
import { toast } from "../../utils/toast";
import { ph10, fd, STL, TODAY } from "./leadData";

// Add a lead by hand (phone call, walk-in, referral). It is saved as an enquiry, same as All Leads.
const SOURCES = ["Phone Call", "Walk-In", "Referral", "WhatsApp", "Website", "Google Ads", "Instagram", "JustDial"];
const BRANCHES = ["Bangalore", "Mysore", "Mumbai"];
const SERVICES = ["Website Dev", "E-Commerce", "Mobile App Dev", "Custom Software", "SEO", "Google Ads", "Social Media Promotions", "Corporate Ad Film", "Animation 2D/3D", "Logo & Branding", "UI/UX Design", "Photography/Videography"];

export default function AddLead({ rows, owners, by, onClose, onSaved }) {
  const [phone, setPhone] = useState("");
  const [svc, setSvc] = useState([]);
  const [busy, setBusy] = useState(false);
  const dg = ph10(phone);
  const same = dg.length === 10 ? rows.filter(r => ph10(r.phone) === dg) : [];

  const submit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (dg.length !== 10) { toast.error("Enter a 10 digit mobile number"); return; }
    setBusy(true);
    try {
      const j = await billingApi("/enquiries", { method: "POST", body: {
        name: d.name.trim(), phone: phone.trim(), email: d.email.trim(), company: d.company.trim(), branch: d.branch, source: d.source,
        services: svc, budgetMin: Number(d.bmin) || 0, budgetMax: Number(d.bmax) || 0, requirements: d.req.trim(),
        assignedTo: d.owner === "Unassigned" ? "" : d.owner, status: "new", followUpDate: d.nf || null, createdBy: by,
      } });
      toast.success(`${d.name.trim()} added${d.owner && d.owner !== "Unassigned" ? ` for ${d.owner}` : ""}`);
      onSaved(String(j.data._id));
    } catch (ex) { toast.error(ex.message || "Could not add the lead"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="lt-scrim" onClick={onClose} />
      <div className="lt-modal" role="dialog" aria-modal="true" aria-label="Add a lead">
        <div className="mh"><b>Add a lead</b><button type="button" className="lt-xb" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <form className="mb" onSubmit={submit}>
          <div className="lt-g2">
            <div className="lt-f"><label htmlFor="al1">Name</label><input id="al1" name="name" required autoFocus /></div>
            <div className="lt-f"><label htmlFor="al2">Mobile</label><input id="al2" name="phone" required inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="98450 12345" /></div>
          </div>
          {same.length > 0 && (
            <div className="lt-box bl" style={{ marginTop: 0 }}>This number is already here: {same.map(r => <b key={r.id} style={{ fontWeight: 500 }}>{r.name} ({STL[r.st]}, {fd(r.created)}) </b>)}. You can still add it as a new enquiry.</div>
          )}
          <div className="lt-g2">
            <div className="lt-f"><label htmlFor="al3">Company</label><input id="al3" name="company" /></div>
            <div className="lt-f"><label htmlFor="al4">Email</label><input id="al4" name="email" type="email" /></div>
          </div>
          <div className="lt-g3">
            <div className="lt-f"><label htmlFor="al5">Branch</label><select id="al5" name="branch">{BRANCHES.map(b => <option key={b}>{b}</option>)}</select></div>
            <div className="lt-f"><label htmlFor="al6">Source</label><select id="al6" name="source">{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="lt-f"><label htmlFor="al7">Owner</label><select id="al7" name="owner" defaultValue={owners.find(o => o !== "Unassigned") || "Unassigned"}>{[...new Set([...owners, "Unassigned"])].map(o => <option key={o}>{o}</option>)}</select></div>
          </div>
          <div className="lt-f"><span className="lt-flabel">Service</span>
            <div className="lt-chips">{SERVICES.map(s => <button type="button" key={s} className={`lt-chip ${svc.includes(s) ? "on" : ""}`} aria-pressed={svc.includes(s)} onClick={() => setSvc(L => (L.includes(s) ? L.filter(x => x !== s) : [...L, s]))}>{s}</button>)}</div></div>
          <div className="lt-g3">
            <div className="lt-f"><label htmlFor="al8">Budget from (₹)</label><input id="al8" name="bmin" type="number" min="0" step="5000" /></div>
            <div className="lt-f"><label htmlFor="al9">Budget up to (₹)</label><input id="al9" name="bmax" type="number" min="0" step="5000" /></div>
            <div className="lt-f"><label htmlFor="al10">First follow-up</label><input id="al10" name="nf" type="date" min={TODAY()} defaultValue={TODAY()} /></div>
          </div>
          <div className="lt-f"><label htmlFor="al11">What they need</label><textarea id="al11" name="req" style={{ minHeight: 70 }} placeholder="6 page website for a clinic, wants it in 3 weeks" /></div>
          <p className="lt-note">Saved to Enquiries, the same as All Leads. If you add an email, the client gets the usual thank-you email.</p>
          <div className="lt-row"><button className="lt-btn p" disabled={busy}>{busy ? "Saving…" : "Save lead"}</button><button type="button" className="lt-btn" onClick={onClose}>Cancel</button></div>
        </form>
      </div>
    </>
  );
}
