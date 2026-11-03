import { useState, useEffect, useRef } from "react";
import {
  KeyRound, Plus, Search, Copy, Eye, EyeOff, Pin, Trash2,
  Github, Database, Mail, Server, User, Key, Globe, Share2,
  MoreHorizontal, X, Check, ExternalLink, ChevronDown,
} from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import "./CredentialVault.css";

const API = import.meta.env.VITE_API_BASE_URL || "";
const auth = () => {
  const t = localStorage.getItem("nnc_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const json = (body) => ({ ...auth(), "Content-Type": "application/json" });

const CATEGORIES = [
  "All", "GitHub", "Database", "Email", "Server", "Client", "API Key", "Domain/Hosting", "Social Media", "Other"
];

const CAT_ICON = {
  GitHub:          <Github size={15} />,
  Database:        <Database size={15} />,
  Email:           <Mail size={15} />,
  Server:          <Server size={15} />,
  Client:          <User size={15} />,
  "API Key":       <Key size={15} />,
  "Domain/Hosting":<Globe size={15} />,
  "Social Media":  <Share2 size={15} />,
  Other:           <KeyRound size={15} />,
};

const CAT_COLOR = {
  GitHub:          "#6e40c9",
  Database:        "#0ea5e9",
  Email:           "#f97316",
  Server:          "#22c55e",
  Client:          "#a78bfa",
  "API Key":       "#fbbf24",
  "Domain/Hosting":"#06b6d4",
  "Social Media":  "#ec4899",
  Other:           "#94a3b8",
};

function useClipboard(timeout = 1500) {
  const [copied, setCopied] = useState(null);
  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), timeout);
  };
  return { copied, copy };
}

