import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, FileText, RefreshCcw, Search, Eye, Edit2, ArrowRightCircle,
  Trash2, ChevronLeft, ChevronRight, X, Check, Settings, Building2,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { toast } from "../../utils/toast";
import InvoicePreview, { OFFICES } from "./InvoicePreview";
import { ShimmerTable, BtnSpinner } from "../../components/ui/Shimmer";
import "./AccountingPage.css";

const API = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";
function auth() { const t = localStorage.getItem("nnc_token"); return t ? { Authorization: `Bearer ${t}` } : {}; }

/* ── Constants ──────────────────────────────────────────────── */
/* ── Service catalog ─────────────────────────────────────────── */
const SERVICE_CATALOG = [
  { label: "Website Development",         description: "Custom website design and development",                              hsn: "998314" },
  { label: "Website Redesign",            description: "Redesign and revamp of existing website",                           hsn: "998314" },
  { label: "E-Commerce Website",          description: "E-commerce website with product catalog and payment integration",   hsn: "998314" },
  { label: "Landing Page Design",         description: "Single-page landing / marketing website design",                    hsn: "998314" },
  { label: "Website Maintenance",         description: "Monthly website maintenance and technical support",                 hsn: "998314" },
  { label: "Domain & Hosting",            description: "Domain registration and web hosting services",                      hsn: "998315" },
  { label: "SEO Services",               description: "Search engine optimisation (SEO) services",                         hsn: "998361" },
  { label: "Google Ads / PPC",            description: "Google Ads campaign setup and management",                          hsn: "998361" },
  { label: "Digital Marketing Package",   description: "Comprehensive digital marketing services package",                  hsn: "998361" },
  { label: "Social Media Management",     description: "Social media account management and content creation",              hsn: "998366" },
  { label: "Email Marketing",             description: "Email campaign design, setup and management",                       hsn: "998366" },
  { label: "Content Writing",             description: "Website content writing and copywriting services",                  hsn: "998390" },
  { label: "Logo Design",                 description: "Professional logo and brand identity design",                       hsn: "998383" },
  { label: "Graphic Design",              description: "Graphic design and creative services",                              hsn: "998383" },
  { label: "Photography / Videography",   description: "Professional photography and videography services",                 hsn: "999612" },
  { label: "Custom",                      description: "",                                                                   hsn: ""       },
];

const DEFAULT_TERMS =
  `1. Payment is due within 30 days of invoice date.\n` +
  `2. This invoice is valid for the services listed above only.\n` +
  `3. Please quote the invoice number in all correspondence.\n` +
  `4. Cheques to be drawn in favour of "Nakshatra Namaha Creations".\n` +
  `5. Subject to local jurisdiction.`;

const DEFAULT_BANK = {
  accountName: "Nakshatra Namaha Creations",
  accountNumber: "",
  bankName: "",
  ifscCode: "",
  branchName: "",
  upiId: "",
};

function getStoredBank() {
  try { return JSON.parse(localStorage.getItem("nnc_bank_defaults")) || DEFAULT_BANK; }
  catch { return DEFAULT_BANK; }
}

/* ── Office location persistence (backend-backed; localStorage is a fallback) ─── */
const OFFICE_CACHE_KEY = "nnc_offices";

function mergeWithDefaults(saved) {
  return Object.fromEntries(
    Object.keys(OFFICES).map(k => [k, { ...OFFICES[k], ...(saved?.[k] || {}) }])
  );
}

/* Initial value used by useState — synchronous, reads cache so the UI doesn't flash. */
function getCachedOffices() {
  try {
    const saved = JSON.parse(localStorage.getItem(OFFICE_CACHE_KEY));
    return mergeWithDefaults(saved);
  } catch { return { ...OFFICES }; }
}

async function fetchOfficesFromAPI() {
  const res  = await fetch(`${API}/api/offices`, { headers: auth() });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load offices");
  return mergeWithDefaults(json.data);
}

