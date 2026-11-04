import React, { useEffect, useMemo, useState } from "react";
import { toast } from "../utils/toast";
import "./LeadDrawer.css";
import GstPicker from "./GstPicker";
import { calcGst, calcRemaining } from "./gst";
import ProjectIntegrations from "../pages/Integrations/ProjectIntegrations";
import ProjectBilling from "../pages/ProjectBilling/ProjectBilling";
import ProjectDevelopers from "./ProjectDevelopers";
import { PROJECT_STAGES, PROJECT_STAGE_COLOR, projectStageLabel, projectStagePatch } from "./projectStages";

const money = (n) => {
  try {
    if (n == null) return "₹0";
    return `₹${Number(n).toLocaleString("en-IN")}`;
  } catch {
    return "₹0";
  }
};

const chipCls = (s = "") => String(s).toLowerCase().replace(/\s+/g, "-");

const formatDateTime = (value) => {
  try {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

const formatDate = (value) => {
  try {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
  } catch {
    return "-";
  }
};

const getInitials = (name = "") => {
  try {
    if (!name) return "L";
    return String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("");
  } catch {
    return "L";
  }
};

const EMPTY_EDIT_FORM = {
  _id: "",
  name: "",
  phone: "",
  email: "",
  business: "",
  industry: "",
  location: "",
  requirements: "",
  branch: "Bangalore",
  source: "WhatsApp",
  stage: "Lead Capture",
  projectStage: "",
  priority: "Hot",
  value: "",
  advanceReceived: "",
  advanceReceivedDate: "",
  agreedTimeline: "",
  onboardedDate: "",
  rep: "",
  projectCompleted: false,
  projectCompletionDate: "",
  gstApplicable: false,
  gstRate: 18,
};

const EmptyState = ({ title, sub }) => {
  return (
    <div className="ldEmpty">
      <div className="ldEmptyIcon">◎</div>
      <div className="ldEmptyTitle">{title}</div>
      <div className="ldEmptySub">{sub}</div>
    </div>
  );
};

export default function LeadDrawer({ open, leadId, apiBase, onClose, onLeadUpdated }) {
  const [activeTab, setActiveTab] = useState("Profile");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lead, setLead] = useState(null);

  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [logType, setLogType] = useState("Outbound Call");
  const [logSummary, setLogSummary] = useState("");
  const [logSaving, setLogSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [docTag, setDocTag] = useState("Project Document");

  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupSaving, setFollowupSaving] = useState(false);
  const [followupForm, setFollowupForm] = useState({
    dayIndex: "",
    title: "",
    channel: "Call",
    status: "Pending",
    dueDate: "",
    done: false,
  });

  const [emailResponseId, setEmailResponseId]   = useState(null);  // logId being replied to
  const [emailResponseText, setEmailResponseText] = useState("");
  const [emailResponseSaving, setEmailResponseSaving] = useState(false);
  const [expandedEmailId, setExpandedEmailId]   = useState(null); // logId expanded for full view

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [planning, setPlanning] = useState(false);

  const headerSubtitle = useMemo(() => {
    try {
      if (!lead) return "";
      const parts = [];
      if (lead.industry) parts.push(lead.industry);
      if (lead.branch) parts.push(lead.branch);
      if (lead.rep) parts.push(`Owner: ${lead.rep}`);
      return parts.join(" • ");
    } catch {
      return "";
    }
  }, [lead]);

  const statCards = useMemo(() => {
    try {
      return [
        {
          label: "Deal Value",
          value: money(lead?.value || 0),
        },
        {
          label: "Docs",
          value: String(lead?.documents?.length || lead?.docs || 0),
        },
        {
          label: "Follow-ups",
          value: String(lead?.followups?.length || 0),
        },
        {
          label: "Notes",
          value: String(lead?.notes?.length || 0),
        },
      ];
    } catch {
      return [];
    }
  }, [lead]);

  const fetchLead = async () => {
    try {
      if (!leadId) return;

      setLoading(true);
      setErr("");

      const token = localStorage.getItem("nnc_token");

      const res = await fetch(`${apiBase}/api/leads/${leadId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to fetch lead");
      }

      setLead(json.data);
      setActiveTab("Profile");
    } catch (e) {
      setErr(e.message || "Failed to fetch lead");
      setLead(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      if (open && leadId) {
        fetchLead();
      }
    } catch (error) {
      console.error(error);
    }
  }, [open, leadId]);

  const close = () => {
    try {
      setLogOpen(false);
      setLogSummary("");
      setNoteText("");
      setFollowupOpen(false);
      setEditOpen(false);
      setPlanning(false);
      setEditForm(EMPTY_EDIT_FORM);
      setFollowupForm({
        dayIndex: "",
        title: "",
        channel: "Call",
        status: "Pending",
        dueDate: "",
        done: false,
      });
      onClose?.();
    } catch (error) {
      console.error(error);
    }
  };

  const saveNote = async () => {
    try {
      if (!noteText.trim()) return;

      setSavingNote(true);

      const token = localStorage.getItem("nnc_token");

      const res = await fetch(`${apiBase}/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: noteText, by: lead?.rep || "User" }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to save note");
      }

      setLead((prev) => ({ ...prev, notes: json.data }));
      setNoteText("");
    } catch (e) {
      toast.error(e.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const addLog = async () => {
    try {
      if (!logSummary.trim()) return;

      setLogSaving(true);

      const token = localStorage.getItem("nnc_token");

      const res = await fetch(`${apiBase}/api/leads/${leadId}/comms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: logType,
          summary: logSummary,
          by: lead?.rep || "User",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to add log");
      }

      setLead((prev) => ({ ...prev, commLogs: json.data }));
      setLogSummary("");
      setLogOpen(false);
    } catch (e) {
      toast.error(e.message || "Failed to add log");
    } finally {
      setLogSaving(false);
    }
  };

  const addFollowup = async () => {
    try {
      if (!followupForm.title.trim()) {
        toast.warning("Follow-up title is required");
        return;
      }

      setFollowupSaving(true);

      const token = localStorage.getItem("nnc_token");

      const res = await fetch(`${apiBase}/api/leads/${leadId}/followups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          dayIndex: followupForm.dayIndex ? Number(followupForm.dayIndex) : undefined,
          title: followupForm.title,
          channel: followupForm.channel,
          status: followupForm.status,
          dueDate: followupForm.dueDate || null,
          done: followupForm.done,
          by: lead?.rep || "User",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to add follow-up");
      }

      setLead((prev) => ({ ...prev, followups: json.data }));
      setFollowupOpen(false);
      setFollowupForm({
        dayIndex: "",
        title: "",
        channel: "Call",
        status: "Pending",
        dueDate: "",
        done: false,
      });
    } catch (e) {
      toast.error(e.message || "Failed to add follow-up");
    } finally {
      setFollowupSaving(false);
    }
  };

  const uploadDoc = async (file) => {
    try {
      if (!file) return;

      setUploading(true);

      const token = localStorage.getItem("nnc_token");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("tag", docTag);
      fd.append("by", lead?.rep || "User");
      fd.append("name", file.name);

      const res = await fetch(`${apiBase}/api/leads/${leadId}/docs`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to upload document");
      }

      setLead((prev) => ({
        ...prev,
        documents: json.data,
        docs: json.data?.length || 0,
      }));
      setActiveTab("Docs");
    } catch (e) {
      toast.error(e.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const saveBant = async (bantData) => {
    const token = localStorage.getItem("nnc_token");
    const res = await fetch(`${apiBase}/api/leads/${leadId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ bantDetails: bantData }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to update BANT");
    setLead(json.data);
    if (typeof onLeadUpdated === "function") onLeadUpdated(json.data);
  };

  const addToTodayPlan = async () => {
    try {
      if (!lead?._id) {
        toast.error("Lead not found");
        return;
      }

      setPlanning(true);

      const token = localStorage.getItem("nnc_token");

      const res = await fetch(`${apiBase}/api/today-plan/from-lead/${lead._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          taskType: "new_call",
          priority: lead?.priority === "Hot" ? "urgent" : "medium",
          section: "call_immediately",
          dueLabel: "ASAP",
          subtitle: lead?.requirements || lead?.business || "Lead follow-up scheduled for today",
          plannedDate: new Date().toISOString(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to add to today's plan");
      }

      toast.success(json?.message || "Added to today's plan");

      if (typeof onLeadUpdated === "function") {
        onLeadUpdated(json?.data || lead);
      }
    } catch (error) {
      console.error("addToTodayPlan error:", error);
      toast.error(error?.message || "Failed to add to today's plan");
    } finally {
      setPlanning(false);
    }
  };

  const addEmailResponse = async () => {
    try {
      if (!emailResponseText.trim() || !emailResponseId) return;
      setEmailResponseSaving(true);
      const token = localStorage.getItem("nnc_token");
      const res = await fetch(`${apiBase}/api/leads/${leadId}/email-logs/${emailResponseId}/response`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ response: emailResponseText.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to save response");
      setLead((prev) => ({ ...prev, emailLogs: json.data }));
      setEmailResponseId(null);
      setEmailResponseText("");
    } catch (e) {
      console.error("addEmailResponse error:", e);
      toast.error(e?.message || "Failed to save response");
    } finally {
      setEmailResponseSaving(false);
    }
  };

  const openEditModal = () => {
    try {
      if (!lead) return;

      setEditForm({
        _id: lead._id || "",
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        business: lead.business || "",
        industry: lead.industry || "",
        location: lead.location || "",
        requirements: lead.requirements || "",
        branch: lead.branch || "Bangalore",
        source: lead.source || "WhatsApp",
        stage: lead.stage || "Lead Capture",
        projectStage: lead.projectStage || "",
        priority: lead.priority || "Hot",
        value: lead.value > 0 ? Number(lead.value) : "",
        advanceReceived: lead.advanceReceived > 0 ? Number(lead.advanceReceived) : "",
        advanceReceivedDate: lead.advanceReceivedDate
          ? new Date(lead.advanceReceivedDate).toISOString().slice(0, 10)
          : "",
        agreedTimeline: lead.agreedTimeline > 0 ? Number(lead.agreedTimeline) : "",
        onboardedDate: lead.onboardedDate
          ? new Date(lead.onboardedDate).toISOString().slice(0, 10)
          : "",
        rep: lead.rep || "",
        projectCompleted: Boolean(lead.projectCompleted),
        projectCompletionDate: lead.projectCompletionDate
          ? new Date(lead.projectCompletionDate).toISOString().slice(0, 10)
          : "",
        gstApplicable: Boolean(lead.gstApplicable),
        gstRate: lead.gstRate || 18,
      });

      setEditOpen(true);
    } catch (error) {
      console.error("openEditModal error:", error);
    }
  };

  const closeEditModal = () => {
    try {
      setEditOpen(false);
      setEditForm(EMPTY_EDIT_FORM);
    } catch (error) {
      console.error("closeEditModal error:", error);
    }
  };

  const handleEditChange = (e) => {
    try {
      const { name, value, type, checked } = e.target;
      const numericFields = ["value", "advanceReceived", "agreedTimeline"];
      setEditForm((prev) => {
        const updated = {
          ...prev,
          [name]: type === "checkbox"
            ? checked
            : numericFields.includes(name)
            ? value   // keep as string while typing; convert only at submit
            : value,
        };
        if (name === "projectCompleted" && checked && !prev.projectCompletionDate) {
          updated.projectCompletionDate = new Date().toISOString().slice(0, 10);
        }
        // Keep the project stage in step with the "Project Completed" checkbox
        if (name === "projectCompleted") {
          if (checked) updated.projectStage = "Project Completed";
          else if (prev.projectStage === "Project Completed") updated.projectStage = "Deployed / Live";
        }
        return updated;
      });
    } catch (error) {
      console.error("handleEditChange error:", error);
    }
  };

  const handleEditSubmit = async (e) => {
    try {
      e.preventDefault();

      if (!String(editForm.name || "").trim()) {
        toast.warning("Name is required");
        return;
      }

      if (!String(editForm.phone || "").trim()) {
        toast.warning("Phone is required");
        return;
      }

      setEditSaving(true);

      const token = localStorage.getItem("nnc_token");

      const payload = {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        business: editForm.business,
        industry: editForm.industry,
        location: editForm.location,
        requirements: editForm.requirements,
        branch: editForm.branch,
        source: editForm.source,
        stage: editForm.stage,
        projectStage: editForm.projectStage,
        priority: editForm.priority,
        value: Number(editForm.value || 0),
        advanceReceived: Number(editForm.advanceReceived || 0),
        advanceReceivedDate: editForm.advanceReceivedDate || null,
        agreedTimeline: Number(editForm.agreedTimeline || 0),
        onboardedDate: editForm.onboardedDate || null,
        rep: editForm.rep,
        projectCompleted: editForm.projectCompleted,
        projectCompletionDate: editForm.projectCompletionDate || null,
        gstApplicable: editForm.gstApplicable,
        gstRate: Number(editForm.gstRate || 18),
      };

      const res = await fetch(`${apiBase}/api/leads/${editForm._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to update lead");
      }

      setLead(json.data);
      setEditOpen(false);
      setEditForm(EMPTY_EDIT_FORM);

      if (typeof onLeadUpdated === "function") {
        onLeadUpdated(json.data);
      }

      toast.success("Lead updated successfully");
    } catch (error) {
      console.error("handleEditSubmit error:", error);
      toast.error(error?.message || "Failed to update lead");
    } finally {
      setEditSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="ldOverlay" onClick={close}>
        <div className="ldPanel" onClick={(e) => e.stopPropagation()}>
          <div className="ldHeader">
            <div className="ldHeaderTop">
              <div className="ldAvatar">{getInitials(lead?.name)}</div>

              <div className="ldHeaderInfo">
                <div className="ldTitleRow">
                  <div className="ldTitle">{lead?.name || "Lead"}</div>
                  <span className={`ldBadge ${chipCls(lead?.priority || "Hot")}`}>
                    {lead?.priority || "Hot"}
                  </span>
                </div>

                <div className="ldSub">
                  {headerSubtitle || "Lead details and activity overview"}
                </div>

                <div className="ldChips">
                  <span
                    className="ldChip stage"
                    style={{ background: (PROJECT_STAGE_COLOR[lead?.projectStage || ""] || PROJECT_STAGE_COLOR[""]).bg, color: (PROJECT_STAGE_COLOR[lead?.projectStage || ""] || PROJECT_STAGE_COLOR[""]).color }}
                  >
                    {projectStageLabel(lead?.projectStage)}
                  </span>
                  <span className="ldChip light">{lead?.source || "Direct"}</span>
                  <span className="ldValue">{money(lead?.value || 0)}</span>
                </div>
              </div>
            </div>

            <div className="ldHeaderActions">
              <button
                className="ldBtn plan"
                type="button"
                onClick={addToTodayPlan}
                disabled={planning}
              >
                {planning ? "Adding..." : "Add to Today Plan"}
              </button>

              <button className="ldBtn edit" type="button" onClick={openEditModal}>
                Edit Lead
              </button>

              <button className="ldClose" type="button" onClick={close}>
                ×
              </button>
            </div>
          </div>

          <div className="ldStats">
            {statCards.map((item, idx) => (
              <div className="ldStatCard" key={idx}>
                <div className="ldStatLabel">{item.label}</div>
                <div className="ldStatValue">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="ldTabs">
            {["Profile", "BANT", "Follow-up", "Calls/WA", "History", "Emails", "Docs", "Notes", "Extras & Monthly", "Credential Vault"].map((t) => (
              <button
                key={t}
                type="button"
                className={`ldTab ${activeTab === t ? "active" : ""}`}
                onClick={() => setActiveTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="ldBody">
            {loading ? (
              <div className="ldLoadingWrap">
                <div className="ldLoader" />
                <div className="ldLoading">Loading lead details...</div>
              </div>
            ) : null}

            {err ? <div className="ldError">{err}</div> : null}

            {!loading && !err && lead ? (
              <>
                {activeTab === "Profile" && (<><ProjectDevelopers lead={lead} /><ProfileTab lead={lead} /></>)}
                {activeTab === "BANT" && <BantTab lead={lead} onBantSave={saveBant} />}
                {activeTab === "Follow-up" && (
                  <FollowupTab
                    lead={lead}
                    followupOpen={followupOpen}
                    setFollowupOpen={setFollowupOpen}
                    followupForm={followupForm}
                    setFollowupForm={setFollowupForm}
                    followupSaving={followupSaving}
                    addFollowup={addFollowup}
                  />
                )}
                {activeTab === "Calls/WA" && (
                  <CallsTab
                    lead={lead}
                    logOpen={logOpen}
                    setLogOpen={setLogOpen}
                    logType={logType}
                    setLogType={setLogType}
                    logSummary={logSummary}
                    setLogSummary={setLogSummary}
                    logSaving={logSaving}
                    addLog={addLog}
                  />
                )}
                {activeTab === "History" && <HistoryTab lead={lead} />}
                {activeTab === "Emails" && (
                  <EmailsTab
                    lead={lead}
                    emailResponseId={emailResponseId}
                    setEmailResponseId={setEmailResponseId}
                    emailResponseText={emailResponseText}
                    setEmailResponseText={setEmailResponseText}
                    emailResponseSaving={emailResponseSaving}
                    addEmailResponse={addEmailResponse}
                    expandedEmailId={expandedEmailId}
                    setExpandedEmailId={setExpandedEmailId}
                  />
                )}
                {activeTab === "Docs" && (
                  <DocsTab
                    lead={lead}
                    uploading={uploading}
                    docTag={docTag}
                    setDocTag={setDocTag}
                    uploadDoc={uploadDoc}
                    apiBase={apiBase}
                    onDocDeleted={(updatedDocs) => setLead(prev => ({ ...prev, documents: updatedDocs }))}
                  />
                )}
                {activeTab === "Notes" && (
                  <NotesTab
                    lead={lead}
                    noteText={noteText}
                    setNoteText={setNoteText}
                    savingNote={savingNote}
                    saveNote={saveNote}
                  />
                )}
                {activeTab === "Extras & Monthly" && <ProjectBilling lead={lead} />}
                {activeTab === "Credential Vault" && <ProjectIntegrations lead={lead} />}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {editOpen ? (
        <div className="ldEditOverlay" onClick={closeEditModal}>
          <div className="ldEditCard" onClick={(e) => e.stopPropagation()}>
            <div className="ldEditHeader">
              <h3>Edit Lead</h3>
              <button type="button" className="ldEditClose" onClick={closeEditModal}>
                ×
              </button>
            </div>

            <form className="ldEditForm" onSubmit={handleEditSubmit}>
              <div className="ldEditGrid">
                <div className="ldFormGroup">
                  <label>Name *</label>
                  <input
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    required
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Phone *</label>
                  <input
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    required
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Email</label>
                  <input
                    name="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Business</label>
                  <input
                    name="business"
                    value={editForm.business}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Industry</label>
                  <input
                    name="industry"
                    value={editForm.industry}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Location</label>
                  <input
                    name="location"
                    value={editForm.location}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Branch</label>
                  <select name="branch" value={editForm.branch} onChange={handleEditChange}>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mysore">Mysore</option>
                    <option value="Mumbai">Mumbai</option>
                  </select>
                </div>

                <div className="ldFormGroup">
                  <label>Source</label>
                  <select name="source" value={editForm.source} onChange={handleEditChange}>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Website">Website</option>
                    <option value="Call">Call</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>

                <div className="ldFormGroup">
                  <label>Project Stage</label>
                  <select
                    value={editForm.projectStage}
                    onChange={e => setEditForm(p => ({ ...p, ...projectStagePatch(p, e.target.value) }))}
                  >
                    <option value="">Not Started</option>
                    {PROJECT_STAGES.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>

                <div className="ldFormGroup">
                  <label>Priority</label>
                  <select name="priority" value={editForm.priority} onChange={handleEditChange}>
                    <option value="Hot">Hot</option>
                    <option value="Warm">Warm</option>
                    <option value="Cold">Cold</option>
                  </select>
                </div>

                <div className="ldFormGroup">
                  <label>Total Amount Agreed (₹){editForm.gstApplicable ? " — excl. GST" : ""}</label>
                  <input
                    type="number"
                    name="value"
                    value={editForm.value}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup" style={{ gridColumn: "1 / -1" }}>
                  <label>GST</label>
                  <GstPicker
                    value={editForm.value}
                    gstApplicable={editForm.gstApplicable}
                    gstRate={editForm.gstRate}
                    onChange={patch => setEditForm(p => ({ ...p, ...patch }))}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Advance Received (₹)</label>
                  <input
                    type="number"
                    name="advanceReceived"
                    value={editForm.advanceReceived}
                    onChange={handleEditChange}
                    placeholder="0"
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Advance Received Date</label>
                  <input
                    type="date"
                    name="advanceReceivedDate"
                    value={editForm.advanceReceivedDate}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Remaining Balance (₹){editForm.gstApplicable ? " — incl. GST" : ""}</label>
                  <input
                    type="number"
                    readOnly
                    value={calcRemaining(editForm.value, editForm.advanceReceived, editForm.gstApplicable, editForm.gstRate)}
                    className="ldReadOnly"
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Agreed Timeline (days)</label>
                  <input
                    type="number"
                    name="agreedTimeline"
                    value={editForm.agreedTimeline}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Final Payment Date</label>
                  <input
                    type="text"
                    readOnly
                    value={
                      editForm.agreedTimeline > 0
                        ? (() => {
                            const d = new Date();
                            d.setDate(d.getDate() + Number(editForm.agreedTimeline));
                            return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                          })()
                        : "—"
                    }
                    className="ldReadOnly"
                  />
                </div>


                <div className="ldFormGroup">
                  <label>Rep</label>
                  <input
                    name="rep"
                    value={editForm.rep}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup">
                  <label>Client Onboarded Date</label>
                  <input
                    type="date"
                    name="onboardedDate"
                    value={editForm.onboardedDate}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup ldFullWidth">
                  <label>Requirements</label>
                  <textarea
                    name="requirements"
                    rows={4}
                    value={editForm.requirements}
                    onChange={handleEditChange}
                  />
                </div>

                <div className="ldFormGroup ldFullWidth">
                  <div className="ldCompletedRow">
                    <label className="ldCheckLabel">
                      <input
                        type="checkbox"
                        name="projectCompleted"
                        checked={editForm.projectCompleted}
                        onChange={handleEditChange}
                      />
                      <span>Project Completed</span>
                    </label>
                    {editForm.projectCompleted && (
                      <div className="ldCompletedBadge">✓ Completed</div>
                    )}
                  </div>
                </div>

                {editForm.projectCompleted && (
                  <div className="ldFormGroup ldFullWidth">
                    <label>Project Completion Date</label>
                    <input
                      type="date"
                      name="projectCompletionDate"
                      value={editForm.projectCompletionDate}
                      onChange={handleEditChange}
                    />
                  </div>
                )}
              </div>

              <div className="ldEditFooter">
                <button type="button" className="ldBtn cancel" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="ldBtn primary" disabled={editSaving}>
                  {editSaving ? "Saving..." : "Update Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InfoGridCard({ title, children }) {
  return (
    <div className="ldCard">
      <div className="ldSectionTitle">{title}</div>
      {children}
    </div>
  );
}

function ProfileTab({ lead }) {
  const timestamps = lead.stageTimestamps || [];
  const gstInfo   = calcGst(lead.value, lead.gstApplicable, lead.gstRate || 18);
  const remaining = calcRemaining(lead.value, lead.advanceReceived, lead.gstApplicable, lead.gstRate || 18);
  const finalPayDate = lead.agreedTimeline > 0
    ? (() => { const d = new Date(); d.setDate(d.getDate() + Number(lead.agreedTimeline)); return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); })()
    : "—";

  return (
    <div className="ldTabStack">
      <InfoGridCard title="CONTACT DETAILS">
        <div className="ldGrid2">
          <div className="ldInfoItem">
            <div className="ldLabel">Phone</div>
            <div className="ldVal">{lead.phone || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Email</div>
            <div className="ldVal">{lead.email || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Business</div>
            <div className="ldVal">{lead.business || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Industry</div>
            <div className="ldVal">{lead.industry || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Location</div>
            <div className="ldVal">{lead.location || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Source</div>
            <div className="ldVal">{lead.source || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Rep</div>
            <div className="ldVal">{lead.rep || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Branch</div>
            <div className="ldVal">{lead.branch || "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Project Stage</div>
            <div className="ldVal">{projectStageLabel(lead.projectStage)}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Priority</div>
            <div className="ldVal">{lead.priority || "-"}</div>
          </div>
        </div>
      </InfoGridCard>

      <InfoGridCard title="FINANCIAL DETAILS">
        <div className="ldGrid2">
          <div className="ldInfoItem">
            <div className="ldLabel">Total Amount Agreed (₹){lead.gstApplicable ? " — excl. GST" : ""}</div>
            <div className="ldVal">{lead.value > 0 ? `₹${Number(lead.value).toLocaleString("en-IN")}` : "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">GST</div>
            <div className="ldVal">
              {lead.gstApplicable ? `${gstInfo.rate}% · ₹${gstInfo.gst.toLocaleString("en-IN")}` : "Without GST"}
            </div>
          </div>
          {lead.gstApplicable && lead.value > 0 && (
            <div className="ldInfoItem">
              <div className="ldLabel">Total incl. GST (₹)</div>
              <div className="ldVal" style={{ fontWeight: 700, color: "#1d4ed8" }}>₹{gstInfo.total.toLocaleString("en-IN")}</div>
            </div>
          )}
          <div className="ldInfoItem">
            <div className="ldLabel">Advance Received (₹)</div>
            <div className="ldVal">{lead.advanceReceived > 0 ? `₹${Number(lead.advanceReceived).toLocaleString("en-IN")}` : "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Advance Received Date</div>
            <div className="ldVal">{lead.advanceReceivedDate ? new Date(lead.advanceReceivedDate).toLocaleDateString("en-IN") : "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Remaining Balance (₹)</div>
            <div className="ldVal" style={{color: remaining > 0 ? "#dc2626" : "#16a34a", fontWeight:700}}>
              {lead.value > 0 ? `₹${remaining.toLocaleString("en-IN")}` : "-"}
            </div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Agreed Timeline (days)</div>
            <div className="ldVal">{lead.agreedTimeline > 0 ? `${lead.agreedTimeline} days` : "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Final Payment Date</div>
            <div className="ldVal">{lead.agreedTimeline > 0 ? finalPayDate : "-"}</div>
          </div>
        </div>
      </InfoGridCard>

      <InfoGridCard title="PROJECT INFO">
        <div className="ldGrid2">
          <div className="ldInfoItem">
            <div className="ldLabel">Client Onboarded Date</div>
            <div className="ldVal">{lead.onboardedDate ? new Date(lead.onboardedDate).toLocaleDateString("en-IN") : "-"}</div>
          </div>
          <div className="ldInfoItem">
            <div className="ldLabel">Project Completed</div>
            <div className="ldVal">{lead.projectCompleted ? "✅ Yes" : "❌ No"}</div>
          </div>
          {lead.projectCompleted && (
            <div className="ldInfoItem">
              <div className="ldLabel">Project Completion Date</div>
              <div className="ldVal">{lead.projectCompletionDate ? new Date(lead.projectCompletionDate).toLocaleDateString("en-IN") : "-"}</div>
            </div>
          )}
          {lead.requirements && (
            <div className="ldInfoItem" style={{gridColumn:"1/-1"}}>
              <div className="ldLabel">Requirements</div>
              <div className="ldVal" style={{whiteSpace:"pre-wrap",lineHeight:1.5}}>{lead.requirements}</div>
            </div>
          )}
        </div>
      </InfoGridCard>

      <InfoGridCard title="STAGE TIMESTAMPS">
        {timestamps.length ? (
          <div className="ldList">
            {timestamps.map((s, idx) => (
              <div key={idx} className={`ldRow ${s.done ? "done" : ""}`}>
                <div className="ldRowLeft">
                  <span className="ldRowIcon">{s.done ? "✔" : "•"}</span>
                  <div>
                    <div className="ldRowTitle">{s.label}</div>
                    <div className="ldSmall">{formatDateTime(s.at)}</div>
                  </div>
                </div>
                <div className="ldRowRight">
                  <span className={`ldTick ${s.done ? "ok" : ""}`}>{s.done ? "Done" : "Open"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No stage history yet" sub="Stage timestamps will appear here." />
        )}
      </InfoGridCard>
    </div>
  );
}

function BantTab({ lead, onBantSave }) {
  const raw = lead.bantDetails || {};

  const readText = (v) => {
    try {
      if (v == null) return "";
      if (typeof v === "object") return v.text || "";
      return String(v);
    } catch { return ""; }
  };

  const [editing, setEditing] = React.useState(false);
  const [saving,  setSaving]  = React.useState(false);
  const [form, setForm] = React.useState({
    budgetMin:     raw.budgetMin     || "",
    budgetMax:     raw.budgetMax     || "",
    authorityName: readText(raw.authorityName),
    authorityRole: readText(raw.authorityRole),
    need:          readText(raw.need),
    timeline:      readText(raw.timeline),
  });

  /* Sync if lead prop changes (e.g. after save) */
  React.useEffect(() => {
    const r = lead.bantDetails || {};
    setForm({
      budgetMin:     r.budgetMin     || "",
      budgetMax:     r.budgetMax     || "",
      authorityName: readText(r.authorityName),
      authorityRole: readText(r.authorityRole),
      need:          readText(r.need),
      timeline:      readText(r.timeline),
    });
  }, [lead.bantDetails]);

  const score = [
    form.budgetMin || form.budgetMax,
    form.authorityName,
    form.need,
    form.timeline,
  ].filter(Boolean).length;

  const handleSave = async () => {
    try {
      setSaving(true);
      await onBantSave({
        budgetMin:     Number(form.budgetMin) || 0,
        budgetMax:     Number(form.budgetMax) || 0,
        authorityName: form.authorityName,
        authorityRole: form.authorityRole,
        need:          form.need,
        timeline:      form.timeline,
        score,
      });
      setEditing(false);
      toast.success("BANT details saved");
    } catch (e) {
      toast.error(e.message || "Failed to save BANT");
    } finally {
      setSaving(false);
    }
  };

  const bantItems = [
    {
      title: "B — Budget",
      value: form.budgetMin || form.budgetMax
        ? `₹${Number(form.budgetMin || 0).toLocaleString("en-IN")} – ₹${Number(form.budgetMax || 0).toLocaleString("en-IN")}`
        : "",
      footer: "Budget range captured",
    },
    {
      title: "A — Authority",
      value: form.authorityName
        ? `${form.authorityName}${form.authorityRole ? ` (${form.authorityRole})` : ""}`
        : "",
      footer: "Decision authority noted",
    },
    {
      title: "N — Need",
      value: form.need,
      footer: "Business need identified",
    },
    {
      title: "T — Timeline",
      value: form.timeline,
      footer: "Timeline available",
    },
  ];

  return (
    <div className="ldTabStack">
      <div className="bantHero">
        <div className="bantHeroLeft">
          <div className="bantHeroLabel">BANT SCORE</div>
          <div className="bantBig">{score} / 4</div>
          <div className="bantSub">
            {lead.priority || "Hot"} Lead • {lead.stage || "Lead Capture"}
          </div>
        </div>
        <div className="bantRing">
          <span>{score}</span>
        </div>
      </div>

      {editing ? (
        <div className="ldCard">
          <div className="ldTopRow">
            <div className="ldSectionTitle">EDIT BANT DETAILS</div>
            <button className="ldBtn" type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
          <div className="bantEditGrid">
            <div className="bantEditField">
              <label>Budget Min (₹)</label>
              <input type="number" placeholder="e.g. 50000"
                value={form.budgetMin}
                onChange={e => setForm(p => ({ ...p, budgetMin: e.target.value }))} />
            </div>
            <div className="bantEditField">
              <label>Budget Max (₹)</label>
              <input type="number" placeholder="e.g. 150000"
                value={form.budgetMax}
                onChange={e => setForm(p => ({ ...p, budgetMax: e.target.value }))} />
            </div>
            <div className="bantEditField">
              <label>Decision Maker Name</label>
              <input type="text" placeholder="e.g. Harish Kashyap"
                value={form.authorityName}
                onChange={e => setForm(p => ({ ...p, authorityName: e.target.value }))} />
            </div>
            <div className="bantEditField">
              <label>Decision Maker Role</label>
              <input type="text" placeholder="e.g. CEO, Owner"
                value={form.authorityRole}
                onChange={e => setForm(p => ({ ...p, authorityRole: e.target.value }))} />
            </div>
            <div className="bantEditField bantEditFull">
              <label>Business Need</label>
              <textarea rows={3} placeholder="What does the client need?"
                value={form.need}
                onChange={e => setForm(p => ({ ...p, need: e.target.value }))} />
            </div>
            <div className="bantEditField bantEditFull">
              <label>Timeline / Urgency</label>
              <input type="text" placeholder="e.g. Within 1 month, ASAP, Q2 2025"
                value={form.timeline}
                onChange={e => setForm(p => ({ ...p, timeline: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="ldBtn primary" type="button" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save BANT"}
            </button>
          </div>
        </div>
      ) : (
        <div className="ldCard">
          <div className="ldTopRow">
            <div className="ldSectionTitle">BANT DETAILS</div>
            <button className="ldBtn" type="button" onClick={() => setEditing(true)}>
              {score === 0 ? "+ Fill BANT" : "Edit BANT"}
            </button>
          </div>
          <div className="bantGrid">
            {bantItems.map((item, idx) => (
              <div key={idx} className={`bantCard ${item.value ? "bantFilled" : ""}`}>
                <div className="bantHead">{item.title}</div>
                <div className="bantText">{item.value || "—"}</div>
                {item.value
                  ? <div className="bantOk">{item.footer}</div>
                  : <div className="bantNotSet">Not captured yet</div>
                }
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FollowupTab({
  lead,
  followupOpen,
  setFollowupOpen,
  followupForm,
  setFollowupForm,
  followupSaving,
  addFollowup,
}) {
  const items = lead.followups || [];

  return (
    <div className="ldTabStack">
      <div className="ldCard">
        <div className="ldTopRow">
          <div className="ldSectionTitle">10-DAY CADENCE</div>
          <button className="ldBtn" type="button" onClick={() => setFollowupOpen((p) => !p)}>
            {followupOpen ? "Close Form" : "+ Add Follow Up"}
          </button>
        </div>

        {followupOpen ? (
          <div className="logBox">
            <input
              type="number"
              placeholder="Day Index"
              value={followupForm.dayIndex}
              onChange={(e) =>
                setFollowupForm((prev) => ({ ...prev, dayIndex: e.target.value }))
              }
            />

            <input
              type="text"
              placeholder="Follow-up title"
              value={followupForm.title}
              onChange={(e) =>
                setFollowupForm((prev) => ({ ...prev, title: e.target.value }))
              }
            />

            <select
              value={followupForm.channel}
              onChange={(e) =>
                setFollowupForm((prev) => ({ ...prev, channel: e.target.value }))
              }
            >
              <option>Call</option>
              <option>WhatsApp</option>
              <option>Email</option>
              <option>Meeting</option>
            </select>

            <select
              value={followupForm.status}
              onChange={(e) =>
                setFollowupForm((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              <option>Pending</option>
              <option>Closed</option>
              <option>Rescheduled</option>
            </select>

            <input
              type="date"
              value={followupForm.dueDate}
              onChange={(e) =>
                setFollowupForm((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />

            <label className="ldCheckboxRow">
              <input
                type="checkbox"
                checked={followupForm.done}
                onChange={(e) =>
                  setFollowupForm((prev) => ({ ...prev, done: e.target.checked }))
                }
              />
              <span>Mark as done</span>
            </label>

            <button
              className="ldBtn primary"
              type="button"
              disabled={followupSaving}
              onClick={addFollowup}
            >
              {followupSaving ? "Saving..." : "Save Follow Up"}
            </button>
          </div>
        ) : null}

        {items.length ? (
          <div className="ldList">
            {items.map((f, idx) => (
              <div key={idx} className={`fuRow ${f.done ? "done" : ""}`}>
                <div className="fuDay">Day {f.dayIndex || "-"}</div>

                <div className="fuMid">
                  <div className="fuTitle">{f.title}</div>
                  <div className="fuSub">
                    {f.channel || "-"}
                    {f.dueDate ? ` • ${formatDate(f.dueDate)}` : ""}
                  </div>
                </div>

                <div className="fuRight">
                  <span className={`fuStatus ${String(f.status || "").toLowerCase()}`}>
                    {f.status || "Pending"} {f.done ? "✓" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No follow-ups added" sub="Create a follow-up to keep this lead warm." />
        )}
      </div>
    </div>
  );
}

function CallsTab({
  lead,
  logOpen,
  setLogOpen,
  logType,
  setLogType,
  logSummary,
  setLogSummary,
  logSaving,
  addLog,
}) {
  const items = lead.commLogs || [];

  return (
    <div className="ldTabStack">
      <div className="ldCard">
        <div className="ldTopRow">
          <div className="ldSectionTitle">COMMUNICATION LOG</div>
          <button className="ldBtn" type="button" onClick={() => setLogOpen((p) => !p)}>
            {logOpen ? "Close Form" : "+ Log"}
          </button>
        </div>

        {logOpen ? (
          <div className="logBox">
            <select value={logType} onChange={(e) => setLogType(e.target.value)}>
              <option>Outbound Call</option>
              <option>WhatsApp</option>
              <option>Proposal Sent</option>
            </select>

            <textarea
              placeholder="Write summary..."
              value={logSummary}
              onChange={(e) => setLogSummary(e.target.value)}
            />

            <button className="ldBtn primary" type="button" disabled={logSaving} onClick={addLog}>
              {logSaving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : null}

        {items.length ? (
          <div className="ldList">
            {items.map((c, idx) => (
              <div key={idx} className="commCard">
                <div className="commTop">
                  <div className="commType">{c.type || "Communication"}</div>
                  <div className="commRight">{c.durationMin ? `${c.durationMin} min` : ""}</div>
                </div>
                <div className="commSum">{c.summary}</div>
                <div className="commMeta">
                  {formatDateTime(c.at)} {c.by ? `• ${c.by}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No communication logs" sub="Calls, WhatsApp and proposals will show here." />
        )}
      </div>
    </div>
  );
}

function HistoryTab({ lead }) {
  const items = lead.history || [];

  return (
    <div className="ldTabStack">
      <div className="ldCard">
        <div className="ldSectionTitle">ACTIVITY TIMELINE</div>

        {items.length ? (
          <div className="historyList">
            {items.map((h, idx) => (
              <div key={idx} className="histRow">
                <div className="histDot" />
                <div className="histBody">
                  <div className="histTitle">{h.title}</div>
                  <div className="histMeta">
                    {h.meta ? <span>{h.meta}</span> : null}
                    <span>{h.at ? ` • ${formatDateTime(h.at)}` : ""}</span>
                    <span>{h.by ? ` • ${h.by}` : ""}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No history yet" sub="Lead activity timeline will appear here." />
        )}
      </div>
    </div>
  );
}

function DocsTab({ lead, uploading, docTag, setDocTag, uploadDoc, apiBase, onDocDeleted }) {
  const docs = lead.documents || [];
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, doc, idx) => {
    e.preventDefault(); e.stopPropagation();
    const label = doc.name || doc.originalName || `Document ${idx + 1}`;
    if (!window.confirm(`Delete "${label}"?`)) return;
    setDeletingId(idx);
    try {
      const token = localStorage.getItem("nnc_token");
      const res = await fetch(`${apiBase}/api/leads/${lead._id}/docs/index/${idx}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete");
      toast.success("Document deleted");
      if (onDocDeleted) onDocDeleted(json.data);
    } catch (err) { toast.error(err.message || "Failed to delete"); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="ldTabStack">
      <div className="ldCard">
        <div className="ldTopRow">
          <div className="ldSectionTitle">DOCUMENTS ({docs.length})</div>

          <div className="docUpload">
            <select value={docTag} onChange={(e) => setDocTag(e.target.value)}>
              <option>Project Document</option>
              <option>Invoice</option>
              <option>Quotation</option>
              <option>MoM</option>
              <option>Client Input</option>
            </select>

            <label className="ldBtn primary">
              {uploading ? "Uploading..." : "+ Upload"}
              <input
                type="file"
                style={{ display: "none" }}
                onChange={(e) => uploadDoc(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        {docs.length ? (
          <div className="ldList">
            {docs.map((d, idx) => {
              const isDeleting = deletingId === idx;
              return (
                <div key={idx} className="docCard" style={{display:"flex",alignItems:"center",gap:8}}>
                  <a
                    href={`${apiBase}${d.url || d.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{flex:1,display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}
                  >
                    <div className="docLeft">
                      <div className="docIcon">📄</div>
                      <div>
                        <div className="docName">{d.name || d.originalName}</div>
                        <div className="docMeta">
                          {d.tag || "-"} • {d.size ? `${Math.round(d.size / 1024)} KB` : "0 KB"} •{" "}
                          {d.uploadedAt ? formatDate(d.uploadedAt) : "-"}
                        </div>
                      </div>
                    </div>
                    <span className={`docTag ${String(d.tag || "").toLowerCase().replace(/\s+/g, "-")}`}>
                      {d.tag}
                    </span>
                  </a>
                  <button
                    onClick={(e) => handleDelete(e, d, idx)}
                    disabled={isDeleting}
                    style={{flexShrink:0,background:"#fee2e2",border:"none",borderRadius:8,
                      width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",
                      cursor:"pointer",color:"#dc2626",fontSize:14,opacity:isDeleting?0.5:1}}
                    title="Delete document"
                  >
                    {isDeleting ? "…" : "🗑"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No documents uploaded" sub="Upload invoices, quotations or client files." />
        )}
      </div>
    </div>
  );
}

const EMAIL_TYPE_LABELS = {
  initiation:          "Project Initiation",
  completion:          "Project Completion",
  mom:                 "Meeting MOM",
  followup_1:          "Follow-up 1/3",
  followup_2:          "Follow-up 2/3",
  followup_3:          "Follow-up 3/3",
  custom:              "Custom Email",
  payment_reminder_1:  "Payment Reminder (Stage 1)",
  payment_reminder_2:  "Payment Reminder (Stage 2)",
  payment_reminder_3:  "Payment Reminder (Stage 3)",
  payment_receipt:     "Payment Receipt",
  document_request:    "Document Request",
};

const EMAIL_TYPE_COLORS = {
  initiation:          "#0b1b3e",
  completion:          "#10b981",
  mom:                 "#6366f1",
  custom:              "#64748b",
  payment_reminder_1:  "#3b82f6",
  payment_reminder_2:  "#f59e0b",
  payment_reminder_3:  "#ef4444",
  payment_receipt:     "#10b981",
  document_request:    "#8b5cf6",
};

function EmailsTab({
  lead,
  emailResponseId,
  setEmailResponseId,
  expandedEmailId,
  setExpandedEmailId,
  emailResponseText,
  setEmailResponseText,
  emailResponseSaving,
  addEmailResponse,
}) {
  const logs = [...(lead.emailLogs || [])].reverse(); // newest first

  return (
    <div className="ldTabStack">
      <div className="ldCard">
        <div className="ldSectionTitle">EMAIL HISTORY</div>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
          All emails sent to this client. Click &quot;Add Response&quot; to record any reply received.
        </p>

        {logs.length === 0 ? (
          <EmptyState title="No emails sent yet" sub="Sent emails will appear here with full details." />
        ) : (
          <div className="ldList">
            {logs.map((log, idx) => {
              const logId    = log._id ? String(log._id) : null;
              const label    = EMAIL_TYPE_LABELS[log.type] || log.type || "Email";
              const color    = EMAIL_TYPE_COLORS[log.type] || "#64748b";
              const isOpen   = emailResponseId === logId;
              const hasReply = !!log.response;

              const isExpanded = expandedEmailId === logId;
              const toggleExpand = () => setExpandedEmailId(isExpanded ? null : logId);

              return (
                <div key={logId || idx} className={`emailLogCard${isExpanded ? " expanded" : ""}`} style={{ borderLeft: `3px solid ${color}` }}>
                  {/* Clickable header row */}
                  <button
                    type="button"
                    className="emailLogHeader"
                    onClick={toggleExpand}
                    aria-expanded={isExpanded}
                  >
                    <div className="emailLogHeaderLeft">
                      <span className="emailLogBadge" style={{ background: color }}>{label}</span>
                      <div className="emailLogSubject">{log.subject || "—"}</div>
                      <div className="emailLogMeta">To: <span>{log.sentTo || "—"}</span></div>
                    </div>
                    <div className="emailLogHeaderRight">
                      <div className="emailLogDateTime">
                        <div>{log.sentAt ? new Date(log.sentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
                        <div>{log.sentAt ? new Date(log.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}</div>
                      </div>
                      <span className={`emailLogChevron${isExpanded ? " up" : ""}`}>▾</span>
                    </div>
                  </button>

                  {/* Expandable body */}
                  {isExpanded && (
                    <div className="emailLogExpanded">
                      {/* Full email body */}
                      {log.body && (
                        <div className="emailLogBodyFull">
                          <div className="emailLogBodyLabel">EMAIL CONTENT</div>
                          <pre className="emailLogBodyPre">{log.body}</pre>
                        </div>
                      )}

                      {/* Client response */}
                      {hasReply && (
                        <div className="emailLogResponse">
                          <span className="emailLogResponseLabel">Client Response</span>
                          <div className="emailLogResponseText">{log.response}</div>
                          {log.respondedAt && (
                            <div className="emailLogResponseAt">Recorded {formatDateTime(log.respondedAt)}</div>
                          )}
                        </div>
                      )}

                      {/* Add / edit response */}
                      {logId && (
                        <div style={{ marginTop: 8 }}>
                          {!isOpen ? (
                            <button
                              className="ldBtnSm"
                              type="button"
                              onClick={() => {
                                setEmailResponseId(logId);
                                setEmailResponseText(log.response || "");
                              }}
                            >
                              {hasReply ? "Edit Response" : "Add Response"}
                            </button>
                          ) : (
                            <div className="emailResponseBox">
                              <textarea
                                className="noteBox"
                                style={{ minHeight: 72 }}
                                placeholder="Type the client's reply or any notes about their response..."
                                value={emailResponseText}
                                onChange={(e) => setEmailResponseText(e.target.value)}
                              />
                              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                <button
                                  className="ldBtn primary"
                                  type="button"
                                  onClick={addEmailResponse}
                                  disabled={emailResponseSaving || !emailResponseText.trim()}
                                >
                                  {emailResponseSaving ? "Saving..." : "Save Response"}
                                </button>
                                <button
                                  className="ldBtn"
                                  type="button"
                                  onClick={() => { setEmailResponseId(null); setEmailResponseText(""); }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NotesTab({ lead, noteText, setNoteText, savingNote, saveNote }) {
  const notes = lead.notes || [];

  return (
    <div className="ldTabStack">
      <div className="ldCard">
        <div className="ldSectionTitle">ADD NOTE</div>

        <textarea
          className="noteBox"
          placeholder="Type your note..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />

        <button className="ldBtn primary" type="button" onClick={saveNote} disabled={savingNote}>
          {savingNote ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="ldCard">
        <div className="ldSectionTitle">PREVIOUS NOTES</div>

        {notes.length ? (
          <div className="ldList">
            {notes.map((n, idx) => (
              <div key={idx} className="noteCard">
                <div className="noteText">{n.text}</div>
                <div className="noteMeta">
                  {n.by || "User"} • {n.at ? formatDateTime(n.at) : "-"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No notes yet" sub="Your saved notes will show up here." />
        )}
      </div>
    </div>
  );
}