function CredCard({ cred, onReveal, revealedPasswords, onCopy, copied, onPin, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const revealed = revealedPasswords[cred._id];
  const color = CAT_COLOR[cred.category] || CAT_COLOR.Other;

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="cv-card" style={{ "--cat-color": color }}>
      <div className="cv-card-top">
        <span className="cv-cat-badge" style={{ background: color + "22", color }}>
          {CAT_ICON[cred.category] || <KeyRound size={13} />}
          {cred.category}
        </span>
        <div className="cv-card-actions" ref={menuRef}>
          {cred.pinned && <span className="cv-pinned-dot" title="Pinned" />}
          <button className="cv-icon-btn" onClick={() => setMenuOpen(p => !p)} title="More">
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div className="cv-menu">
              <button onClick={() => { onEdit(cred); setMenuOpen(false); }}>Edit</button>
              <button onClick={() => { onPin(cred._id); setMenuOpen(false); }}>
                {cred.pinned ? "Unpin" : "Pin"}
              </button>
              <button className="cv-menu-del" onClick={() => { onDelete(cred._id); setMenuOpen(false); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="cv-card-label">{cred.label}</h3>

      {cred.username && (
        <div className="cv-field">
          <span className="cv-field-key">Username</span>
          <div className="cv-field-val">
            <span>{cred.username}</span>
            <button className="cv-copy-btn" onClick={() => onCopy(cred.username, `u-${cred._id}`)} title="Copy">
              {copied === `u-${cred._id}` ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}

      {cred.password && (
        <div className="cv-field">
          <span className="cv-field-key">Password</span>
          <div className="cv-field-val">
            <span className="cv-password-text">
              {revealed ? revealed : "••••••••"}
            </span>
            <button className="cv-copy-btn" onClick={() => onReveal(cred._id, revealed ? "hide" : "show")} title={revealed ? "Hide" : "Reveal"}>
              {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            {revealed && (
              <button className="cv-copy-btn" onClick={() => onCopy(revealed, `p-${cred._id}`)} title="Copy">
                {copied === `p-${cred._id}` ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
        </div>
      )}

      {cred.url && (
        <div className="cv-field">
          <span className="cv-field-key">URL</span>
          <div className="cv-field-val">
            <span className="cv-url-text">{cred.url}</span>
            <button className="cv-copy-btn" onClick={() => onCopy(cred.url, `url-${cred._id}`)} title="Copy URL">
              {copied === `url-${cred._id}` ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}

      {cred.notes && <p className="cv-notes">{cred.notes}</p>}

      {cred.tags?.length > 0 && (
        <div className="cv-tags">
          {cred.tags.map(t => <span key={t} className="cv-tag">{t}</span>)}
        </div>
      )}
    </div>
  );
}

function CredModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    label: "", category: "Other", username: "", password: "",
    url: "", notes: "", pinned: false,
    ...initial,
    tags: Array.isArray(initial?.tags) ? initial.tags.join(", ") : (initial?.tags || ""),
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    };
    await onSave(payload);
    setSaving(false);
  };

  return (
    <div className="cv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cv-modal">
        <div className="cv-modal-head">
          <h2>{initial?._id ? "Edit Credential" : "Add Credential"}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form className="cv-modal-body" onSubmit={handleSubmit}>
          <label>Label *
            <input value={form.label} onChange={e => set("label", e.target.value)} placeholder="e.g. GitHub - NNC Org" required />
          </label>
          <label>Category
            <select value={form.category} onChange={e => set("category", e.target.value)}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Username / Email
            <input value={form.username} onChange={e => set("username", e.target.value)} placeholder="username or email" />
          </label>
          <label>Password / Token / Key
            <div className="cv-pass-wrap">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder={initial?._id ? "Leave blank to keep existing" : "Enter password or token"}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>
          <label>URL / Link
            <input value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://..." />
          </label>
          <label>Notes
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Any extra info..." />
          </label>
          <label>Tags (comma-separated)
            <input value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="production, main, important" />
          </label>
          <label className="cv-checkbox-label">
            <input type="checkbox" checked={form.pinned} onChange={e => set("pinned", e.target.checked)} />
            Pin to top
          </label>
          <div className="cv-modal-foot">
            <button type="button" className="cv-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="cv-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CredentialVault() {
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { copied, copy } = useClipboard();

  const fetchCreds = async (search = q, cat = activeCat) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (cat !== "All") params.set("category", cat);
    try {
      const r = await fetch(`${API}/api/credentials?${params}`, { headers: auth() });
      const d = await r.json();
      if (d.success) setCreds(d.credentials);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCreds(); }, []);

  const handleSearch = (v) => {
    setQ(v);
    fetchCreds(v, activeCat);
  };

  const handleCat = (cat) => {
    setActiveCat(cat);
    fetchCreds(q, cat);
  };

  const handleReveal = async (id, action) => {
    if (action === "hide") {
      setRevealedPasswords(p => { const n = { ...p }; delete n[id]; return n; });
      return;
    }
    const r = await fetch(`${API}/api/credentials/${id}/reveal`, {
      method: "POST", headers: auth(),
    });
    const d = await r.json();
    if (d.success) setRevealedPasswords(p => ({ ...p, [id]: d.password }));
  };

  const handleSave = async (payload) => {
    const isEdit = !!editItem?._id;
    const url = isEdit ? `${API}/api/credentials/${editItem._id}` : `${API}/api/credentials`;
    const r = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: json(),
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.success) {
      setModalOpen(false);
      setEditItem(null);
      fetchCreds();
    }
  };

  const handlePin = async (id) => {
    await fetch(`${API}/api/credentials/${id}/pin`, { method: "PATCH", headers: auth() });
    fetchCreds();
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/api/credentials/${id}`, { method: "DELETE", headers: auth() });
    setDeleteConfirm(null);
    setCreds(p => p.filter(c => c._id !== id));
  };

  const pinnedCreds = creds.filter(c => c.pinned);
  const regularCreds = creds.filter(c => !c.pinned);

  // Group regular by category
  const groups = {};
  for (const c of regularCreds) {
    if (!groups[c.category]) groups[c.category] = [];
    groups[c.category].push(c);
  }

  const cardProps = { onReveal: handleReveal, revealedPasswords, onCopy: copy, copied, onPin: handlePin };

  return (
    <div className="cv-layout">
      <Sidebar />
      <div className="cv-root">
      {/* Header */}
      <div className="cv-header">
        <div className="cv-header-left">
          <div className="cv-header-icon"><KeyRound size={22} /></div>
          <div>
            <h1>NNC Credentials</h1>
            <p>{creds.length} stored · AES-256 encrypted</p>
          </div>
        </div>
        <button className="cv-add-btn" onClick={() => { setEditItem(null); setModalOpen(true); }}>
          <Plus size={16} /> Add Credential
        </button>
      </div>

      {/* Toolbar */}
      <div className="cv-toolbar">
        <div className="cv-search-wrap">
          <Search size={14} className="cv-search-icon" />
          <input
            className="cv-search"
            placeholder="Search credentials…"
            value={q}
            onChange={e => handleSearch(e.target.value)}
          />
          {q && <button className="cv-search-clear" onClick={() => handleSearch("")}><X size={12}/></button>}
        </div>
        <div className="cv-cat-tabs">
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`cv-cat-tab${activeCat === c ? " active" : ""}`}
              style={activeCat === c && c !== "All" ? { background: CAT_COLOR[c] + "22", color: CAT_COLOR[c], borderColor: CAT_COLOR[c] } : {}}
              onClick={() => handleCat(c)}
            >
              {c !== "All" && (CAT_ICON[c] || <KeyRound size={11} />)}
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="cv-content">
        {loading ? (
          <div className="cv-empty">Loading…</div>
        ) : creds.length === 0 ? (
          <div className="cv-empty">
            <KeyRound size={40} />
            <p>No credentials yet. Click "Add Credential" to store your first one.</p>
          </div>
        ) : (
          <>
            {pinnedCreds.length > 0 && (
              <section className="cv-section">
                <h4 className="cv-section-title"><Pin size={13} /> Pinned</h4>
                <div className="cv-grid">
                  {pinnedCreds.map(c => (
                    <CredCard key={c._id} cred={c} {...cardProps}
                      onEdit={i => { setEditItem(i); setModalOpen(true); }}
                      onDelete={id => setDeleteConfirm(id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {Object.entries(groups).map(([cat, items]) => (
              <section key={cat} className="cv-section">
                <h4 className="cv-section-title" style={{ color: CAT_COLOR[cat] || "#94a3b8" }}>
                  {CAT_ICON[cat]} {cat} <span className="cv-section-count">{items.length}</span>
                </h4>
                <div className="cv-grid">
                  {items.map(c => (
                    <CredCard key={c._id} cred={c} {...cardProps}
                      onEdit={i => { setEditItem(i); setModalOpen(true); }}
                      onDelete={id => setDeleteConfirm(id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <CredModal
          initial={editItem || {}}
          onClose={() => { setModalOpen(false); setEditItem(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="cv-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cv-confirm" onClick={e => e.stopPropagation()}>
            <Trash2 size={28} color="#ef4444" />
            <h3>Delete credential?</h3>
            <p>This cannot be undone.</p>
            <div className="cv-confirm-btns">
              <button className="cv-btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="cv-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