async function updateOfficeOnAPI(key, draft) {
  const res = await fetch(`${API}/api/offices/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...auth() },
    body:    JSON.stringify(draft),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Save failed");
  return mergeWithDefaults(json.data);
}

function cacheOffices(data) {
  try { localStorage.setItem(OFFICE_CACHE_KEY, JSON.stringify(data)); } catch (_) {}
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function makeEmptyForm(type) {
  return {
    type,
    officeLocation: "Bangalore",
    clientName: "", clientBusiness: "", clientAddress: "",
    clientCity: "", clientState: "", clientPincode: "",
    clientPhone: "", clientEmail: "", clientGST: "", clientPAN: "",
    invoiceDate: todayStr(),
    validUntil: type === "proforma" ? addDays(30) : "",
    dueDate:    type === "tax"      ? addDays(30) : "",
    items: [{ serviceKey: "", description: "", hsn: "", quantity: 1, rate: "", amount: 0 }],
    discountPct: 0, discountAmt: 0, useIGST: false,
    cgstPct: 9, sgstPct: 9, igstPct: 18,
    subtotal: 0, taxableAmount: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalAmount: 0,
    quotedAmount: 0, finalizedAmount: 0,
    bankDetails: getStoredBank(),
    notes: "", termsAndConditions: DEFAULT_TERMS,
  };
}

function recalc(f) {
  const items = f.items || [];
  const subtotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const discountAmt = f.discountPct > 0
    ? Math.round(subtotal * f.discountPct / 100)
    : (Number(f.discountAmt) || 0);
  const taxableAmount = Math.max(0, subtotal - discountAmt);
  const cgstAmt = f.useIGST ? 0 : Math.round(taxableAmount * (f.cgstPct || 9) / 100);
  const sgstAmt = f.useIGST ? 0 : Math.round(taxableAmount * (f.sgstPct || 9) / 100);
  const igstAmt = f.useIGST ? Math.round(taxableAmount * (f.igstPct || 18) / 100) : 0;
  const totalAmount = taxableAmount + cgstAmt + sgstAmt + igstAmt;
  return { ...f, subtotal, discountAmt, taxableAmount, cgstAmt, sgstAmt, igstAmt, totalAmount };
}

function fmt(n) {
  const v = Number(n) || 0;
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)} Cr`;
  if (v >= 100000)   return `₹${(v/100000).toFixed(2)} L`;
  if (v >= 1000)     return `₹${(v/1000).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}

const STATUS_MAP = {
  draft:     { label: "Draft",     cls: "ac-st-draft"     },
  sent:      { label: "Sent",      cls: "ac-st-sent"      },
  approved:  { label: "Approved",  cls: "ac-st-approved"  },
  converted: { label: "Converted", cls: "ac-st-converted" },
  paid:      { label: "Paid",      cls: "ac-st-paid"      },
  cancelled: { label: "Cancelled", cls: "ac-st-cancelled" },
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function AccountingPage() {
  const [mode,        setMode]        = useState("list"); // list | form | preview
  const [formType,    setFormType]    = useState("proforma");
  const [editingId,   setEditingId]   = useState(null);
  const [convertingId,setConvertingId]= useState(null);
  const [previewInv,  setPreviewInv]  = useState(null);

  const [invoices,    setInvoices]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);

  const [filters, setFilters] = useState({ type: "", status: "", officeLocation: "", search: "" });
  const [form,    setForm]    = useState(() => makeEmptyForm("proforma"));
  const [bankModal,  setBankModal]   = useState(false);
  const [bankDraft,  setBankDraft]   = useState(DEFAULT_BANK);
  const [offices,    setOffices]     = useState(getCachedOffices);
  const [officeEdit, setOfficeEdit]  = useState(null); // null | { key, draft }
  const [officeSaving, setOfficeSaving] = useState(false);
  const [gstLookupStatus, setGstLookupStatus] = useState("idle"); // idle | loading | done | error

  /* ── Fetch list ── */
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.type)           p.set("type",           filters.type);
      if (filters.status)         p.set("status",         filters.status);
      if (filters.officeLocation) p.set("officeLocation", filters.officeLocation);
      if (filters.search)         p.set("search",         filters.search);
      const res  = await fetch(`${API}/api/invoices?${p}`, { headers: auth() });
      const json = await res.json();
      if (json.success) { setInvoices(json.data); setTotal(json.total); }
    } catch (e) { toast.error("Failed to load invoices"); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  /* Load offices from the backend once on mount; cache the result locally
     so the UI is instant on the next page load. Silent on failure — the
     cached/default values are already on screen. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchOfficesFromAPI();
        if (!cancelled) { setOffices(data); cacheOffices(data); }
      } catch (_) { /* keep cached/default values */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Open form ── */
  const openNew = (type) => {
    setFormType(type); setEditingId(null); setConvertingId(null);
    setForm(makeEmptyForm(type)); setMode("form");
  };

  const openEdit = async (inv) => {
    setFormType(inv.type); setEditingId(inv._id); setConvertingId(null);
    const f = {
      ...makeEmptyForm(inv.type),
      ...inv,
      invoiceDate: inv.invoiceDate ? inv.invoiceDate.split("T")[0] : todayStr(),
      validUntil:  inv.validUntil  ? inv.validUntil.split("T")[0]  : "",
      dueDate:     inv.dueDate     ? inv.dueDate.split("T")[0]     : "",
      useIGST: Number(inv.igstAmt) > 0,
    };
    setForm(f); setMode("form");
  };

  const openConvert = async (inv) => {
    setFormType("tax"); setEditingId(null); setConvertingId(inv._id);
    const f = {
      ...makeEmptyForm("tax"),
      ...inv,
      type: "tax",
      invoiceDate: todayStr(),
      dueDate: addDays(30),
      validUntil: "",
      useIGST: Number(inv.igstAmt) > 0,
      quotedAmount: inv.totalAmount,
    };
    setForm(f); setMode("form");
  };

  const openPreview = async (inv) => {
    if (inv._id) {
      try {
        const res  = await fetch(`${API}/api/invoices/${inv._id}`, { headers: auth() });
        const json = await res.json();
        if (json.success) { setPreviewInv(json.data); setMode("preview"); return; }
      } catch (_) {}
    }
    setPreviewInv(inv); setMode("preview");
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!form.clientName.trim()) { toast.error("Client name is required"); return; }
    if (!form.officeLocation)    { toast.error("Select an office location"); return; }
    const hasItems = form.items.some(i => i.description.trim());
    if (!hasItems) { toast.error("Add at least one line item"); return; }

    setSaving(true);
    try {
      let url, method;
      if (convertingId) {
        url = `${API}/api/invoices/${convertingId}/convert`; method = "POST";
      } else if (editingId) {
        url = `${API}/api/invoices/${editingId}`; method = "PUT";
      } else {
        url = `${API}/api/invoices`; method = "POST";
      }
      const res  = await fetch(url, {
        method, headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Save failed");
      /* Save bank defaults to localStorage */
      if (form.bankDetails) localStorage.setItem("nnc_bank_defaults", JSON.stringify(form.bankDetails));
      toast.success(editingId ? "Invoice updated!" : convertingId ? "Tax Invoice created!" : "Invoice created!");
      setMode("list"); fetchInvoices();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  /* ── Delete / Status ── */
  const handleDelete = async (id) => {
    if (!window.confirm("Cancel this invoice?")) return;
    try {
      await fetch(`${API}/api/invoices/${id}`, { method: "DELETE", headers: auth() });
      toast.success("Invoice cancelled");
      fetchInvoices();
    } catch (_) { toast.error("Failed"); }
  };

  const handleStatus = async (id, status) => {
    try {
      await fetch(`${API}/api/invoices/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify({ status }),
      });
      fetchInvoices();
    } catch (_) { toast.error("Failed to update status"); }
  };

  /* ── Item helpers ── */
  const setItem = (idx, field, val) => {
    setForm(f => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it;
        let updated = { ...it, [field]: val };
        /* When a service is picked from the catalog, auto-fill description & HSN */
        if (field === "serviceKey") {
          const svc = SERVICE_CATALOG.find(s => s.label === val);
          updated = { ...updated, description: svc?.description ?? "", hsn: svc?.hsn ?? "" };
        }
        if (field === "quantity" || field === "rate") {
          updated.amount = Math.round((Number(updated.quantity)||0) * (Number(updated.rate)||0));
        }
        if (field === "amount") updated.amount = Number(val) || 0;
        return updated;
      });
      return recalc({ ...f, items });
    });
  };
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { serviceKey:"", description:"", hsn:"", quantity:1, rate:"", amount:0 }] }));
  const removeItem = idx => setForm(f => recalc({ ...f, items: f.items.filter((_,i) => i!==idx) }));

  const setF = (field, val) => setForm(f => recalc({ ...f, [field]: val }));

  /* ── Bank modal save ── */
  const saveBankDefaults = () => {
    localStorage.setItem("nnc_bank_defaults", JSON.stringify(bankDraft));
    setForm(f => ({ ...f, bankDetails: bankDraft }));
    setBankModal(false);
    toast.success("Bank details saved");
  };

  /* ── GSTIN auto-lookup ── */
  const handleGstLookup = async () => {
    const gstin = (form.clientGST || "").trim().toUpperCase();
    if (gstin.length !== 15) { toast.error("Enter a valid 15-character GSTIN"); return; }
    setGstLookupStatus("loading");
    try {
      const res  = await fetch(`${API}/api/gst-lookup/${gstin}`, { headers: auth() });
      const data = await res.json();
      if (!data.success) { toast.error(data.message || "GSTIN lookup failed"); setGstLookupStatus("error"); return; }
      setForm(f => ({
        ...f,
        clientGST:     gstin,
        clientPAN:     data.pan       || f.clientPAN,
        clientState:   data.state     || f.clientState,
        clientBusiness:data.companyName || data.tradeName || f.clientBusiness,
        clientAddress: data.address   || f.clientAddress,
        clientCity:    data.city      || f.clientCity,
        clientPincode: data.pincode   || f.clientPincode,
      }));
      if (data.companyName) {
        toast.success(`Found: ${data.companyName}`);
      } else {
        toast.info
          ? toast.info(`State filled: ${data.state}. Add GST_API_KEY in backend .env for full details.`)
          : toast.success(`State filled: ${data.state}`);
      }
      setGstLookupStatus("done");
    } catch {
      toast.error("Could not reach GST lookup service");
      setGstLookupStatus("error");
    }
  };

  /* ── Office edit modal ── */
  const openOfficeEdit = (key) => {
    setOfficeEdit({ key, draft: { ...offices[key] } });
  };
  const saveOfficeEdit = async () => {
    if (!officeEdit) return;
    setOfficeSaving(true);
    try {
      const updated = await updateOfficeOnAPI(officeEdit.key, officeEdit.draft);
      setOffices(updated);
      cacheOffices(updated);
      setOfficeEdit(null);
      toast.success(`${officeEdit.key} office saved`);
    } catch (e) {
      toast.error(e.message || "Failed to save office");
    } finally {
      setOfficeSaving(false);
    }
  };

  /* ── Render ── */
  if (mode === "preview" && previewInv) {
    return (
      <div className="ac-layout">
        <Sidebar />
        <InvoicePreview invoice={previewInv} offices={offices} onBack={() => setMode("list")} />
      </div>
    );
  }

  return (
    <div className="ac-layout">
      <Sidebar />
      <div className="ac-main">

        {/* ── FORM MODE ───────────────────────────────────── */}
        {mode === "form" && (
          <div className="ac-form-page">
            {/* Form hero */}
            <div className="ac-form-hero">
              <div>
                <div className="ac-form-eyebrow">
                  {convertingId ? "Convert to Tax Invoice" : editingId ? "Edit Invoice" : `New ${formType === "proforma" ? "Proforma" : "Tax"} Invoice`}
                </div>
                <div className="ac-form-title">
                  {form.invoiceNumber || "Invoice will be auto-numbered"}
                </div>
              </div>
              <div className="ac-form-hero-acts">
                <button type="button" className="ac-cancel-btn" onClick={() => setMode("list")}>
                  <X size={14}/> Cancel
                </button>
                <button type="button" className="ac-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? <BtnSpinner /> : <Check size={14}/>}
                  {saving ? "Saving…" : "Save Invoice"}
                </button>
              </div>
            </div>

            <div className="ac-form-body">

              {/* Section: Office selection */}
              <div className="ac-form-section">
                <div className="ac-section-title"><Building2 size={14}/> Office Location</div>
                <div className="ac-office-cards">
                  {Object.entries(offices).map(([key, off]) => (
                    <label key={key} className={`ac-office-card${form.officeLocation===key?" selected":""}`}>
                      <input type="radio" name="office" value={key} checked={form.officeLocation===key}
                        onChange={() => setF("officeLocation", key)} style={{ display:"none" }}/>
                      <div className="ac-office-card-head">
                        <div className="ac-office-city">{key}</div>
                        <button type="button" className="ac-office-edit-btn"
                          onClick={e => { e.preventDefault(); openOfficeEdit(key); }}>
                          <Edit2 size={11}/> Edit
                        </button>
                      </div>
                      <div className="ac-office-name">{off.name}</div>
                      <div className="ac-office-addr">{off.address}</div>
                      <div className="ac-office-addr">{off.city}{off.city && off.state ? ", " : ""}{off.state} {off.pincode}</div>
                      <div className="ac-office-addr">{off.phone}</div>
                      <div className="ac-office-gstin">GSTIN: {off.gstin}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section: Client details */}
              <div className="ac-form-section">
                <div className="ac-section-title"><FileText size={14}/> Client Details</div>
                <div className="ac-form-grid2">
                  <div className="ac-field">
                    <label>Client Name <span className="ac-req">*</span></label>
                    <input value={form.clientName} onChange={e=>setF("clientName",e.target.value)} placeholder="Full name"/>
                  </div>
                  <div className="ac-field">
                    <label>Business / Company</label>
                    <input value={form.clientBusiness} onChange={e=>setF("clientBusiness",e.target.value)} placeholder="Company or brand name"/>
                  </div>
                  <div className="ac-field ac-col-span2">
                    <label>Address</label>
                    <input value={form.clientAddress} onChange={e=>setF("clientAddress",e.target.value)} placeholder="Street address"/>
                  </div>
                  <div className="ac-field">
                    <label>City</label>
                    <input value={form.clientCity} onChange={e=>setF("clientCity",e.target.value)} placeholder="City"/>
                  </div>
                  <div className="ac-field">
                    <label>State</label>
                    <input value={form.clientState} onChange={e=>setF("clientState",e.target.value)} placeholder="State"/>
                  </div>
                  <div className="ac-field">
                    <label>Pincode</label>
                    <input value={form.clientPincode} onChange={e=>setF("clientPincode",e.target.value)} placeholder="Pincode"/>
                  </div>
                  <div className="ac-field">
                    <label>Phone</label>
                    <input value={form.clientPhone} onChange={e=>setF("clientPhone",e.target.value)} placeholder="+91 XXXXX XXXXX"/>
                  </div>
                  <div className="ac-field">
                    <label>Email</label>
                    <input type="email" value={form.clientEmail} onChange={e=>setF("clientEmail",e.target.value)} placeholder="email@example.com"/>
                  </div>
                  <div className="ac-field">
                    <label>GSTIN</label>
                    <div className="ac-gst-row">
                      <input
                        value={form.clientGST}
                        onChange={e => { setF("clientGST", e.target.value.toUpperCase()); setGstLookupStatus("idle"); }}
                        placeholder="27AABCN1234A1ZX"
                        maxLength={15}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className={`ac-gst-verify-btn ${gstLookupStatus}`}
                        onClick={handleGstLookup}
                        disabled={gstLookupStatus === "loading"}
                      >
                        {gstLookupStatus === "loading" ? "..." : gstLookupStatus === "done" ? "✓ Verified" : "Verify & Fill"}
                      </button>
                    </div>
                  </div>
                  <div className="ac-field">
                    <label>PAN</label>
                    <input value={form.clientPAN} onChange={e=>setF("clientPAN",e.target.value)} placeholder="AABCN1234A"/>
                  </div>
                </div>
              </div>

              {/* Section: Dates */}
              <div className="ac-form-section">
                <div className="ac-section-title">Invoice Dates</div>
                <div className="ac-form-grid3">
                  <div className="ac-field">
                    <label>Invoice Date <span className="ac-req">*</span></label>
                    <input type="date" value={form.invoiceDate} onChange={e=>setF("invoiceDate",e.target.value)}/>
                  </div>
                  {form.type === "proforma" && (
                    <div className="ac-field">
                      <label>Valid Until</label>
                      <input type="date" value={form.validUntil} onChange={e=>setF("validUntil",e.target.value)}/>
                    </div>
                  )}
                  {form.type === "tax" && (
                    <div className="ac-field">
                      <label>Due Date</label>
                      <input type="date" value={form.dueDate} onChange={e=>setF("dueDate",e.target.value)}/>
                    </div>
                  )}
                  {convertingId && (
                    <div className="ac-field ac-field-info">
                      <label>Original Proforma Amount</label>
                      <div className="ac-quoted-val">{fmt(form.quotedAmount)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Line items */}
              <div className="ac-form-section">
                <div className="ac-section-title-row">
                  <div className="ac-section-title">Line Items</div>
                  <button type="button" className="ac-add-item-btn" onClick={addItem}><Plus size={13}/> Add Row</button>
                </div>
                <div className="ac-items-wrap">
                  <table className="ac-items-tbl">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description <span className="ac-req">*</span></th>
                        <th>HSN/SAC</th>
                        <th>Qty</th>
                        <th>Rate (₹)</th>
                        <th>Amount (₹)</th>
                        <th/>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, i) => (
                        <tr key={i}>
                          <td className="ac-item-num">{i+1}</td>
                          <td className="ac-item-desc-cell">
                            <select
                              className="ac-item-svc-select"
                              value={item.serviceKey}
                              onChange={e => setItem(i, "serviceKey", e.target.value)}
                            >
                              <option value="">-- Select Service --</option>
                              {SERVICE_CATALOG.map(s => (
                                <option key={s.label} value={s.label}>{s.label}</option>
                              ))}
                            </select>
                            <input
                              className="ac-item-inp full ac-item-desc-inp"
                              value={item.description}
                              onChange={e => setItem(i, "description", e.target.value)}
                              placeholder="Description / additional notes"
                            />
                          </td>
                          <td>
                            <input className="ac-item-inp sm" value={item.hsn}
                              onChange={e=>setItem(i,"hsn",e.target.value)}
                              placeholder="9983"/>
                          </td>
                          <td>
                            <input className="ac-item-inp xs" type="number" min="0" value={item.quantity}
                              onChange={e=>setItem(i,"quantity",e.target.value)}/>
                          </td>
                          <td>
                            <input className="ac-item-inp md" type="number" min="0" value={item.rate}
                              onChange={e=>setItem(i,"rate",e.target.value)}
                              placeholder="0"/>
                          </td>
                          <td>
                            <input className="ac-item-inp md ac-item-amt" type="number" min="0" value={item.amount}
                              onChange={e=>setItem(i,"amount",e.target.value)}/>
                          </td>
                          <td>
                            {form.items.length > 1 && (
                              <button type="button" className="ac-rm-item" onClick={()=>removeItem(i)}>
                                <X size={12}/>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section: Tax & totals */}
              <div className="ac-form-section">
                <div className="ac-section-title">Tax &amp; Totals</div>
                <div className="ac-tax-row">
                  <div className="ac-tax-left">
                    <div className="ac-tax-toggle">
                      <label className="ac-toggle-label">Tax Type:</label>
                      <button type="button"
                        className={`ac-tax-btn${!form.useIGST?" active":""}`}
                        onClick={()=>setF("useIGST",false)}>CGST + SGST</button>
                      <button type="button"
                        className={`ac-tax-btn${form.useIGST?" active":""}`}
                        onClick={()=>setF("useIGST",true)}>IGST</button>
                    </div>
                    <div className="ac-tax-rates">
                      {!form.useIGST ? (
                        <>
                          <div className="ac-field-sm">
                            <label>CGST %</label>
                            <input type="number" value={form.cgstPct}
                              onChange={e=>setF("cgstPct",Number(e.target.value))}/>
                          </div>
                          <div className="ac-field-sm">
                            <label>SGST %</label>
                            <input type="number" value={form.sgstPct}
                              onChange={e=>setF("sgstPct",Number(e.target.value))}/>
                          </div>
                        </>
                      ) : (
                        <div className="ac-field-sm">
                          <label>IGST %</label>
                          <input type="number" value={form.igstPct}
                            onChange={e=>setF("igstPct",Number(e.target.value))}/>
                        </div>
                      )}
                      <div className="ac-field-sm">
                        <label>Discount %</label>
                        <input type="number" min="0" max="100" value={form.discountPct}
                          onChange={e=>setF("discountPct",Number(e.target.value))}/>
                      </div>
                    </div>
                  </div>
                  <div className="ac-totals-preview">
                    <div className="ac-tp-row"><span>Sub Total</span><span>₹{(form.subtotal||0).toLocaleString("en-IN")}</span></div>
                    {form.discountAmt > 0 && <div className="ac-tp-row red"><span>Discount</span><span>−₹{form.discountAmt.toLocaleString("en-IN")}</span></div>}
                    <div className="ac-tp-row"><span>Taxable Amount</span><span>₹{(form.taxableAmount||0).toLocaleString("en-IN")}</span></div>
                    {!form.useIGST && form.cgstAmt > 0 && <div className="ac-tp-row"><span>CGST @{form.cgstPct}%</span><span>₹{form.cgstAmt.toLocaleString("en-IN")}</span></div>}
                    {!form.useIGST && form.sgstAmt > 0 && <div className="ac-tp-row"><span>SGST @{form.sgstPct}%</span><span>₹{form.sgstAmt.toLocaleString("en-IN")}</span></div>}
                    {form.useIGST  && form.igstAmt > 0 && <div className="ac-tp-row"><span>IGST @{form.igstPct}%</span><span>₹{form.igstAmt.toLocaleString("en-IN")}</span></div>}
                    <div className="ac-tp-row total"><span>TOTAL</span><span>₹{(form.totalAmount||0).toLocaleString("en-IN")}</span></div>
                  </div>
                </div>
              </div>

              {/* Section: Bank details */}
              <div className="ac-form-section">
                <div className="ac-section-title-row">
                  <div className="ac-section-title">Bank Details (Payment Info)</div>
                </div>
                <div className="ac-form-grid2">
                  {[
                    ["accountName",   "Account Holder Name", "Nakshatra Namaha Creations"],
                    ["accountNumber", "Account Number",      "XXXXXXXXXXXX"],
                    ["bankName",      "Bank Name",           "HDFC Bank"],
                    ["ifscCode",      "IFSC Code",           "HDFC0001234"],
                    ["branchName",    "Branch",              "MG Road, Bangalore"],
                    ["upiId",         "UPI ID (for QR code)","nnc@hdfcbank"],
                  ].map(([key, lbl, ph]) => (
                    <div key={key} className="ac-field">
                      <label>{lbl}</label>
                      <input value={form.bankDetails?.[key] || ""}
                        onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, [key]: e.target.value } }))}
                        placeholder={ph}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section: Notes & Terms */}
              <div className="ac-form-section">
                <div className="ac-section-title">Notes &amp; Terms</div>
                <div className="ac-form-grid1">
                  <div className="ac-field">
                    <label>Additional Notes</label>
                    <textarea rows={2} value={form.notes} onChange={e=>setF("notes",e.target.value)}
                      placeholder="Any additional notes for this invoice…"/>
                  </div>
                  <div className="ac-field">
                    <label>Terms &amp; Conditions</label>
                    <textarea rows={5} value={form.termsAndConditions}
                      onChange={e=>setF("termsAndConditions",e.target.value)}/>
                  </div>
                </div>
              </div>

            </div>{/* end form-body */}
          </div>
        )}

        {/* ── LIST MODE ────────────────────────────────────── */}
        {mode === "list" && (
          <>
            {/* Header */}
            <div className="ac-header">
              <div>
                <div className="ac-eyebrow">Finance</div>
                <div className="ac-title">Accounting &amp; Invoicing</div>
              </div>
              <div className="ac-header-acts">
                <button type="button" className="ac-btn-outline"
                  onClick={() => { setBankDraft(getStoredBank()); setBankModal(true); }}>
                  <Settings size={13}/> Bank Settings
                </button>
                <button type="button" className="ac-btn-sec" onClick={() => openNew("tax")}>
                  <Plus size={13}/> New Tax Invoice
                </button>
                <button type="button" className="ac-btn-prim" onClick={() => openNew("proforma")}>
                  <Plus size={13}/> New Proforma
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="ac-filters">
              <div className="ac-search-wrap">
                <Search size={14} className="ac-search-icon"/>
                <input className="ac-search" placeholder="Search client, invoice #…"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}/>
              </div>
              <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
                <option value="">All Types</option>
                <option value="proforma">Proforma</option>
                <option value="tax">Tax Invoice</option>
              </select>
              <select value={filters.officeLocation} onChange={e => setFilters(f => ({ ...f, officeLocation: e.target.value }))}>
                <option value="">All Offices</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Mysore">Mysore</option>
                <option value="Mumbai">Mumbai</option>
              </select>
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="approved">Approved</option>
                <option value="converted">Converted</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button type="button" className="ac-refresh-btn" onClick={fetchInvoices}>
                <RefreshCcw size={13} className={loading ? "ac-spin" : ""}/>
              </button>
            </div>

            {/* KPI strip */}
            <div className="ac-summary-strip">
              <div className="ac-sum-item">
                <div className="ac-sum-icon">📋</div>
                <div className="ac-sum-text">
                  <span className="ac-sum-val">{invoices.filter(i=>i.type==="proforma").length}</span>
                  <span className="ac-sum-lbl">Proformas</span>
                </div>
              </div>
              <div className="ac-sum-item">
                <div className="ac-sum-icon">🧾</div>
                <div className="ac-sum-text">
                  <span className="ac-sum-val">{invoices.filter(i=>i.type==="tax").length}</span>
                  <span className="ac-sum-lbl">Tax Invoices</span>
                </div>
              </div>
              <div className="ac-sum-item green">
                <div className="ac-sum-icon">✅</div>
                <div className="ac-sum-text">
                  <span className="ac-sum-val">{fmt(invoices.filter(i=>i.type==="tax"&&i.status==="paid").reduce((s,i)=>s+i.totalAmount,0))}</span>
                  <span className="ac-sum-lbl">Paid Revenue</span>
                </div>
              </div>
              <div className="ac-sum-item blue">
                <div className="ac-sum-icon">⏳</div>
                <div className="ac-sum-text">
                  <span className="ac-sum-val">{fmt(invoices.filter(i=>i.type==="tax"&&i.status!=="paid"&&i.status!=="cancelled").reduce((s,i)=>s+i.totalAmount,0))}</span>
                  <span className="ac-sum-lbl">Outstanding</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="ac-table-wrap">
              {loading ? (
                <ShimmerTable rows={8} cells={7} />
              ) : invoices.length === 0 ? (
                <div className="ac-empty">No invoices found. Create your first proforma invoice!</div>
              ) : (
                <table className="ac-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Client</th>
                      <th>Office</th>
                      <th>Quoted</th>
                      <th>Finalized</th>
                      <th>Difference</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const isProf = inv.type === "proforma";
                      const linked = inv.linkedTaxInvoice;
                      const quoted    = isProf ? inv.totalAmount : (inv.quotedAmount || 0);
                      const finalized = isProf ? (linked?.totalAmount || null) : inv.finalizedAmount;
                      const diff      = (quoted && finalized != null) ? finalized - quoted : null;
                      const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                      return (
                        <tr key={inv._id}>
                          <td>
                            <div className="ac-inv-num-wrap">
                              <span className={`ac-type-pill ${isProf?"prf":"tax"}`}>
                                {isProf ? "PRF" : "TAX"}
                              </span>
                              <span className="ac-inv-num">{inv.invoiceNumber}</span>
                            </div>
                          </td>
                          <td>
                            <div className="ac-client-name">{inv.clientName}</div>
                            {inv.clientBusiness && <div className="ac-client-biz">{inv.clientBusiness}</div>}
                          </td>
                          <td><span className="ac-office-badge">{inv.officeLocation}</span></td>
                          <td className="ac-amt-cell">
                            {quoted > 0 ? <span className="ac-amt">{fmt(quoted)}</span> : "—"}
                          </td>
                          <td className="ac-amt-cell">
                            {finalized != null
                              ? <span className="ac-amt green">{fmt(finalized)}</span>
                              : isProf ? <span className="ac-pending">Pending</span> : "—"}
                          </td>
                          <td className="ac-diff-cell">
                            {diff != null ? (
                              <span className={`ac-diff ${diff >= 0 ? "pos" : "neg"}`}>
                                {diff > 0 ? <TrendingUp size={11}/> : diff < 0 ? <TrendingDown size={11}/> : <Minus size={11}/>}
                                {diff >= 0 ? "+" : ""}{fmt(diff)}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="ac-date-cell">
                            {new Date(inv.invoiceDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
                          </td>
                          <td>
                            <select className={`ac-status-sel ${st.cls}`} value={inv.status}
                              onChange={e => handleStatus(inv._id, e.target.value)}>
                              {Object.entries(STATUS_MAP).map(([k,v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="ac-act-btns">
                              <button type="button" title="View Invoice" className="ac-act view" onClick={() => openPreview(inv)}><Eye size={13}/></button>
                              {inv.status !== "cancelled" && inv.status !== "converted" && (
                                <button type="button" title="Edit" className="ac-act edit" onClick={() => openEdit(inv)}><Edit2 size={13}/></button>
                              )}
                              {isProf && inv.status !== "cancelled" && inv.status !== "converted" && (
                                <button type="button" title="Convert to Tax Invoice" className="ac-act convert" onClick={() => openConvert(inv)}>
                                  <ArrowRightCircle size={13}/>
                                </button>
                              )}
                              {inv.status !== "cancelled" && (
                                <button type="button" title="Cancel Invoice" className="ac-act del" onClick={() => handleDelete(inv._id)}><Trash2 size={13}/></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="ac-table-foot">{total} invoice{total !== 1 ? "s" : ""} total</div>
          </>
        )}
      </div>

      {/* ── Office Edit Modal ── */}
      {officeEdit && (
        <div className="ac-overlay" onClick={() => setOfficeEdit(null)}>
          <div className="ac-modal ac-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="ac-modal-head">
              <span className="ac-modal-title">Edit Office — {officeEdit.key}</span>
              <button type="button" className="ac-modal-close" onClick={() => setOfficeEdit(null)}><X size={15}/></button>
            </div>
            <div className="ac-modal-body">
              <div className="ac-form-grid2">
                {[
                  ["name",     "Company / Office Name"],
                  ["phone",    "Phone"],
                  ["email",    "Email"],
                  ["gstin",    "GSTIN"],
                  ["address",  "Address Line"],
                  ["city",     "City"],
                  ["state",    "State"],
                  ["pincode",  "Pincode"],
                ].map(([key, lbl]) => (
                  <div key={key} className="ac-field">
                    <label>{lbl}</label>
                    <input
                      value={officeEdit.draft[key] || ""}
                      onChange={e => setOfficeEdit(o => ({ ...o, draft: { ...o.draft, [key]: e.target.value } }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="ac-modal-foot">
              <button type="button" className="ac-cancel-btn" onClick={() => setOfficeEdit(null)} disabled={officeSaving}>Cancel</button>
              <button type="button" className="ac-save-btn" onClick={saveOfficeEdit} disabled={officeSaving}>
                {officeSaving ? <BtnSpinner /> : <Check size={13}/>}
                {officeSaving ? "Saving…" : "Save Office"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bank Settings Modal ── */}
      {bankModal && (
        <div className="ac-overlay" onClick={() => setBankModal(false)}>
          <div className="ac-modal" onClick={e => e.stopPropagation()}>
            <div className="ac-modal-head">
              <span className="ac-modal-title">Default Bank Details</span>
              <button type="button" className="ac-modal-close" onClick={() => setBankModal(false)}><X size={15}/></button>
            </div>
            <div className="ac-modal-body">
              {[
                ["accountName",   "Account Holder Name"],
                ["accountNumber", "Account Number"],
                ["bankName",      "Bank Name"],
                ["ifscCode",      "IFSC Code"],
                ["branchName",    "Branch"],
                ["upiId",         "UPI ID"],
              ].map(([key, lbl]) => (
                <div key={key} className="ac-field">
                  <label>{lbl}</label>
                  <input value={bankDraft[key] || ""}
                    onChange={e => setBankDraft(b => ({ ...b, [key]: e.target.value }))}/>
                </div>
              ))}
            </div>
            <div className="ac-modal-foot">
              <button type="button" className="ac-cancel-btn" onClick={() => setBankModal(false)}>Cancel</button>
              <button type="button" className="ac-save-btn" onClick={saveBankDefaults}><Check size={13}/> Save Defaults</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
