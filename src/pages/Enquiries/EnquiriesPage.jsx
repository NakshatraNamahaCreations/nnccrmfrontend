import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Eye, Edit2, ArrowRightCircle, Trash2,
  ChevronLeft, ChevronRight, RefreshCcw, MessageSquare,
  Calendar, TrendingUp, Clock, Activity, Download,
  FileText, CheckCircle, XCircle, Send, IndianRupee, AlertTriangle, CalendarPlus,
} from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import FollowUpModal from "./FollowUpModal";
import ProposalModal from "./ProposalModal";
import LostModal from "./LostModal";
import { PROPOSAL_STATUS_META, proposalLabel } from "./proposalStatus";
import { toast } from "../../utils/toast";
import "./EnquiriesPage.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const isMasterAdmin = () => localStorage.getItem("nnc_role") === "master_admin";

/* ── Constants ────────────────────────────────────────── */
const SERVICES = [
  { label: "Website Dev",               icon: "🌐" },
  { label: "Mobile App Dev",            icon: "📱" },
  { label: "Social Media Promotions",   icon: "📣" },
  { label: "Animation 2D/3D",           icon: "🎬" },
  { label: "Google Ads",                icon: "🎯" },
  { label: "SEO",                       icon: "🔍" },
  { label: "Corporate Ad Film",         icon: "🎥" },
  { label: "Logo & Branding",           icon: "✏️" },
  { label: "E-Commerce",                icon: "🛒" },
  { label: "Photography/Videography",   icon: "📷" },
  { label: "Custom Software",           icon: "💻" },
  { label: "UI/UX Design",             icon: "🎨" },
];

const SOURCES = [
  "Walk-In", "Referral", "Website", "Phone Call",
  "WhatsApp", "Instagram", "Google Ads", "JustDial",
];

const LANDING_PAGES = [
  { label: "Home Page",               value: "Home Page" },
  { label: "Contact Page",            value: "Contact Page" },
  { label: "Mobile App Dev Page",     value: "Mobile App Dev Page" },
  { label: "Website Dev Page",        value: "Website Dev Page" },
  { label: "Web Application Dev Page",value: "Web Application Dev Page" },
  { label: "Corporate Website Dev Page", value: "Corporate Website Dev Page" },
  { label: "E-Commerce Dev Page",     value: "E-Commerce Dev Page" },
  { label: "Custom CRM Dev Page",     value: "Custom CRM Dev Page" },
  { label: "SEO Page",                value: "SEO Page" },
  { label: "Digital Marketing Page",  value: "Digital Marketing Page" },
  { label: "Animation Page",          value: "Animation Page" },
  { label: "Graphic Design Page",     value: "Graphic Design Page" },
  { label: "Corporate Video Page",    value: "Corporate Video Page" },
  { label: "Progressive Web App Page",value: "Progressive Web App Page" },
  { label: "Landing Page Dev Page",   value: "Landing Page Dev Page" },
];

const STATUSES = ["new", "contacted", "follow-up", "quoted", "won", "lost"];
const BRANCHES = ["Bangalore", "Mysore", "Mumbai"];

const EMPTY_FORM = {
  name: "", phone: "", email: "", company: "", services: [],
  source: "Walk-In", budgetMin: "", budgetMax: "", requirements: "",
  branch: "Bangalore", assignedTo: "", status: "new", followUpDate: "",
  gstApplicable: false,
};

function getStatusClass(status) {
  const map = {
    new: "enq-st-new",
    contacted: "enq-st-contacted",
    "follow-up": "enq-st-follow-up",
    quoted: "enq-st-quoted",
    won: "enq-st-won",
    lost: "enq-st-lost",
  };
  return map[status] || "enq-st-new";
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Date + time, e.g. "03 Jul 2026, 12:52 PM"
function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

/* ── Follow-up date helpers ───────────────────────── */
const pad2 = (n) => String(n).padStart(2, "0");
// Local calendar date as YYYY-MM-DD (what <input type="date"> uses)
function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
// Follow-up dates are stored as UTC midnight of the picked day
const fuKey = (d) => (d ? String(d).split("T")[0] : "");

// "overdue" | "today" | "upcoming" | "" — closed enquiries never count
function followUpState(enq) {
  const key = fuKey(enq.followUpDate);
  if (!key || enq.status === "won" || enq.status === "lost") return "";
  const today = ymd(new Date());
  if (key < today) return "overdue";
  if (key === today) return "today";
  return "upcoming";
}

const FOLLOW_UP_VIEWS = [
  { key: "",         label: "All" },
  { key: "today",    label: "Today's Follow-ups", stat: "todayFollowUps" },
  { key: "overdue",  label: "Overdue",            stat: "overdueFollowUps" },
  { key: "upcoming", label: "Upcoming",           stat: "upcomingFollowUps" },
];

const PAGE_SIZE = 10; // enquiries per page

// Page buttons to show: first, last, and 1 either side of current, with "…" gaps
function pageNumbers(current, total) {
  const pages = [];
  for (let n = 1; n <= total; n++) {
    if (n === 1 || n === total || Math.abs(n - current) <= 1) pages.push(n);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return pages;
}

const lastProposalComment = (enq) => {
  const list = enq.proposalComments || [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].text) return list[i];
  return null;
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
/* ── Quotation constants ──────────────────────────── */
// Must match the Quotation model's status enum on the backend
const QUOTE_STATUS_META = {
  draft:             { label: "Draft",           cls: "qt-st-draft" },
  sent:              { label: "Sent",            cls: "qt-st-sent" },
  under_negotiation: { label: "Negotiating",     cls: "qt-st-negotiating" },
  approved:          { label: "Approved",        cls: "qt-st-accepted" },
  rejected:          { label: "Rejected",        cls: "qt-st-rejected" },
  final:             { label: "Final",           cls: "qt-st-final" },
  converted:         { label: "Converted to PI", cls: "qt-st-converted" },
  expired:           { label: "Expired",         cls: "qt-st-expired" },
};
const QUOTE_STATUSES = Object.keys(QUOTE_STATUS_META);
// "converted" is only set by converting to a proforma invoice, never picked by hand
const QUOTE_PICKABLE = QUOTE_STATUSES.filter(s => s !== "converted");
const EMPTY_LINE = { description: "", qty: 1, rate: 0, amount: 0 };
const EMPTY_QUOTE = {
  clientName: "", clientPhone: "", clientEmail: "", clientCompany: "",
  enquiryId: "", branch: "Bangalore", services: [],
  lineItems: [{ ...EMPTY_LINE }],
  discount: 0, tax: 18, validUntil: "", notes: "", terms: "",
};

function fmtCurrency(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}
function getQuoteStatusClass(s) {
  return QUOTE_STATUS_META[s]?.cls || "qt-st-draft";
}
const quoteStatusLabel = (s) => QUOTE_STATUS_META[s]?.label || s;
const lastComment = (q) => (q.comments?.length ? q.comments[q.comments.length - 1] : null);

export default function EnquiriesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("enquiries"); // enquiries | quotations
  const [enqSite, setEnqSite] = useState("nnc"); // nnc | nncdigital — which website's enquiries
  const [mode, setMode] = useState("list"); // list | form | view
  const [enquiries, setEnquiries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0, byStatus: {}, byService: [], conversionRate: 0, newThisMonth: 0,
    todayFollowUps: 0, overdueFollowUps: 0, upcomingFollowUps: 0, unseen: 0,
    converted: 0, lost: 0, scheduledFollowUps: 0,
  });
  // Unseen (new, not-yet-viewed) enquiry counts per site — drives the tab alert badges
  const [unseenCounts, setUnseenCounts] = useState({ nnc: 0, nncdigital: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ branch: "", status: "", source: "", service: "", landingPage: "", q: "", dateRange: "", followUp: "", page: 1 });
  const [exporting, setExporting] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [viewingEnquiry, setViewingEnquiry] = useState(null);
  const [noteForm, setNoteForm] = useState({ action: "", note: "" });
  const [savingNote, setSavingNote] = useState(false);
  const [fuModal, setFuModal]     = useState(null); // enquiry whose follow-up calendar popup is open
  const [propModal, setPropModal] = useState(null); // enquiry whose proposal popup is open
  const [lostModal, setLostModal] = useState(null); // enquiry being marked as lost

  // ── Quotation state ──────────────────────────────
  const [quoteMode, setQuoteMode]           = useState("list"); // list | form | view
  const [quotes, setQuotes]                 = useState([]);
  const [quoteTotalCount, setQuoteTotalCount] = useState(0);
  const [quoteStats, setQuoteStats]         = useState({ total:0, byStatus:{}, thisMonth:0, acceptedValue:0, conversionRate:0 });
  const [quoteLoading, setQuoteLoading]     = useState(false);
  const [quoteSaving, setQuoteSaving]       = useState(false);
  const [quoteFilters, setQuoteFilters]     = useState({ branch:"", status:"", q:"", page:1 });
  const [quoteForm, setQuoteForm]           = useState({ ...EMPTY_QUOTE });
  const [quoteEditId, setQuoteEditId]       = useState(null);
  const [viewingQuote, setViewingQuote]     = useState(null);
  const [quoteComment, setQuoteComment]     = useState("");
  const [savingComment, setSavingComment]   = useState(false);

  /* ── Auth header ── */
  function authHeader() {
    const token = localStorage.getItem("nnc_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /* ── Quotation API helpers ── */
  const fetchQuotes = useCallback(async () => {
    setQuoteLoading(true);
    try {
      const p = new URLSearchParams();
      if (quoteFilters.branch) p.set("branch", quoteFilters.branch);
      if (quoteFilters.status) p.set("status", quoteFilters.status);
      if (quoteFilters.q)      p.set("q",      quoteFilters.q);
      p.set("page", quoteFilters.page);
      const res  = await fetch(`${API}/api/quotations?${p}`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) { setQuotes(json.data || []); setQuoteTotalCount(json.total || 0); }
      else toast.error(json.message || "Failed to load quotations");
    } catch { toast.error("Failed to load quotations"); }
    finally { setQuoteLoading(false); }
  }, [quoteFilters]);

  const fetchQuoteStats = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/quotations/stats`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) setQuoteStats(json.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { if (activeTab === "quotations") { fetchQuotes(); fetchQuoteStats(); } }, [activeTab, fetchQuotes, fetchQuoteStats]);

  const saveQuote = async () => {
    if (!quoteForm.clientName.trim()) return toast.error("Client name is required");
    if (!quoteForm.branch)            return toast.error("Branch is required");
    setQuoteSaving(true);
    try {
      const method = quoteEditId ? "PUT" : "POST";
      const url    = quoteEditId ? `${API}/api/quotations/${quoteEditId}` : `${API}/api/quotations`;
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(quoteForm),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(quoteEditId ? "Quotation updated!" : "Quotation created!");
        setQuoteMode("list");
        fetchQuotes();
        fetchQuoteStats();
      } else toast.error(json.message || "Save failed");
    } catch { toast.error("Save failed"); }
    finally { setQuoteSaving(false); }
  };

  const deleteQuote = async (id) => {
    if (!window.confirm("Delete this quotation?")) return;
    try {
      const res  = await fetch(`${API}/api/quotations/${id}`, { method: "DELETE", headers: authHeader() });
      const json = await res.json();
      if (json.success) { toast.success("Deleted"); fetchQuotes(); fetchQuoteStats(); }
      else toast.error(json.message || "Delete failed");
    } catch { toast.error("Delete failed"); }
  };

  const updateQuoteStatus = async (id, status) => {
    try {
      const res  = await fetch(`${API}/api/quotations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Marked as ${quoteStatusLabel(status)}`);
        setQuotes(list => list.map(q => q._id === id ? json.data : q));
        fetchQuoteStats();
        if (viewingQuote?._id === id) setViewingQuote(json.data);
      } else toast.error(json.message || "Update failed");
    } catch { toast.error("Update failed"); }
  };

  const addQuoteComment = async (id) => {
    const text = quoteComment.trim();
    if (!text) return toast.error("Write a comment first");
    setSavingComment(true);
    try {
      const res  = await fetch(`${API}/api/quotations/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Comment added");
        setQuoteComment("");
        setViewingQuote(json.data);
        setQuotes(list => list.map(q => q._id === id ? json.data : q));
      } else toast.error(json.message || "Failed to add comment");
    } catch { toast.error("Failed to add comment"); }
    finally { setSavingComment(false); }
  };

  const deleteQuoteComment = async (id, commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res  = await fetch(`${API}/api/quotations/${id}/comments/${commentId}`, { method: "DELETE", headers: authHeader() });
      const json = await res.json();
      if (json.success) {
        setViewingQuote(json.data);
        setQuotes(list => list.map(q => q._id === id ? json.data : q));
      } else toast.error(json.message || "Delete failed");
    } catch { toast.error("Delete failed"); }
  };

  // Line item helpers
  const updateLineItem = (idx, field, val) => {
    setQuoteForm(f => {
      const items = [...f.lineItems];
      items[idx] = { ...items[idx], [field]: val };
      if (field === "qty" || field === "rate") {
        items[idx].amount = Number(items[idx].qty || 0) * Number(items[idx].rate || 0);
      }
      const subtotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);
      const taxAmt   = ((subtotal - Number(f.discount || 0)) * Number(f.tax || 0)) / 100;
      return { ...f, lineItems: items, subtotal, total: Math.max(0, subtotal - Number(f.discount || 0) + taxAmt) };
    });
  };
  const addLineItem    = () => setQuoteForm(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_LINE }] }));
  const removeLineItem = (idx) => setQuoteForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));
  const setQuoteField  = (key, val) => setQuoteForm(f => ({ ...f, [key]: val }));

  /* ── Build query params from filters ── */
  function buildParams(extra = {}) {
    const p = new URLSearchParams();
    p.set("site", enqSite);
    if (filters.branch)      p.set("branch",      filters.branch);
    if (filters.status)      p.set("status",      filters.status);
    if (filters.source)      p.set("source",      filters.source);
    if (filters.service)     p.set("service",     filters.service);
    if (filters.landingPage) p.set("landingPage", filters.landingPage);
    if (filters.q)           p.set("q",           filters.q);
    if (filters.dateRange)   p.set("dateRange",   filters.dateRange);
    if (filters.followUp)    p.set("followUp",    filters.followUp);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p;
  }

  /* ── Fetch enquiries ── */
  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const p = buildParams({ page: filters.page, limit: PAGE_SIZE });
      const res  = await fetch(`${API}/api/enquiries?${p}`, { headers: authHeader() });
      const json = await res.json();
      // Converted enquiries belong to Projects only (the API already excludes them)
      if (json.success) { setEnquiries((json.data || []).filter(e => !e.convertedToLead)); setTotalCount(json.total || 0); }
      else toast.error(json.message || "Failed to load enquiries");
    } catch {
      toast.error("Failed to load enquiries");
    } finally { setLoading(false); }
  }, [filters, enqSite]);

  /* ── Export CSV ── */
  const handleExport = async () => {
    setExporting(true);
    try {
      const p = buildParams();
      const res = await fetch(`${API}/api/enquiries/export?${p}`, { headers: authHeader() });
      if (!res.ok) { toast.error("Export failed"); setExporting(false); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `enquiries-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported successfully!");
    } catch {
      toast.error("Export failed");
    } finally { setExporting(false); }
  };

  /* ── Fetch stats ── */
  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/enquiries/stats?site=${enqSite}`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) setStats(json.data || stats);
    } catch { /* silent */ }
  }, [enqSite]);

  /* ── Fetch unseen counts for BOTH tabs (drives the alert badges) ── */
  const fetchUnseenCounts = useCallback(async () => {
    try {
      const [nncRes, digiRes] = await Promise.all([
        fetch(`${API}/api/enquiries/stats?site=nnc`,        { headers: authHeader() }),
        fetch(`${API}/api/enquiries/stats?site=nncdigital`, { headers: authHeader() }),
      ]);
      const [nncJson, digiJson] = await Promise.all([nncRes.json(), digiRes.json()]);
      setUnseenCounts({
        nnc:        nncJson.success  ? (nncJson.data.unseen  || 0) : 0,
        nncdigital: digiJson.success ? (digiJson.data.unseen || 0) : 0,
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchEnquiries(); }, [fetchEnquiries]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUnseenCounts(); }, [fetchUnseenCounts]);
  // Poll unseen counts every 30s so new leads alert without a manual refresh
  useEffect(() => {
    const id = setInterval(fetchUnseenCounts, 30000);
    return () => clearInterval(id);
  }, [fetchUnseenCounts]);

  /* ── Open helpers ── */
  const openNew = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingId(null);
    setMode("form");
  };

  const openEdit = (enq) => {
    setFormData({
      name: enq.name || "",
      phone: enq.phone || "",
      email: enq.email || "",
      company: enq.company || "",
      services: Array.isArray(enq.services) ? enq.services : [],
      source: enq.source || "Walk-In",
      budgetMin: enq.budgetMin ?? "",
      budgetMax: enq.budgetMax ?? "",
      requirements: enq.requirements || "",
      branch: enq.branch || "Bangalore",
      assignedTo: enq.assignedTo || "",
      status: enq.status || "new",
      followUpDate: enq.followUpDate ? enq.followUpDate.split("T")[0] : "",
    });
    setEditingId(enq._id);
    setMode("form");
  };

  const openView = (enq) => {
    setViewingEnquiry(enq);
    setNoteForm({ action: "", note: "" });
    setMode("view");

    // Mark as seen (clears the glow + decrements the tab badge) if it was unseen
    if (!enq.seen) {
      // Optimistically update the row + badge so the UI reacts instantly
      setEnquiries(list => list.map(e => e._id === enq._id ? { ...e, seen: true } : e));
      setUnseenCounts(c => ({ ...c, [enqSite]: Math.max(0, (c[enqSite] || 0) - 1) }));
      fetch(`${API}/api/enquiries/${enq._id}/seen`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
      }).catch(() => {});
    }
  };

  /* ── Add a follow-up to the main calendar (fire-and-forget) ── */
  const syncFollowUpToCalendar = (enq, date) => {
    if (!date) return;
    fetch(`${API}/api/calendar-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({
        enquiryId: enq._id,
        type: "enquiry_followup",
        date,
        title: `Follow-up: ${enq.name}`,
        notes: `Enquiry follow-up for ${enq.name} (${enq.phone})${enq.company ? " — " + enq.company : ""}`,
      }),
    }).catch(() => {});
  };

  /* ── Put an updated enquiry back into the list + open detail view ── */
  const applyUpdatedEnquiry = (updated) => {
    setEnquiries(list => list.map(e => e._id === updated._id ? { ...e, ...updated, seen: e.seen } : e));
    setViewingEnquiry(v => (v && v._id === updated._id ? { ...v, ...updated } : v));
  };

  /* ── Follow-up popup: save / clear (return true on success so the popup closes) ── */
  const saveFollowUp = async (enq, date, note) => {
    try {
      // Sets the date and logs one "Follow-up Scheduled" entry (with the note, if any)
      const res  = await fetch(`${API}/api/enquiries/${enq._id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ note, followUpDate: date }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message || "Failed to save follow-up"); return false; }
      toast.success(`Follow-up set for ${fmtDate(date)}`);
      if (date !== fuKey(enq.followUpDate)) syncFollowUpToCalendar(enq, date);
      applyUpdatedEnquiry(json.data);
      fetchEnquiries();
      fetchStats();
      return true;
    } catch { toast.error("Failed to save follow-up"); return false; }
  };

  const clearFollowUp = async (enq) => {
    try {
      const res  = await fetch(`${API}/api/enquiries/${enq._id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ followUpDate: null }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message || "Failed to remove follow-up"); return false; }
      toast.success("Follow-up removed");
      applyUpdatedEnquiry(json.data);
      fetchEnquiries();
      fetchStats();
      return true;
    } catch { toast.error("Failed to remove follow-up"); return false; }
  };

  /* ── Lost: mark lost (with reason) or reopen ── */
  const setLost = async (enq, lost, reason = "") => {
    try {
      const res  = await fetch(`${API}/api/enquiries/${enq._id}/lost`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ lost, reason }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message || "Update failed"); return false; }
      toast.success(lost ? "Marked as lost" : "Lead reopened");
      applyUpdatedEnquiry(json.data);
      fetchEnquiries();
      fetchStats();
      return true;
    } catch { toast.error("Update failed"); return false; }
  };

  /* ── Proposal popup: status + comment ── */
  const saveProposal = async (enq, status, comment) => {
    try {
      const res  = await fetch(`${API}/api/enquiries/${enq._id}/proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ status, comment }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message || "Failed to update proposal"); return false; }
      toast.success(`Proposal: ${proposalLabel(status)}`);
      applyUpdatedEnquiry(json.data);
      return true;
    } catch { toast.error("Failed to update proposal"); return false; }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!formData.name.trim()) return toast.error("Name is required");
    if (!formData.phone.trim()) return toast.error("Phone is required");
    if (!formData.branch) return toast.error("Branch is required");

    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const url    = editingId ? `${API}/api/enquiries/${editingId}` : `${API}/api/enquiries`;
      const payload = editingId ? formData : { ...formData, site: enqSite };
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingId ? "Enquiry updated!" : "Enquiry created!");

        /* Sync follow-up date to calendar */
        if (formData.followUpDate) {
          const prevDate = editingId
            ? enquiries.find(e => e._id === editingId)?.followUpDate
            : null;
          if (formData.followUpDate !== fuKey(prevDate)) {
            syncFollowUpToCalendar({ ...formData, _id: json.data?._id || editingId }, formData.followUpDate);
          }
        }

        setMode("list");
        fetchEnquiries();
        fetchStats();
      } else {
        toast.error(json.message || "Save failed");
      }
    } catch {
      toast.error("Save failed");
    } finally { setSaving(false); }
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this enquiry?")) return;
    try {
      const res  = await fetch(`${API}/api/enquiries/${id}`, { method: "DELETE", headers: authHeader() });
      const json = await res.json();
      if (json.success) { toast.success("Deleted"); fetchEnquiries(); fetchStats(); }
      else toast.error(json.message || "Delete failed");
    } catch { toast.error("Delete failed"); }
  };

  /* ── Convert ── */
  const handleConvert = async (id) => {
    if (!window.confirm("Convert this enquiry to a lead? It will move to Projects.")) return;
    try {
      const res  = await fetch(`${API}/api/enquiries/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        // Converted enquiries only live in Projects from now on
        toast.success("Converted — moved to Projects");
        navigate("/leads");
      } else toast.error(json.message || "Conversion failed");
    } catch { toast.error("Conversion failed"); }
  };

  /* ── Add activity ── */
  const addActivity = async (enquiryId) => {
    if (!noteForm.action.trim()) return toast.error("Action is required");
    setSavingNote(true);
    try {
      const res  = await fetch(`${API}/api/enquiries/${enquiryId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(noteForm),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Activity logged!");
        setNoteForm({ action: "", note: "" });
        setViewingEnquiry(v => ({ ...v, ...json.data }));
      } else toast.error(json.message || "Failed to add note");
    } catch { toast.error("Failed to add note"); }
    finally { setSavingNote(false); }
  };

  /* ── Filter change ── */
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));
  const clearFilters = () => setFilters({ branch: "", status: "", source: "", service: "", landingPage: "", q: "", dateRange: "", followUp: "", page: 1 });

  /* ── Form field change ── */
  const setField = (key, val) => setFormData(f => ({ ...f, [key]: val }));
  const toggleService = (label) => {
    setFormData(f => {
      const arr = f.services.includes(label) ? f.services.filter(s => s !== label) : [...f.services, label];
      return { ...f, services: arr };
    });
  };

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const goToPage = (n) => {
    setFilters(f => ({ ...f, page: n }));
    document.querySelector(".enq-table-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Clamp page if it exceeds totalPages (e.g. after filtering reduces results)
  useEffect(() => {
    if (filters.page > totalPages) {
      setFilters(f => ({ ...f, page: totalPages }));
    }
  }, [totalPages, filters.page]);

  /* ════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════ */
  return (
    <div className="enq-layout">
      <Sidebar />
      <div className="enq-main">

        {/* ── Tab switcher ── */}
        <div className="enq-tab-bar">
          <button
            className={`enq-tab-btn${activeTab === "enquiries" ? " active" : ""}`}
            onClick={() => { setActiveTab("enquiries"); setMode("list"); }}
          >
            <MessageSquare size={15} /> Enquiries
          </button>
          <button
            className={`enq-tab-btn${activeTab === "quotations" ? " active" : ""}`}
            onClick={() => { setActiveTab("quotations"); setQuoteMode("list"); }}
          >
            <FileText size={15} /> Quotations
          </button>
        </div>

        {/* ══════════════ QUOTATIONS TAB ══════════════ */}
        {activeTab === "quotations" && (
          <>
            {quoteMode === "list" && (
              <>
                <div className="enq-header">
                  <div>
                    <div className="enq-eyebrow">NNC CRM</div>
                    <div className="enq-title">Quotations</div>
                    <div className="enq-subtitle">Create and manage client quotations</div>
                  </div>
                  <div className="enq-header-acts">
                    <button className="enq-btn-sec" onClick={fetchQuotes}>
                      <RefreshCcw size={14} className={quoteLoading ? "enq-spin" : ""} /> Refresh
                    </button>
                    <button className="enq-btn-prim" onClick={() => { setQuoteForm({ ...EMPTY_QUOTE }); setQuoteEditId(null); setQuoteMode("form"); }}>
                      <Plus size={15} /> New Quotation
                    </button>
                  </div>
                </div>

                {/* KPI strip */}
                <div className="enq-kpi-strip">
                  <div className="enq-kpi-item">
                    <div className="enq-kpi-icon"><FileText size={20} /></div>
                    <div className="enq-kpi-text">
                      <div className="enq-kpi-val">{quoteStats.total}</div>
                      <div className="enq-kpi-label">Total Quotations</div>
                    </div>
                  </div>
                  <div className="enq-kpi-item">
                    <div className="enq-kpi-icon"><Calendar size={20} /></div>
                    <div className="enq-kpi-text">
                      <div className="enq-kpi-val">{quoteStats.thisMonth}</div>
                      <div className="enq-kpi-label">This Month</div>
                    </div>
                  </div>
                  <div className="enq-kpi-item">
                    <div className="enq-kpi-icon"><IndianRupee size={20} /></div>
                    <div className="enq-kpi-text">
                      <div className="enq-kpi-val">{fmtCurrency(quoteStats.acceptedValue)}</div>
                      <div className="enq-kpi-label">Accepted Value</div>
                    </div>
                  </div>
                  <div className="enq-kpi-item">
                    <div className="enq-kpi-icon"><TrendingUp size={20} /></div>
                    <div className="enq-kpi-text">
                      <div className="enq-kpi-val">{quoteStats.conversionRate}%</div>
                      <div className="enq-kpi-label">Acceptance Rate</div>
                    </div>
                  </div>
                </div>

                {/* Filter bar */}
                <div className="enq-filter-bar">
                  <div className="enq-filter-selects">
                    <select value={quoteFilters.branch} onChange={e => setQuoteFilters(f => ({ ...f, branch: e.target.value, page: 1 }))}>
                      <option value="">All Branches</option>
                      {["Bangalore","Mysore","Mumbai"].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select value={quoteFilters.status} onChange={e => setQuoteFilters(f => ({ ...f, status: e.target.value, page: 1 }))}>
                      <option value="">All Statuses</option>
                      {QUOTE_STATUSES.map(s => <option key={s} value={s}>{quoteStatusLabel(s)}</option>)}
                    </select>
                    <div className="enq-search-wrap">
                      <Search size={14} />
                      <input placeholder="Search client, quote no…" value={quoteFilters.q} onChange={e => setQuoteFilters(f => ({ ...f, q: e.target.value, page: 1 }))} />
                    </div>
                    <button className="enq-filter-clear" onClick={() => setQuoteFilters({ branch:"", status:"", q:"", page:1 })}>Clear</button>
                  </div>
                </div>

                {/* Table */}
                <div className="enq-table-section">
                  <div className="enq-table-card">
                    <div className="enq-table-head">
                      <span className="enq-table-head-title">All Quotations <span className="enq-table-head-count">({quoteTotalCount})</span></span>
                    </div>
                    {quoteLoading ? (
                      <div className="enq-loading"><RefreshCcw size={28} className="enq-spin" /></div>
                    ) : quotes.length === 0 ? (
                      <div className="enq-empty">
                        <div className="enq-empty-icon"><FileText size={40} /></div>
                        <div className="enq-empty-text">No quotations yet</div>
                        <div className="enq-empty-sub">Create your first quotation</div>
                      </div>
                    ) : (
                      <div className="enq-table-wrap">
                        <table className="enq-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Quote No.</th>
                              <th>Client</th>
                              <th>Branch</th>
                              <th>Total</th>
                              <th>Valid Until</th>
                              <th>Status</th>
                              <th>Comment</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quotes.map((q, idx) => (
                              <tr key={q._id}>
                                <td>{(quoteFilters.page - 1) * 20 + idx + 1}</td>
                                <td><span className="qt-number">{q.quoteNumber}</span></td>
                                <td>
                                  <div className="enq-name">{q.clientName}</div>
                                  <div className="enq-phone">{q.clientPhone || q.clientCompany || "—"}</div>
                                </td>
                                <td>{q.branch}</td>
                                <td><strong>{fmtCurrency(q.total)}</strong></td>
                                <td>{fmtDate(q.validUntil)}</td>
                                <td>
                                  <select
                                    className={`qt-status-select ${getQuoteStatusClass(q.status)}`}
                                    value={q.status}
                                    disabled={q.status === "converted"}
                                    title={q.status === "converted" ? "Converted to proforma — status locked" : "Change status"}
                                    onChange={e => updateQuoteStatus(q._id, e.target.value)}
                                  >
                                    {(q.status === "converted" ? QUOTE_STATUSES : QUOTE_PICKABLE).map(s => (
                                      <option key={s} value={s}>{quoteStatusLabel(s)}</option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  {lastComment(q) ? (
                                    <button
                                      className="qt-comment-cell"
                                      title={lastComment(q).text}
                                      onClick={() => { setViewingQuote(q); setQuoteComment(""); setQuoteMode("view"); }}
                                    >
                                      <span className="qt-comment-text">{lastComment(q).text}</span>
                                      <span className="qt-comment-meta">
                                        {q.comments.length > 1 ? `${q.comments.length} comments · ` : ""}{fmtDate(lastComment(q).at)}
                                      </span>
                                    </button>
                                  ) : (
                                    <button
                                      className="qt-comment-add"
                                      onClick={() => { setViewingQuote(q); setQuoteComment(""); setQuoteMode("view"); }}
                                    >
                                      <MessageSquare size={12} /> Add
                                    </button>
                                  )}
                                </td>
                                <td>
                                  <div className="enq-actions">
                                    <button className="enq-btn-icon" title="View" onClick={() => { setViewingQuote(q); setQuoteComment(""); setQuoteMode("view"); }}>
                                      <Eye size={15} />
                                    </button>
                                    <button className="enq-btn-icon" title="Edit" onClick={() => {
                                      setQuoteForm({
                                        clientName: q.clientName, clientPhone: q.clientPhone||"", clientEmail: q.clientEmail||"", clientCompany: q.clientCompany||"",
                                        enquiryId: q.enquiryId||"", branch: q.branch, services: q.services||[],
                                        lineItems: q.lineItems?.length ? q.lineItems : [{ ...EMPTY_LINE }],
                                        discount: q.discount||0, tax: q.tax||18,
                                        validUntil: q.validUntil ? q.validUntil.split("T")[0] : "",
                                        notes: q.notes||"", terms: q.terms||"",
                                      });
                                      setQuoteEditId(q._id);
                                      setQuoteMode("form");
                                    }}>
                                      <Edit2 size={15} />
                                    </button>
                                    {q.status === "draft" && (
                                      <button className="enq-btn-icon convert" title="Mark as Sent" onClick={() => updateQuoteStatus(q._id, "sent")}>
                                        <Send size={15} />
                                      </button>
                                    )}
                                    {(q.status === "sent" || q.status === "under_negotiation") && (
                                      <button className="enq-btn-icon" title="Mark Approved" onClick={() => updateQuoteStatus(q._id, "approved")} style={{ color:"#16a34a" }}>
                                        <CheckCircle size={15} />
                                      </button>
                                    )}
                                    {isMasterAdmin() && (
                                      <button className="enq-btn-icon danger" title="Delete" onClick={() => deleteQuote(q._id)}>
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── QUOTATION FORM ── */}
            {quoteMode === "form" && (
              <div className="enq-form-view">
                <div className="enq-form-subheader">
                  <button className="enq-back-btn" onClick={() => setQuoteMode("list")}><ChevronLeft size={15} /> Back</button>
                  <div>
                    <div className="enq-form-heading">{quoteEditId ? "Edit Quotation" : "New Quotation"}</div>
                    <div className="enq-form-subheading">Fill in client details and line items</div>
                  </div>
                  <div style={{ marginLeft:"auto" }}>
                    <button className="enq-save-btn" disabled={quoteSaving} onClick={saveQuote} style={{ padding:"10px 24px" }}>
                      {quoteSaving ? "Saving…" : quoteEditId ? "Update" : "Create Quotation"}
                    </button>
                  </div>
                </div>

                <div className="enq-form-2col">
                  <div className="enq-form-left">
                    {/* Client info */}
                    <div className="enq-form-card">
                      <div className="enq-form-card-title"><span className="enq-card-icon">👤</span> Client Information</div>
                      <div className="enq-form-card-body">
                        <div className="enq-form-grid">
                          <div className="enq-field">
                            <label className="enq-label">Client Name <span className="enq-req">*</span></label>
                            <input className="enq-input" value={quoteForm.clientName} onChange={e => setQuoteField("clientName", e.target.value)} placeholder="Full name" />
                          </div>
                          <div className="enq-field">
                            <label className="enq-label">Phone</label>
                            <input className="enq-input" value={quoteForm.clientPhone} onChange={e => setQuoteField("clientPhone", e.target.value)} placeholder="+91 9900000000" />
                          </div>
                          <div className="enq-field">
                            <label className="enq-label">Email</label>
                            <input className="enq-input" type="email" value={quoteForm.clientEmail} onChange={e => setQuoteField("clientEmail", e.target.value)} placeholder="email@company.com" />
                          </div>
                          <div className="enq-field">
                            <label className="enq-label">Company</label>
                            <input className="enq-input" value={quoteForm.clientCompany} onChange={e => setQuoteField("clientCompany", e.target.value)} placeholder="Company name" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Line items */}
                    <div className="enq-form-card">
                      <div className="enq-form-card-title"><span className="enq-card-icon">📋</span> Line Items</div>
                      <div className="enq-form-card-body">
                        <div className="qt-line-header">
                          <span style={{ flex:3 }}>Description</span>
                          <span style={{ flex:1, textAlign:"center" }}>Qty</span>
                          <span style={{ flex:1, textAlign:"right" }}>Rate (₹)</span>
                          <span style={{ flex:1, textAlign:"right" }}>Amount (₹)</span>
                          <span style={{ width:32 }}></span>
                        </div>
                        {quoteForm.lineItems.map((item, idx) => (
                          <div key={idx} className="qt-line-row">
                            <input className="enq-input" style={{ flex:3 }} value={item.description} onChange={e => updateLineItem(idx, "description", e.target.value)} placeholder="Service / item description" />
                            <input className="enq-input" style={{ flex:1, textAlign:"center" }} type="number" min="0" value={item.qty} onChange={e => updateLineItem(idx, "qty", e.target.value)} />
                            <input className="enq-input" style={{ flex:1, textAlign:"right" }} type="number" min="0" value={item.rate} onChange={e => updateLineItem(idx, "rate", e.target.value)} />
                            <input className="enq-input qt-amount-cell" style={{ flex:1 }} readOnly value={Number(item.amount || 0).toLocaleString("en-IN")} />
                            <button className="qt-remove-line" onClick={() => removeLineItem(idx)} disabled={quoteForm.lineItems.length === 1}><XCircle size={15} /></button>
                          </div>
                        ))}
                        <button className="qt-add-line-btn" onClick={addLineItem}><Plus size={13} /> Add Line Item</button>

                        {/* Totals */}
                        <div className="qt-totals">
                          <div className="qt-total-row">
                            <span>Subtotal</span>
                            <span>{fmtCurrency(quoteForm.lineItems.reduce((s,i) => s + Number(i.amount||0), 0))}</span>
                          </div>
                          <div className="qt-total-row">
                            <span>Discount (₹)</span>
                            <input className="enq-input qt-total-input" type="number" min="0" value={quoteForm.discount} onChange={e => {
                              const d = Number(e.target.value || 0);
                              const sub = quoteForm.lineItems.reduce((s,i) => s + Number(i.amount||0), 0);
                              const tax = ((sub - d) * Number(quoteForm.tax || 0)) / 100;
                              setQuoteForm(f => ({ ...f, discount: d, total: Math.max(0, sub - d + tax) }));
                            }} />
                          </div>
                          <div className="qt-total-row">
                            <span>GST (%)</span>
                            <input className="enq-input qt-total-input" type="number" min="0" max="100" value={quoteForm.tax} onChange={e => {
                              const t = Number(e.target.value || 0);
                              const sub = quoteForm.lineItems.reduce((s,i) => s + Number(i.amount||0), 0);
                              const tax = ((sub - Number(quoteForm.discount||0)) * t) / 100;
                              setQuoteForm(f => ({ ...f, tax: t, total: Math.max(0, sub - Number(f.discount||0) + tax) }));
                            }} />
                          </div>
                          <div className="qt-total-row qt-grand-total">
                            <span>Grand Total</span>
                            <span>{fmtCurrency(quoteForm.total || quoteForm.lineItems.reduce((s,i) => s+Number(i.amount||0),0))}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes & Terms */}
                    <div className="enq-form-card">
                      <div className="enq-form-card-title"><span className="enq-card-icon">📝</span> Notes & Terms</div>
                      <div className="enq-form-card-body" style={{ display:"flex", flexDirection:"column", gap:12 }}>
                        <div className="enq-field">
                          <label className="enq-label">Notes (visible to client)</label>
                          <textarea className="enq-textarea" rows={3} value={quoteForm.notes} onChange={e => setQuoteField("notes", e.target.value)} placeholder="Any additional notes for the client…" style={{ width:"100%", boxSizing:"border-box" }} />
                        </div>
                        <div className="enq-field">
                          <label className="enq-label">Terms & Conditions</label>
                          <textarea className="enq-textarea" rows={3} value={quoteForm.terms} onChange={e => setQuoteField("terms", e.target.value)} placeholder="Payment terms, delivery, warranties…" style={{ width:"100%", boxSizing:"border-box" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="enq-form-sidebar">
                    <div className="enq-form-card">
                      <div className="enq-form-card-title"><span className="enq-card-icon">⚙️</span> Details</div>
                      <div className="enq-form-card-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
                        <div className="enq-field">
                          <label className="enq-label">Branch <span className="enq-req">*</span></label>
                          <select className="enq-select" value={quoteForm.branch} onChange={e => setQuoteField("branch", e.target.value)}>
                            {["Bangalore","Mysore","Mumbai"].map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div className="enq-field">
                          <label className="enq-label">Valid Until</label>
                          <input className="enq-input" type="date" value={quoteForm.validUntil} onChange={e => setQuoteField("validUntil", e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div className="enq-form-sidebar-actions">
                      <button className="enq-save-btn" disabled={quoteSaving} onClick={saveQuote} style={{ width:"100%" }}>
                        {quoteSaving ? "Saving…" : quoteEditId ? "Update Quotation" : "Create Quotation"}
                      </button>
                      <button className="enq-cancel-btn" onClick={() => setQuoteMode("list")} style={{ width:"100%" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── QUOTATION VIEW ── */}
            {quoteMode === "view" && viewingQuote && (
              <div className="enq-form-view">
                <div className="enq-detail-topbar">
                  <div className="enq-detail-topbar-left">
                    <button className="enq-back-btn" onClick={() => setQuoteMode("list")}><ChevronLeft size={15} /> Back</button>
                    <div>
                      <div className="enq-detail-name">{viewingQuote.quoteNumber}</div>
                      <div className="enq-detail-phone">{viewingQuote.clientName} · {viewingQuote.clientPhone || viewingQuote.clientEmail || ""}</div>
                    </div>
                    <span className={`enq-status ${getQuoteStatusClass(viewingQuote.status)}`}>{quoteStatusLabel(viewingQuote.status)}</span>
                  </div>
                  <div className="enq-detail-acts">
                    {viewingQuote.status === "draft" && (
                      <button className="enq-convert-btn" onClick={() => updateQuoteStatus(viewingQuote._id, "sent")}><Send size={14} /> Mark as Sent</button>
                    )}
                    {(viewingQuote.status === "sent" || viewingQuote.status === "under_negotiation") && (
                      <>
                        <button className="enq-convert-btn" style={{ background:"#16a34a" }} onClick={() => updateQuoteStatus(viewingQuote._id, "approved")}><CheckCircle size={14} /> Approve</button>
                        <button className="enq-btn-sec" onClick={() => updateQuoteStatus(viewingQuote._id, "rejected")}><XCircle size={14} /> Reject</button>
                      </>
                    )}
                    <button className="enq-btn-sec" onClick={() => {
                      setQuoteForm({
                        clientName: viewingQuote.clientName, clientPhone: viewingQuote.clientPhone||"", clientEmail: viewingQuote.clientEmail||"", clientCompany: viewingQuote.clientCompany||"",
                        enquiryId: viewingQuote.enquiryId||"", branch: viewingQuote.branch, services: viewingQuote.services||[],
                        lineItems: viewingQuote.lineItems?.length ? viewingQuote.lineItems : [{ ...EMPTY_LINE }],
                        discount: viewingQuote.discount||0, tax: viewingQuote.tax||18,
                        validUntil: viewingQuote.validUntil ? viewingQuote.validUntil.split("T")[0] : "",
                        notes: viewingQuote.notes||"", terms: viewingQuote.terms||"",
                      });
                      setQuoteEditId(viewingQuote._id);
                      setQuoteMode("form");
                    }}><Edit2 size={14} /> Edit</button>
                  </div>
                </div>

                <div className="enq-detail-body">
                  <div className="enq-detail-cols">
                    <div className="enq-form-card">
                      <div className="enq-form-card-title">Quotation Details</div>
                      <div className="enq-form-card-body">
                        {[
                          ["Quote No.", viewingQuote.quoteNumber],
                          ["Client",   viewingQuote.clientName],
                          ["Phone",    viewingQuote.clientPhone || "—"],
                          ["Email",    viewingQuote.clientEmail || "—"],
                          ["Company",  viewingQuote.clientCompany || "—"],
                          ["Branch",   viewingQuote.branch],
                          ["Valid Until", fmtDate(viewingQuote.validUntil)],
                          ["Created",  fmtDate(viewingQuote.createdAt)],
                        ].map(([label, val]) => (
                          <div key={label} className="enq-detail-field">
                            <div className="enq-detail-field-label">{label}</div>
                            <div className="enq-detail-field-val">{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="enq-form-card">
                      <div className="enq-form-card-title">Line Items & Totals</div>
                      <div className="enq-form-card-body">
                        <table className="enq-table" style={{ marginBottom:16 }}>
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th style={{ textAlign:"center" }}>Qty</th>
                              <th style={{ textAlign:"right" }}>Rate</th>
                              <th style={{ textAlign:"right" }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(viewingQuote.lineItems || []).map((item, i) => (
                              <tr key={i}>
                                <td>{item.description}</td>
                                <td style={{ textAlign:"center" }}>{item.qty}</td>
                                <td style={{ textAlign:"right" }}>{fmtCurrency(item.rate)}</td>
                                <td style={{ textAlign:"right" }}><strong>{fmtCurrency(item.amount)}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="qt-totals">
                          <div className="qt-total-row"><span>Subtotal</span><span>{fmtCurrency(viewingQuote.subtotal)}</span></div>
                          {viewingQuote.discount > 0 && <div className="qt-total-row"><span>Discount</span><span>- {fmtCurrency(viewingQuote.discount)}</span></div>}
                          {viewingQuote.tax > 0 && <div className="qt-total-row"><span>GST ({viewingQuote.tax}%)</span><span>{fmtCurrency(((viewingQuote.subtotal - viewingQuote.discount) * viewingQuote.tax) / 100)}</span></div>}
                          <div className="qt-total-row qt-grand-total"><span>Grand Total</span><span>{fmtCurrency(viewingQuote.total)}</span></div>
                        </div>
                        {viewingQuote.notes && <div style={{ marginTop:16 }}><div className="enq-detail-field-label">Notes</div><div className="enq-detail-field-val" style={{ whiteSpace:"pre-wrap" }}>{viewingQuote.notes}</div></div>}
                        {viewingQuote.terms && <div style={{ marginTop:10 }}><div className="enq-detail-field-label">Terms</div><div className="enq-detail-field-val" style={{ whiteSpace:"pre-wrap" }}>{viewingQuote.terms}</div></div>}
                      </div>
                    </div>
                  </div>

                  {/* Status & Comments */}
                  <div className="enq-form-card" style={{ marginTop:20 }}>
                    <div className="enq-form-card-title">Status &amp; Comments</div>
                    <div className="enq-form-card-body">
                      <div className="enq-field" style={{ maxWidth:280, marginBottom:18 }}>
                        <label className="enq-label">Status</label>
                        <select
                          className={`enq-select qt-status-select ${getQuoteStatusClass(viewingQuote.status)}`}
                          value={viewingQuote.status}
                          disabled={viewingQuote.status === "converted"}
                          onChange={e => updateQuoteStatus(viewingQuote._id, e.target.value)}
                        >
                          {(viewingQuote.status === "converted" ? QUOTE_STATUSES : QUOTE_PICKABLE).map(s => (
                            <option key={s} value={s}>{quoteStatusLabel(s)}</option>
                          ))}
                        </select>
                      </div>

                      {viewingQuote.comments?.length ? (
                        <div className="enq-activity-timeline">
                          {[...viewingQuote.comments].reverse().map(c => (
                            <div key={c._id} className="enq-activity-item">
                              <div className="enq-activity-dot">
                                <MessageSquare size={12} color="#7c3aed" />
                              </div>
                              <div className="enq-activity-content" style={{ flex:1 }}>
                                <div className="enq-activity-note" style={{ whiteSpace:"pre-wrap", color:"#334155" }}>{c.text}</div>
                                <div className="enq-activity-meta">
                                  {c.by && <span>{c.by} · </span>}
                                  {fmtDateTime(c.at)}
                                </div>
                              </div>
                              {isMasterAdmin() && (
                                <button className="enq-btn-icon danger" title="Delete comment" onClick={() => deleteQuoteComment(viewingQuote._id, c._id)}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color:"#94a3b8", fontSize:13, padding:"4px 0 8px" }}>No comments yet</div>
                      )}

                      <div className="enq-add-note-form">
                        <div className="enq-field">
                          <label className="enq-label">Add Comment</label>
                          <textarea
                            className="enq-textarea"
                            rows={3}
                            placeholder="e.g. Client wants 10% discount, will confirm by Friday…"
                            value={quoteComment}
                            onChange={e => setQuoteComment(e.target.value)}
                            style={{ width:"100%", boxSizing:"border-box" }}
                          />
                        </div>
                        <button
                          className="enq-note-save-btn"
                          disabled={savingComment || !quoteComment.trim()}
                          onClick={() => addQuoteComment(viewingQuote._id)}
                        >
                          {savingComment ? "Saving…" : "Add Comment"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ ENQUIRIES TAB ══════════════ */}
        {activeTab === "enquiries" && mode === "list" && (
          <>
            {/* Hero header */}
            <div className="enq-header">
              <div>
                <div className="enq-eyebrow">NNC CRM</div>
                <div className="enq-title">Enquiry Management</div>
                <div className="enq-subtitle">Track and convert enquiries to clients</div>
              </div>
              <div className="enq-header-acts">
                <button className="enq-btn-sec" onClick={handleExport} disabled={exporting}>
                  <Download size={14} className={exporting ? "enq-spin" : ""} />
                  {exporting ? "Exporting…" : "Export CSV"}
                </button>
                <button className="enq-btn-sec" onClick={fetchEnquiries}>
                  <RefreshCcw size={14} className={loading ? "enq-spin" : ""} />
                  Refresh
                </button>
                <button className="enq-btn-prim" onClick={openNew}>
                  <Plus size={15} /> New Enquiry
                </button>
              </div>
            </div>

            {/* ── Site sub-tabs: Enquire NNC / Enquire NNC Digital ── */}
            <div className="enq-site-tabs">
              <button
                className={`enq-site-tab${enqSite === "nnc" ? " active" : ""}`}
                onClick={() => { setEnqSite("nnc"); setFilters(f => ({ ...f, page: 1 })); }}
              >
                <MessageSquare size={15} /> Enquire NNC
                {unseenCounts.nnc > 0 && (
                  <span className="enq-tab-badge" title={`${unseenCounts.nnc} new enquiries`}>
                    {unseenCounts.nnc > 99 ? "99+" : unseenCounts.nnc}
                  </span>
                )}
              </button>
              <button
                className={`enq-site-tab${enqSite === "nncdigital" ? " active" : ""}`}
                onClick={() => { setEnqSite("nncdigital"); setFilters(f => ({ ...f, page: 1 })); }}
              >
                <TrendingUp size={15} /> Enquire NNC Digital
                {unseenCounts.nncdigital > 0 && (
                  <span className="enq-tab-badge" title={`${unseenCounts.nncdigital} new enquiries`}>
                    {unseenCounts.nncdigital > 99 ? "99+" : unseenCounts.nncdigital}
                  </span>
                )}
              </button>
            </div>

            {/* Leads dashboard — each card filters the list (Converted opens Projects) */}
            <div className="enq-dash">
              {[
                {
                  key: "total", tone: "violet", icon: <MessageSquare size={20} />,
                  label: "Total Leads", val: stats.total,
                  sub: `${Math.max(0, stats.total - stats.converted)} open`,
                  active: !filters.followUp && !filters.status,
                  onClick: () => setFilters(f => ({ ...f, followUp: "", status: "", page: 1 })),
                  title: "Show all open leads",
                },
                {
                  key: "converted", tone: "green", icon: <CheckCircle size={20} />,
                  label: "Converted Leads", val: stats.converted,
                  sub: `${stats.total ? Math.round((stats.converted / stats.total) * 100) : 0}% of all leads`,
                  onClick: () => navigate("/leads"),
                  title: "Converted leads are in Projects",
                },
                {
                  key: "scheduled", tone: "blue", icon: <Calendar size={20} />,
                  label: "Follow-up Leads", val: stats.scheduledFollowUps,
                  sub: stats.overdueFollowUps > 0 ? `${stats.overdueFollowUps} overdue` : "with a follow-up date",
                  subTone: stats.overdueFollowUps > 0 ? "red" : "",
                  active: filters.followUp === "scheduled",
                  onClick: () => setFilters(f => ({ ...f, followUp: f.followUp === "scheduled" ? "" : "scheduled", status: "", page: 1 })),
                  title: "Show leads that have a follow-up scheduled",
                },
                {
                  key: "today", tone: "amber", icon: <Clock size={20} />,
                  label: "Today's Follow-ups", val: stats.todayFollowUps,
                  sub: "due today",
                  active: filters.followUp === "today",
                  onClick: () => setFilters(f => ({ ...f, followUp: f.followUp === "today" ? "" : "today", status: "", page: 1 })),
                  title: "Show follow-ups due today",
                },
                {
                  key: "lost", tone: "red", icon: <XCircle size={20} />,
                  label: "Lost Leads", val: stats.lost,
                  sub: `${stats.total ? Math.round((stats.lost / stats.total) * 100) : 0}% of all leads`,
                  active: filters.status === "lost",
                  onClick: () => setFilters(f => ({ ...f, status: f.status === "lost" ? "" : "lost", followUp: "", page: 1 })),
                  title: "Show lost leads",
                },
              ].map(c => (
                <button
                  key={c.key}
                  type="button"
                  className={`enq-dash-card ${c.tone}${c.active ? " active" : ""}`}
                  onClick={c.onClick}
                  title={c.title}
                >
                  <div className="enq-dash-icon">{c.icon}</div>
                  <div className="enq-dash-text">
                    <div className="enq-dash-val">{c.val}</div>
                    <div className="enq-dash-label">{c.label}</div>
                    <div className={`enq-dash-sub ${c.subTone || ""}`}>{c.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div className="enq-filter-bar">
              {/* Date range quick filters */}
              <div className="enq-date-range-group">
                {[
                  { key: "",      label: "All Time" },
                  { key: "today", label: "Today" },
                  { key: "week",  label: "This Week" },
                  { key: "month", label: "This Month" },
                  { key: "year",  label: "This Year" },
                ].map(dr => (
                  <button
                    key={dr.key}
                    className={`enq-dr-btn${filters.dateRange === dr.key ? " active" : ""}`}
                    onClick={() => setFilter("dateRange", dr.key)}
                  >
                    {dr.label}
                  </button>
                ))}
              </div>

              {/* Follow-up quick filters */}
              <div className="enq-date-range-group enq-fu-group">
                <span className="enq-fu-group-label"><Calendar size={13} /> Follow-ups</span>
                {FOLLOW_UP_VIEWS.map(v => (
                  <button
                    key={v.key}
                    className={`enq-dr-btn enq-fu-btn-${v.key || "all"}${filters.followUp === v.key ? " active" : ""}`}
                    onClick={() => setFilter("followUp", v.key)}
                  >
                    {v.label}
                    {v.stat && stats[v.stat] > 0 && <span className="enq-fu-count">{stats[v.stat]}</span>}
                  </button>
                ))}
              </div>

              <div className="enq-filter-selects">
                <select value={filters.branch} onChange={e => setFilter("branch", e.target.value)}>
                  <option value="">All Branches</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={filters.status} onChange={e => setFilter("status", e.target.value)}>
                  <option value="">All Statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <select value={filters.source} onChange={e => { setFilter("source", e.target.value); if (e.target.value !== "Website") setFilter("landingPage", ""); }}>
                  <option value="">All Sources</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.service} onChange={e => setFilter("service", e.target.value)}>
                  <option value="">All Services</option>
                  {SERVICES.map(s => <option key={s.label} value={s.label}>{s.icon} {s.label}</option>)}
                </select>
                <select
                  value={filters.landingPage}
                  onChange={e => { setFilter("landingPage", e.target.value); if (e.target.value) setFilter("source", "Website"); }}
                  title="Filter by website landing page"
                >
                  <option value="">All Landing Pages</option>
                  {LANDING_PAGES.map(p => <option key={p.value} value={p.value}>🌐 {p.label}</option>)}
                </select>
                <div className="enq-search-wrap">
                  <Search size={14} />
                  <input
                    placeholder="Search name, phone, company…"
                    value={filters.q}
                    onChange={e => setFilter("q", e.target.value)}
                  />
                </div>
                <button className="enq-filter-clear" onClick={clearFilters}>Clear All</button>
              </div>
            </div>

            {/* Table */}
            <div className="enq-table-section">
              <div className="enq-table-card">
                <div className="enq-table-head">
                  <span>
                    <span className="enq-table-head-title">
                      {filters.followUp === "scheduled" ? "Leads with Follow-ups"
                        : filters.status === "lost"       ? "Lost Leads"
                        : filters.followUp === "today"    ? "Today's Follow-ups"
                        : filters.followUp === "overdue"  ? "Overdue Follow-ups"
                        : filters.followUp === "upcoming" ? "Upcoming Follow-ups"
                        : filters.dateRange === "today" ? "Today's Enquiries"
                        : filters.dateRange === "week"  ? "This Week's Enquiries"
                        : filters.dateRange === "month" ? "This Month's Enquiries"
                        : filters.dateRange === "year"  ? "This Year's Enquiries"
                        : "All Enquiries"}
                    </span>
                    <span className="enq-table-head-count">({totalCount})</span>
                  </span>
                  <button
                    className="enq-export-inline"
                    onClick={handleExport}
                    disabled={exporting}
                    title="Export current view as CSV"
                  >
                    <Download size={13} /> {exporting ? "Exporting…" : "Export CSV"}
                  </button>
                </div>
                {loading ? (
                  <div className="enq-loading"><RefreshCcw size={28} className="enq-spin" /></div>
                ) : enquiries.length === 0 ? (
                  <div className="enq-empty">
                    <div className="enq-empty-icon"><MessageSquare size={40} /></div>
                    <div className="enq-empty-text">
                      {filters.followUp === "today" ? "No follow-ups due today" : "No enquiries found"}
                    </div>
                    <div className="enq-empty-sub">Try adjusting filters or add a new enquiry</div>
                  </div>
                ) : (
                  <div className="enq-table-wrap">
                    <table className="enq-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name / Phone</th>
                          <th>Company</th>
                          <th>Services</th>
                          <th>Source</th>
                          <th>Branch</th>
                          <th>Assigned To</th>
                          <th>Follow-up</th>
                          <th>Proposal</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enquiries.map((enq, idx) => (
                          <tr
                            key={enq._id}
                            className={`enq-row-click${!enq.seen ? " enq-row-unseen" : ""}`}
                            title="Click to open details"
                            onClick={e => {
                              // Buttons inside the row (edit, follow-up, landing-page badge…) keep their own action
                              if (e.target.closest("button, a, input, select, .enq-landing-badge")) return;
                              openView(enq);
                            }}
                          >
                            <td>
                              {!enq.seen && <span className="enq-new-dot" title="New enquiry" />}
                              {(filters.page - 1) * PAGE_SIZE + idx + 1}
                            </td>
                            <td>
                              <div className="enq-name">{enq.name}</div>
                              <div className="enq-phone">{enq.phone}</div>
                            </td>
                            <td><span className="enq-company">{enq.company || "—"}</span></td>
                            <td>
                              <div className="enq-svc-badges">
                                {(enq.services || []).slice(0, 2).map(s => (
                                  <span key={s} className="enq-svc-badge">{s}</span>
                                ))}
                                {(enq.services || []).length > 2 && (
                                  <span className="enq-svc-more">+{enq.services.length - 2} more</span>
                                )}
                                {(!enq.services || enq.services.length === 0) && <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                              </div>
                            </td>
                            <td>
                              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                                <span>{enq.source || "—"}</span>
                                {enq.source === "Website" && enq.landingPage && (
                                  <span
                                    className="enq-landing-badge"
                                    title={enq.landingPage}
                                    onClick={() => setFilter("landingPage", enq.landingPage)}
                                    style={{ cursor:"pointer" }}
                                  >
                                    🌐 {enq.landingPage}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{enq.branch || "—"}</td>
                            <td>{enq.assignedTo || "—"}</td>
                            <td>
                              {enq.followUpDate ? (
                                <button
                                  className={`enq-fu-chip enq-fu-${followUpState(enq) || "none"}`}
                                  title="Change follow-up"
                                  onClick={() => setFuModal(enq)}
                                >
                                  {followUpState(enq) === "overdue" && <AlertTriangle size={11} />}
                                  {followUpState(enq) === "today" ? "Today" : fmtDate(enq.followUpDate)}
                                </button>
                              ) : "—"}
                            </td>
                            <td>
                              {enq.proposalStatus ? (
                                <button className="enq-ps-cell" title="Update proposal" onClick={() => setPropModal(enq)}>
                                  <span className={`enq-ps-badge ${PROPOSAL_STATUS_META[enq.proposalStatus]?.cls || ""}`}>
                                    {proposalLabel(enq.proposalStatus)}
                                  </span>
                                  {lastProposalComment(enq) && (
                                    <span className="enq-ps-cell-text" title={lastProposalComment(enq).text}>
                                      {lastProposalComment(enq).text}
                                    </span>
                                  )}
                                </button>
                              ) : "—"}
                            </td>
                            <td>
                              <span className={`enq-status ${getStatusClass(enq.status)}`}>
                                {enq.status || "new"}
                              </span>
                            </td>
                            <td>
                              <div className="enq-actions">
                                <button
                                  className={`enq-btn-icon${!enq.seen ? " enq-view-glow" : ""}`}
                                  title={enq.seen ? "View" : "New — click to view"}
                                  onClick={() => openView(enq)}
                                >
                                  <Eye size={15} />
                                </button>
                                <button className="enq-btn-icon" title="Edit" onClick={() => openEdit(enq)}>
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  className="enq-btn-icon convert"
                                  title={enq.convertedToLead ? "Already converted" : "Convert to lead"}
                                  disabled={!!enq.convertedToLead}
                                  onClick={() => handleConvert(enq._id)}
                                >
                                  <ArrowRightCircle size={15} />
                                </button>
                                {isMasterAdmin() && (
                                  <button className="enq-btn-icon danger" title="Delete" onClick={() => handleDelete(enq._id)}>
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="enq-pagination">
                    <span className="enq-page-info">
                      Showing {(filters.page - 1) * PAGE_SIZE + 1}–{Math.min(filters.page * PAGE_SIZE, totalCount)} of {totalCount}
                    </span>
                    <button
                      className="enq-page-btn"
                      title="Previous page"
                      disabled={filters.page <= 1}
                      onClick={() => goToPage(filters.page - 1)}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {pageNumbers(filters.page, totalPages).map((n, i) =>
                      n === "…" ? (
                        <span key={`gap-${i}`} className="enq-page-gap">…</span>
                      ) : (
                        <button
                          key={n}
                          className={`enq-page-btn${n === filters.page ? " active" : ""}`}
                          onClick={() => goToPage(n)}
                        >
                          {n}
                        </button>
                      )
                    )}
                    <button
                      className="enq-page-btn"
                      title="Next page"
                      disabled={filters.page >= totalPages}
                      onClick={() => goToPage(filters.page + 1)}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ─── FORM VIEW ──────────────────────────────── */}
        {activeTab === "enquiries" && mode === "form" && (
          <div className="enq-form-view">
            {/* Form header */}
            <div className="enq-form-subheader">
              <button className="enq-back-btn" onClick={() => setMode("list")}>
                <ChevronLeft size={15} /> Back
              </button>
              <div>
                <div className="enq-form-heading">{editingId ? "Edit Enquiry" : "New Enquiry"}</div>
                <div className="enq-form-subheading">Fill in the client details and service requirements</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button className="enq-save-btn" disabled={saving} onClick={handleSave} style={{ padding: "10px 24px" }}>
                  {saving ? "Saving…" : editingId ? "Update Enquiry" : "Create Enquiry"}
                </button>
              </div>
            </div>

            <div className="enq-form-2col">
              {/* Left column: main content */}
              <div className="enq-form-left">
                {/* Contact Information */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">
                    <span className="enq-card-icon">👤</span> Contact Information
                  </div>
                  <div className="enq-form-card-body">
                    <div className="enq-form-grid">
                      <div className="enq-field">
                        <label className="enq-label">Full Name <span className="enq-req">*</span></label>
                        <input className="enq-input" value={formData.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Rahul Sharma" />
                      </div>
                      <div className="enq-field">
                        <label className="enq-label">Phone <span className="enq-req">*</span></label>
                        <input className="enq-input" value={formData.phone} onChange={e => setField("phone", e.target.value)} placeholder="+91 9900000000" />
                      </div>
                      <div className="enq-field">
                        <label className="enq-label">Email Address</label>
                        <input className="enq-input" type="email" value={formData.email} onChange={e => setField("email", e.target.value)} placeholder="email@company.com" />
                      </div>
                      <div className="enq-field">
                        <label className="enq-label">Company / Business</label>
                        <input className="enq-input" value={formData.company} onChange={e => setField("company", e.target.value)} placeholder="Company name" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Services */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">
                    <span className="enq-card-icon">🛠️</span> Services Required
                    {formData.services.length > 0 && (
                      <span className="enq-svc-count">{formData.services.length} selected</span>
                    )}
                  </div>
                  <div className="enq-form-card-body">
                    <div className="enq-services-grid">
                      {SERVICES.map(svc => (
                        <label
                          key={svc.label}
                          className={`enq-svc-check ${formData.services.includes(svc.label) ? "checked" : ""}`}
                          onClick={() => toggleService(svc.label)}
                        >
                          <span className="enq-svc-icon">{svc.icon}</span>
                          <span className="enq-svc-check-label">{svc.label}</span>
                          {formData.services.includes(svc.label) && (
                            <span className="enq-svc-tick">✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">
                    <span className="enq-card-icon">📝</span> Requirements & Notes
                  </div>
                  <div className="enq-form-card-body">
                    <textarea
                      className="enq-textarea"
                      style={{ width: "100%", boxSizing: "border-box" }}
                      rows={5}
                      value={formData.requirements}
                      onChange={e => setField("requirements", e.target.value)}
                      placeholder="Describe what the client is looking for — project scope, timeline, specific features, references, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Right column: sidebar */}
              <div className="enq-form-sidebar">
                {/* Assignment & Status */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">
                    <span className="enq-card-icon">⚙️</span> Assignment
                  </div>
                  <div className="enq-form-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="enq-field">
                      <label className="enq-label">Branch <span className="enq-req">*</span></label>
                      <select className="enq-select" value={formData.branch} onChange={e => setField("branch", e.target.value)}>
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="enq-field">
                      <label className="enq-label">Assigned To</label>
                      <input className="enq-input" value={formData.assignedTo} onChange={e => setField("assignedTo", e.target.value)} placeholder="Sales person name" />
                    </div>
                    <div className="enq-field">
                      <label className="enq-label">Source</label>
                      <select className="enq-select" value={formData.source} onChange={e => setField("source", e.target.value)}>
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">
                    <span className="enq-card-icon">📊</span> Status
                  </div>
                  <div className="enq-form-card-body">
                    <div className="enq-status-pills">
                      {STATUSES.map(s => (
                        <button
                          key={s}
                          type="button"
                          className={`enq-status-pill ${getStatusClass(s)}${formData.status === s ? " pill-active" : ""}`}
                          onClick={() => setField("status", s)}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Budget & Follow-up */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">
                    <span className="enq-card-icon">💰</span> Budget & Timeline
                  </div>
                  <div className="enq-form-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="enq-budget-row">
                      <div className="enq-field" style={{ flex: 1 }}>
                        <label className="enq-label">Min (₹)</label>
                        <input className="enq-input" type="number" value={formData.budgetMin} onChange={e => setField("budgetMin", e.target.value)} placeholder="0" />
                      </div>
                      <div className="enq-budget-dash">–</div>
                      <div className="enq-field" style={{ flex: 1 }}>
                        <label className="enq-label">Max (₹)</label>
                        <input className="enq-input" type="number" value={formData.budgetMax} onChange={e => setField("budgetMax", e.target.value)} placeholder="0" />
                      </div>
                    </div>
                    <div className="enq-field">
                      <label className="enq-label">GST Applicable</label>
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => setField("gstApplicable", true)}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 8, border: "1.5px solid",
                            borderColor: formData.gstApplicable ? "#2563eb" : "#d1d5db",
                            background: formData.gstApplicable ? "#eff6ff" : "#fff",
                            color: formData.gstApplicable ? "#2563eb" : "#6b7280",
                            fontWeight: 600, fontSize: 13, cursor: "pointer",
                          }}
                        >With GST</button>
                        <button
                          type="button"
                          onClick={() => setField("gstApplicable", false)}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 8, border: "1.5px solid",
                            borderColor: !formData.gstApplicable ? "#2563eb" : "#d1d5db",
                            background: !formData.gstApplicable ? "#eff6ff" : "#fff",
                            color: !formData.gstApplicable ? "#2563eb" : "#6b7280",
                            fontWeight: 600, fontSize: 13, cursor: "pointer",
                          }}
                        >Without GST</button>
                      </div>
                    </div>
                    <div className="enq-field">
                      <label className="enq-label">Follow-up Date</label>
                      <input className="enq-input" type="date" value={formData.followUpDate} onChange={e => setField("followUpDate", e.target.value)} />
                      {formData.followUpDate && (
                        <div className="enq-followup-hint">
                          <Calendar size={11} /> Will be added to Calendar
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="enq-form-sidebar-actions">
                  <button className="enq-save-btn" disabled={saving} onClick={handleSave} style={{ width: "100%" }}>
                    {saving ? "Saving…" : editingId ? "Update Enquiry" : "Create Enquiry"}
                  </button>
                  <button className="enq-cancel-btn" onClick={() => setMode("list")} style={{ width: "100%" }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── DETAIL VIEW ──────────────────────────────── */}
        {activeTab === "enquiries" && mode === "view" && viewingEnquiry && (
          <div className="enq-form-view">
            <div className="enq-detail-topbar">
              <div className="enq-detail-topbar-left">
                <button className="enq-back-btn" onClick={() => setMode("list")}>
                  <ChevronLeft size={15} /> Back
                </button>
                <div>
                  <div className="enq-detail-name">{viewingEnquiry.name}</div>
                  <div className="enq-detail-phone">{viewingEnquiry.phone}</div>
                </div>
                <span className={`enq-status ${getStatusClass(viewingEnquiry.status)}`}>
                  {viewingEnquiry.status}
                </span>
              </div>
              <div className="enq-detail-acts">
                <button
                  className="enq-convert-btn"
                  disabled={!!viewingEnquiry.convertedToLead}
                  onClick={() => handleConvert(viewingEnquiry._id)}
                >
                  <ArrowRightCircle size={15} />
                  {viewingEnquiry.convertedToLead ? "Converted" : "Convert to Lead"}
                </button>
                <button className="enq-btn-sec" onClick={() => openEdit(viewingEnquiry)}>
                  <Edit2 size={14} /> Edit
                </button>
              </div>
            </div>

            <div className="enq-detail-body">
              <div className="enq-detail-cols">
                {/* Left: all fields */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">Enquiry Details</div>
                  <div className="enq-form-card-body">
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Company</div>
                      <div className="enq-detail-field-val">{viewingEnquiry.company || "—"}</div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Email</div>
                      <div className="enq-detail-field-val">{viewingEnquiry.email || "—"}</div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Services</div>
                      <div className="enq-svc-badges" style={{ marginTop: 4 }}>
                        {(viewingEnquiry.services || []).map(s => (
                          <span key={s} className="enq-svc-badge">{s}</span>
                        ))}
                        {(!viewingEnquiry.services || viewingEnquiry.services.length === 0) && <span style={{ color: "#94a3b8" }}>—</span>}
                      </div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Source</div>
                      <div className="enq-detail-field-val">{viewingEnquiry.source || "—"}</div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Branch</div>
                      <div className="enq-detail-field-val">{viewingEnquiry.branch || "—"}</div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Budget</div>
                      <div className="enq-detail-field-val">
                        {viewingEnquiry.budgetMin || viewingEnquiry.budgetMax
                          ? `₹${viewingEnquiry.budgetMin || 0} – ₹${viewingEnquiry.budgetMax || 0}`
                          : "—"}
                      </div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Assigned To</div>
                      <div className="enq-detail-field-val">{viewingEnquiry.assignedTo || "—"}</div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Follow-up Date</div>
                      <div className="enq-detail-field-val">
                        {viewingEnquiry.followUpDate ? (
                          <span className={`enq-fu-chip enq-fu-${followUpState(viewingEnquiry) || "none"}`}>
                            {followUpState(viewingEnquiry) === "overdue" && <AlertTriangle size={11} />}
                            {fmtDate(viewingEnquiry.followUpDate)}
                            {followUpState(viewingEnquiry) === "today"   && " · Today"}
                            {followUpState(viewingEnquiry) === "overdue" && " · Overdue"}
                          </span>
                        ) : "—"}
                      </div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Proposal</div>
                      <div className="enq-detail-field-val">
                        {viewingEnquiry.proposalStatus ? (
                          <>
                            <span className={`enq-ps-badge ${PROPOSAL_STATUS_META[viewingEnquiry.proposalStatus]?.cls || ""}`}>
                              {proposalLabel(viewingEnquiry.proposalStatus)}
                            </span>
                            {lastProposalComment(viewingEnquiry) && (
                              <div className="enq-ps-detail-text">{lastProposalComment(viewingEnquiry).text}</div>
                            )}
                          </>
                        ) : "—"}
                      </div>
                    </div>
                    <div className="enq-detail-field">
                      <div className="enq-detail-field-label">Created</div>
                      <div className="enq-detail-field-val">{fmtDateTime(viewingEnquiry.createdAt)}</div>
                    </div>
                    {viewingEnquiry.requirements && (
                      <div className="enq-detail-field">
                        <div className="enq-detail-field-label">Requirements</div>
                        <div className="enq-detail-field-val" style={{ whiteSpace: "pre-wrap" }}>{viewingEnquiry.requirements}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Activity Log */}
                <div className="enq-form-card">
                  <div className="enq-form-card-title">Activity Log</div>
                  <div className="enq-form-card-body">
                    {(viewingEnquiry.activityLog && viewingEnquiry.activityLog.length > 0) ? (
                      <div className="enq-activity-timeline">
                        {[...(viewingEnquiry.activityLog)].reverse().map((log, i) => (
                          <div key={i} className="enq-activity-item">
                            <div className="enq-activity-dot">
                              <Activity size={12} color="#7c3aed" />
                            </div>
                            <div className="enq-activity-content">
                              <div className="enq-activity-action">{log.action}</div>
                              {log.note && <div className="enq-activity-note">{log.note}</div>}
                              <div className="enq-activity-meta">
                                {log.by && <span>{log.by} · </span>}
                                {fmtDateTime(log.at || log.date || log.createdAt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                        No activity yet
                      </div>
                    )}

                    {/* Add Note Form */}
                    <div className="enq-add-note-form">
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 4 }}>Add Activity Note</div>
                      <div className="enq-field">
                        <label className="enq-label">Action</label>
                        <input
                          className="enq-input"
                          placeholder="e.g. Called, Sent Proposal, Follow-up done…"
                          value={noteForm.action}
                          onChange={e => setNoteForm(n => ({ ...n, action: e.target.value }))}
                        />
                      </div>
                      <div className="enq-field">
                        <label className="enq-label">Note</label>
                        <textarea
                          className="enq-textarea"
                          rows={3}
                          placeholder="Additional notes…"
                          value={noteForm.note}
                          onChange={e => setNoteForm(n => ({ ...n, note: e.target.value }))}
                          style={{ width: "100%", boxSizing: "border-box" }}
                        />
                      </div>
                      <button
                        className="enq-note-save-btn"
                        disabled={savingNote}
                        onClick={() => addActivity(viewingEnquiry._id)}
                      >
                        {savingNote ? "Saving…" : "Save Note"}
                      </button>
                    </div>

                    {/* Follow-up + Proposal actions */}
                    <div className="enq-lead-acts">
                      <button type="button" className="enq-lead-act fu" onClick={() => setFuModal(viewingEnquiry)}>
                        <CalendarPlus size={16} />
                        <span>
                          <strong>Follow-up</strong>
                          <small>
                            {viewingEnquiry.followUpDate ? `Next: ${fmtDate(viewingEnquiry.followUpDate)}` : "Schedule a follow-up"}
                          </small>
                        </span>
                      </button>
                      <button type="button" className="enq-lead-act ps" onClick={() => setPropModal(viewingEnquiry)}>
                        <FileText size={16} />
                        <span>
                          <strong>Proposal</strong>
                          <small>
                            {viewingEnquiry.proposalStatus ? `Status: ${proposalLabel(viewingEnquiry.proposalStatus)}` : "Set status & comment"}
                          </small>
                        </span>
                      </button>
                      {viewingEnquiry.status === "lost" ? (
                        <button
                          type="button"
                          className="enq-lead-act reopen"
                          onClick={() => { if (window.confirm(`Reopen ${viewingEnquiry.name}?`)) setLost(viewingEnquiry, false); }}
                        >
                          <RefreshCcw size={16} />
                          <span>
                            <strong>Reopen</strong>
                            <small>Lead is marked lost</small>
                          </span>
                        </button>
                      ) : (
                        <button type="button" className="enq-lead-act lost" onClick={() => setLostModal(viewingEnquiry)}>
                          <XCircle size={16} />
                          <span>
                            <strong>Lost</strong>
                            <small>Mark this lead as lost</small>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {fuModal && (
        <FollowUpModal
          enquiry={fuModal}
          onSave={(date, note) => saveFollowUp(fuModal, date, note)}
          onClear={() => clearFollowUp(fuModal)}
          onClose={() => setFuModal(null)}
        />
      )}
      {propModal && (
        <ProposalModal
          enquiry={propModal}
          onSave={(status, comment) => saveProposal(propModal, status, comment)}
          onClose={() => setPropModal(null)}
        />
      )}
      {lostModal && (
        <LostModal
          enquiry={lostModal}
          onSave={(reason) => setLost(lostModal, true, reason)}
          onClose={() => setLostModal(null)}
        />
      )}
    </div>
  );
}
