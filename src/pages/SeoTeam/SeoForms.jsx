import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "../../utils/toast";
import {
  seoApi, T, fd, fds, fdw, inr, inr2, num, TYPES, ROLE, BACKLINK_KINDS, monthOf, adsAgg, adsText, parseTerms,
  kwStat, posTxt, posVal, waPhone, copy,
} from "./seoUtil";

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="mscrim" onClick={onClose} />
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true">
        <div className="m-h"><h3>{title}</h3><button type="button" className="btn sm" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
        {children}
      </div>
    </>
  );
}
const F = ({ label, children, className = "" }) => <label className={`f ${className}`}><span className="flabel">{label}</span>{children}</label>;
const useBusy = () => {
  const [busy, setBusy] = useState(false);
  const run = async (fn, onOk) => {
    setBusy(true);
    try { const r = await fn(); onOk?.(r); } catch (err) { toast.error(err.message || "Save failed"); setBusy(false); }
  };
  return [busy, run];
};

/* ───────── Log work ───────── */
export function WorkForm({ D, active, who, cid, onClose, onSaved }) {
  const first = active.find(c => c.id === cid) || active[0];
  const [type, setType] = useState("backlink");
  const [c, setC] = useState(first.id);
  const cl = active.find(x => x.id === c) || first;
  const defWho = who !== "all" ? who : (type === "poster" ? cl.design : cl.seo) || "";
  const [f, setF] = useState({ date: T(0), who: defWho, urls: "", kind: BACKLINK_KINDS[0], kw: "", da: "", url: "", title: "", kw2: "", platform: "Instagram", status: "live" });
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const kws = (D.kws[cl.id] || []).map(k => k.keyword);
  const submit = (ev) => {
    ev.preventDefault();
    const items = type === "backlink"
      ? f.urls.split(/\s*\n\s*/).map(x => x.trim()).filter(Boolean).map(u => {
        const url = /^https?:/.test(u) ? u : `https://${u}`;
        return { url, title: `${f.kind} on ${url.replace(/^https?:\/\//, "").split("/")[0]}`, kw: f.kw, da: f.da };
      })
      : [{ url: f.url, title: f.title, kw: type === "poster" ? "" : f.kw2, platform: type === "poster" ? f.platform : "" }];
    if (!items.length) { toast.error("Paste at least one link"); return; }
    run(() => seoApi("/work", { method: "POST", body: { client: cl.id, who: f.who || null, date: f.date, type, status: f.status, items } }),
      () => onSaved(type === "backlink" ? `${items.length} backlink${items.length > 1 ? "s" : ""} saved for ${cl.name}` : `${TYPES[type]} saved`));
  };
  return (
    <Modal title="Log work" onClose={onClose}>
      <form className="m-b" onSubmit={submit}>
        <div className="types" role="group" aria-label="Type">
          {Object.entries(TYPES).map(([k, v]) => <button key={k} type="button" className={k === type ? "on" : ""} onClick={() => setType(k)}>{v}</button>)}
        </div>
        <div className="g3">
          <F label="Client"><select value={c} onChange={e => setC(e.target.value)}>{active.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></F>
          <F label="Date"><input type="date" value={f.date} onChange={set("date")} /></F>
          <F label="Done by"><select value={f.who} onChange={set("who")}><option value="">Not set</option>{D.team.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></F>
        </div>
        {type === "backlink" ? (
          <>
            <F label="Backlink URLs, one per line (paste a whole day's list at once)">
              <textarea rows={5} required value={f.urls} onChange={set("urls")} placeholder={"https://medium.com/@nnc/your-article\nhttps://www.sulekha.com/your-listing"} />
            </F>
            <div className="g3">
              <F label="Type"><select value={f.kind} onChange={set("kind")}>{BACKLINK_KINDS.map(x => <option key={x}>{x}</option>)}</select></F>
              <F label="Keyword">
                {kws.length ? <select value={f.kw} onChange={set("kw")}><option value="">Not set</option>{kws.map(k => <option key={k}>{k}</option>)}</select>
                  : <input value={f.kw} onChange={set("kw")} placeholder="Target keyword" />}
              </F>
              <F label="Domain authority (optional)"><input type="number" min="0" max="100" value={f.da} onChange={set("da")} /></F>
            </div>
          </>
        ) : (
          <>
            <F label={type === "poster" ? "Design link (Drive, Canva or post URL)" : type === "gmb" ? "GMB post link" : type === "blog" ? "Blog URL" : "Link (optional)"}>
              <input type="url" value={f.url} onChange={set("url")} required={type !== "other"} placeholder="https://" />
            </F>
            <div className="g2">
              <F label={type === "blog" ? "Blog title" : type === "poster" ? "Poster for" : "Title"}><input value={f.title} onChange={set("title")} required /></F>
              {type === "poster"
                ? <F label="Platform"><select value={f.platform} onChange={set("platform")}>{["Instagram", "Facebook", "GMB", "WhatsApp", "LinkedIn"].map(x => <option key={x}>{x}</option>)}</select></F>
                : <F label={type === "blog" ? "Main keyword" : "Note"}><input value={f.kw2} onChange={set("kw2")} /></F>}
            </div>
          </>
        )}
        <F label="Status"><select value={f.status} onChange={set("status")}><option value="live">Live</option><option value="pending">Submitted, pending approval</option></select></F>
        <div className="foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}

/* ───────── Google Ads daily report ───────── */
export function AdsForm({ D, active, who, cid, onClose, onSaved }) {
  const C = active.filter(c => c.ads);
  const start = C.find(c => c.id === cid) || C.find(c => !D.ads.some(r => r.cid === c.id && r.date === T(0))) || C[0];
  const [c, setC] = useState(start.id);
  const cl = C.find(x => x.id === c) || start;
  const existing = (d) => D.ads.find(r => r.cid === cl.id && r.date === d);
  const [date, setDate] = useState(T(0));
  const [terms, setTerms] = useState("");
  const [tot, setTot] = useState({ spend: "", clicks: "", impr: "", conv: "" });
  const [negs, setNegs] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, run] = useBusy();
  const parsed = useMemo(() => parseTerms(terms), [terms]);
  const fill = (txt) => {
    setTerms(txt);
    const t = parseTerms(txt);
    if (t.length) setTot({ spend: Math.round(t.reduce((a, x) => a + x.cost, 0)), clicks: t.reduce((a, x) => a + x.clicks, 0), impr: t.reduce((a, x) => a + x.impr, 0), conv: t.reduce((a, x) => a + x.conv, 0) });
  };
  const waste = parsed.filter(x => !x.conv && x.cost > 0).sort((a, b) => b.cost - a.cost);
  const addNeg = (t) => { const L = negs.split(",").map(x => x.trim()).filter(Boolean); if (!L.includes(t)) L.push(t); setNegs(L.join(", ")); };
  const onFile = (file) => { if (!file) return; const rd = new FileReader(); rd.onload = () => { fill(String(rd.result)); toast.success(`Search terms loaded from ${file.name}`); }; rd.readAsText(file); };
  const submit = (ev) => {
    ev.preventDefault();
    run(() => seoApi("/ads", { method: "POST", body: {
      client: cl.id, who: (who !== "all" ? who : cl.ads) || null, date,
      spend: Number(tot.spend) || 0, clicks: Number(tot.clicks) || 0, impr: Number(tot.impr) || 0, conv: Number(tot.conv) || 0,
      terms: parsed, negs: negs.split(",").map(x => x.trim()).filter(Boolean), notes,
    } }), (j) => onSaved(j.data));
  };
  return (
    <Modal title="Google Ads daily report" onClose={onClose} wide>
      <form className="m-b" onSubmit={submit}>
        <div className="g2">
          <F label="Client"><select value={c} onChange={e => setC(e.target.value)}>{C.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></F>
          <F label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></F>
        </div>
        {existing(date) && <div className="hint">A report already exists for this day. Saving replaces it.</div>}
        <F label="Search terms report: upload the CSV from Google Ads, or paste it (search term, clicks, impressions, cost, conversions)">
          <input type="file" accept=".csv,.txt" onChange={e => onFile(e.target.files[0])} />
          <textarea rows={6} value={terms} onChange={e => fill(e.target.value)} placeholder={"car ceramic coating\t18\t240\t520\t2\nppf near me\t11\t190\t310\t1"} />
        </F>
        <div className="hint">Totals fill in from the search terms. Change them if your Google Ads total for the day is different (for example, display or PMax spend).</div>
        <div className="g4">
          <F label="Amount spent (₹)"><input type="number" min="0" required value={tot.spend} onChange={e => setTot({ ...tot, spend: e.target.value })} /></F>
          <F label="Clicks"><input type="number" min="0" value={tot.clicks} onChange={e => setTot({ ...tot, clicks: e.target.value })} /></F>
          <F label="Impressions"><input type="number" min="0" value={tot.impr} onChange={e => setTot({ ...tot, impr: e.target.value })} /></F>
          <F label="Leads"><input type="number" min="0" value={tot.conv} onChange={e => setTot({ ...tot, conv: e.target.value })} /></F>
        </div>
        <F label="Negative keywords added today (comma separated)"><input value={negs} onChange={e => setNegs(e.target.value)} placeholder="Eg. free, jobs, course" /></F>
        <F label="Action taken today"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Eg. paused low CTR ad, raised bid on top keyword" /></F>
        <div className="note">
          {waste.length
            ? <>{waste.length} search terms cost {inr(waste.reduce((a, x) => a + x.cost, 0))} with no lead. Consider blocking:{" "}
              {waste.slice(0, 4).map(x => <button key={x.t} type="button" className="chip" onClick={() => addNeg(x.t)}>{x.t} · {inr(x.cost)}</button>)}</>
            : parsed.length ? "Every search term with spend brought at least one lead." : "Paste or upload the search terms to see suggestions."}
        </div>
        <div className="foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={busy}>Create summary</button></div>
      </form>
    </Modal>
  );
}

export function AdsView({ D, client, person, id, fresh, onClose, onSaved }) {
  const r0 = D.ads.find(x => x.id === id) || (fresh && { ...fresh, id, date: String(fresh.date).slice(0, 10), cid: String(fresh.client), who: fresh.who ? String(fresh.who) : "" });
  const c = r0 && client(r0.cid);
  const month = r0 ? D.ads.filter(x => x.cid === r0.cid && x.date >= monthOf(r0.date)[0] && x.date <= r0.date && x.id !== r0.id).concat([r0]) : [];
  const [txt, setTxt] = useState(r0 && c ? adsText(r0, c, month, person(r0.who)?.name) : "");
  const [busy, run] = useBusy();
  if (!r0 || !c) return null;
  const s = adsAgg([r0]);
  const markSent = (msg) => run(() => seoApi(`/ads/${id}/sent`, { method: "PUT", body: { sent: true } }), () => onSaved(msg));
  const del = () => { if (window.confirm("Delete this day's report?")) run(() => seoApi(`/ads/${id}`, { method: "DELETE" }), () => onSaved("Deleted")); };
  return (
    <Modal title={`${c.name} · ${fdw(r0.date)}`} onClose={onClose} wide>
      <div className="m-b">
        <div className="tiles">
          <div className="tile"><div className="l">Spent</div><div className="v">{inr(s.spend)}</div></div>
          <div className="tile"><div className="l">Clicks</div><div className="v">{num(s.clicks)}</div><div className="s">CTR {s.ctr.toFixed(2)}%</div></div>
          <div className="tile"><div className="l">Avg CPC</div><div className="v">{inr2(s.cpc)}</div></div>
          <div className="tile"><div className="l">Leads</div><div className="v">{s.conv}</div><div className="s">{s.conv ? `${inr(s.cpl)} each` : ""}</div></div>
        </div>
        {s.terms.length > 0 && (
          <div className="card"><h3>Search terms <small>{s.terms.length} terms · red = spend with no lead</small></h3>
            <div className="tw" style={{ maxHeight: 260, overflow: "auto" }}><table className="terms" style={{ minWidth: 520 }}><thead><tr><th>Search term</th><th className="r">Clicks</th><th className="r">Impr.</th><th className="r">Cost</th><th className="r">Leads</th></tr></thead><tbody>
              {s.terms.map(t => <tr key={t.t} style={!t.conv && t.cost ? { color: "var(--red)" } : undefined}><td>{t.t}</td><td className="r num">{t.clicks}</td><td className="r num">{num(t.impr)}</td><td className="r num">{inr(t.cost)}</td><td className="r num b">{t.conv}</td></tr>)}
            </tbody></table></div></div>
        )}
        <F label={`Message to client (edit if needed)${c.phone ? ` · WhatsApp ${c.phone}` : ""}`}>
          <textarea rows={14} value={txt} onChange={e => setTxt(e.target.value)} className="msg" />
        </F>
        <div className="foot">
          <button type="button" className="btn" onClick={del} disabled={busy} style={{ marginRight: "auto" }}>Delete</button>
          <button type="button" className="btn" onClick={() => { copy(txt); toast.success("Copied"); }}>Copy</button>
          <a className="btn" href={`mailto:${c.email || ""}?subject=${encodeURIComponent(`Google Ads report: ${c.name}, ${fds(r0.date)}`)}&body=${encodeURIComponent(txt)}`} onClick={() => markSent(`Email opened for ${c.name}`)}>Email</a>
          <button type="button" className="btn wa" disabled={busy} onClick={() => { window.open(`https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(txt)}`, "_blank", "noopener"); markSent(`Report sent to ${c.name}`); }}>
            {r0.sent ? "Send again on WhatsApp" : "Send on WhatsApp"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── Keywords ───────── */
const Chg = ({ g }) => (g > 0 ? <span className="up">▲ {g}</span> : g < 0 ? <span className="down">▼ {-g}</span> : <span>0</span>);

export function KeywordView({ kw, onClose, onSaved }) {
  const H = kw.hist, s = kwStat(kw);
  const [busy, run] = useBusy();
  const W = 700, Hh = 220;
  const pts = H.map((x, i) => [30 + (i / Math.max(1, H.length - 1)) * (W - 40), 10 + ((posVal(x.pos) - 1) / 100) * (Hh - 30)]);
  const stop = () => { if (window.confirm(`Stop tracking "${kw.keyword}"? Its position history is deleted.`)) run(() => seoApi(`/keywords/${kw.id}`, { method: "DELETE" }), () => onSaved("Keyword removed")); };
  return (
    <Modal title={kw.keyword} onClose={onClose} wide>
      <div className="m-b">
        {s ? (
          <>
            <div className="tiles">
              <div className="tile"><div className="l">Day 1 ({fds(s.first.date)})</div><div className="v">{posTxt(s.first.pos)}</div></div>
              <div className="tile"><div className="l">Now</div><div className="v">{posTxt(s.cur.pos)}</div></div>
              <div className="tile"><div className="l">Change</div><div className="v"><Chg g={s.gain} /></div></div>
              <div className="tile"><div className="l">Best</div><div className="v">{posTxt(s.best.pos)}</div><div className="s">{fds(s.best.date)}</div></div>
            </div>
            <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label="Position history">
              {[1, 10, 30, 50, 100].map(p => { const y = 10 + ((p - 1) / 100) * (Hh - 30); return <g key={p}><line x1="30" x2={W - 10} y1={y} y2={y} stroke="#E5E9F0" /><text x="24" y={y + 4} fontSize="10" textAnchor="end" fill="#64748B">{p}</text></g>; })}
              <polyline fill="none" stroke="#2563EB" strokeWidth="2.5" points={pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} />
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#2563EB"><title>{fds(H[i].date)}: {posTxt(H[i].pos)}</title></circle>)}
              <text x="30" y={Hh - 2} fontSize="10" fill="#64748B">{fds(H[0].date)}</text>
              <text x={W - 10} y={Hh - 2} fontSize="10" textAnchor="end" fill="#64748B">{fds(H[H.length - 1].date)}</text>
            </svg>
            <p className="note" style={{ margin: 0 }}>Lower is better. The line going up the chart means the keyword is climbing Google.</p>
            <div className="card"><div className="tw" style={{ maxHeight: 260, overflow: "auto" }}><table className="terms" style={{ minWidth: 420 }}><thead><tr><th>Checked on</th><th className="r">Position</th><th className="r">Change</th><th>Page ranking</th></tr></thead><tbody>
              {[...H].reverse().map((h, i, a) => <tr key={h.date}><td>{fd(h.date)}</td><td className="r num b">{posTxt(h.pos)}</td><td className="r">{a[i + 1] ? <Chg g={posVal(a[i + 1].pos) - posVal(h.pos)} /> : ""}</td><td>{h.url ? <span className="url" style={{ maxWidth: 260 }}>{h.url}</span> : "-"}</td></tr>)}
            </tbody></table></div></div>
          </>
        ) : <p className="note">No positions recorded yet. Use “+ Rank check” to add today's position.</p>}
        <div className="foot"><button type="button" className="btn" onClick={stop} disabled={busy}>Stop tracking</button></div>
      </div>
    </Modal>
  );
}

export function KeywordAdd({ D, cid, onClose, onSaved }) {
  const c = D.clients.find(x => x.id === cid);
  const [list, setList] = useState("");
  const [busy, run] = useBusy();
  const submit = (ev) => {
    ev.preventDefault();
    // one per line: keyword, optional current position
    const rows = list.split(/\r?\n/).map(l => l.split(/\t|,/).map(x => x.trim())).filter(x => x[0]);
    if (!rows.length) return;
    run(async () => {
      for (const [keyword, pos, url] of rows) await seoApi("/keywords", { method: "POST", body: { client: cid, keyword, pos, url } }).catch(err => toast.error(`${keyword}: ${err.message}`));
    }, () => onSaved(`Tracking ${rows.length} keyword${rows.length > 1 ? "s" : ""} from today`));
  };
  return (
    <Modal title={`Agreed keywords · ${c?.name}`} onClose={onClose}>
      <form className="m-b" onSubmit={submit}>
        <F label="One keyword per line. Optionally add today's Google position after a comma (leave blank if not in the top 100).">
          <textarea rows={8} value={list} onChange={e => setList(e.target.value)} placeholder={"car ceramic coating, 34\nppf near me\ncar detailing bangalore, 12"} required />
        </F>
        <div className="foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={busy}>Start tracking</button></div>
      </form>
    </Modal>
  );
}

export function RankForm({ D, cid, onClose, onSaved }) {
  const c = D.clients.find(x => x.id === cid);
  const K = D.kws[cid] || [];
  const [date, setDate] = useState(T(0));
  const [rows, setRows] = useState(K.map(e => { const h = e.hist[e.hist.length - 1]; return `${e.keyword}\t${h ? posTxt(h.pos) : ""}\t${h?.url || ""}`; }).join("\n"));
  const [busy, run] = useBusy();
  const submit = (ev) => {
    ev.preventDefault();
    const list = rows.split(/\r?\n/).map(l => l.split(/\t|,/).map(x => x.trim())).filter(x => x[0]).map(([keyword, pos, url]) => ({ keyword, pos, url }));
    run(() => seoApi("/keywords/check", { method: "POST", body: { client: cid, date, rows: list } }), (j) => onSaved(`${j.saved} positions saved for ${fds(date)}`));
  };
  return (
    <Modal title={`Rank check · ${c?.name}`} onClose={onClose} wide>
      <form className="m-b" onSubmit={submit}>
        <F label="Checked on" className="narrow"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></F>
        <F label="One keyword per line: keyword, position, ranking URL. Leave the position blank or 100+ if not in the top 100. You can paste straight from a rank tracker export.">
          <textarea rows={10} value={rows} onChange={e => setRows(e.target.value)} />
        </F>
        <div className="foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={busy}>Save positions</button></div>
      </form>
    </Modal>
  );
}

/* ───────── Client and team member ───────── */
// Pick the people on a client: everyone ticked works on it and sees it in their Employee Portal
export function TeamPick({ D, value, onChange, compact }) {
  const T = D.team.filter(t => t.portal !== false && t.isActive !== false);
  const name = (id) => D.team.find(t => t.id === id)?.name || "Former member";
  const left = T.filter(t => !value.includes(t.id));
  return (
    <div className={`tpick ${compact ? "sm" : ""}`}>
      {value.map(id => <span key={id} className="tchip">{name(id)}<button type="button" aria-label={`Remove ${name(id)}`} onClick={() => onChange(value.filter(x => x !== id))}>×</button></span>)}
      {left.length > 0 && (
        <select value="" onChange={e => e.target.value && onChange([...value, e.target.value])} aria-label="Add a person">
          <option value="">{value.length ? "+ Add" : "+ Assign people"}</option>
          {left.map(t => <option key={t.id} value={t.id}>{t.name} · {(t.roles?.length ? t.roles : [t.role]).map(r => ({ seo: "SEO", ads: "Ads", design: "Design" }[r] || r)).join(", ")}</option>)}
        </select>
      )}
      {!value.length && !left.length && <span className="sub">No team yet</span>}
    </div>
  );
}

export function ClientForm({ D, edit, onClose, onSaved }) {
  const [leads, setLeads] = useState(null);
  const [find, setFind] = useState("");
  const [f, setF] = useState(() => ({
    lead: edit?.lead?._id || edit?.lead || "", name: edit?.name || "", contact: edit?.contact || "", phone: edit?.phone || "", email: edit?.email || "",
    site: edit?.site || "", start: edit?.start || T(0), members: edit?.members || [],
    budget: edit?.budget ?? 0, metaBudget: edit?.metaBudget ?? 0, backlink: edit?.targets?.backlink ?? 40, blog: edit?.targets?.blog ?? 4, gmb: edit?.targets?.gmb ?? 12, poster: edit?.targets?.poster ?? 6, keywords: "",
  }));
  const [busy, run] = useBusy();
  useEffect(() => { if (!edit) seoApi("/lead-options").then(j => setLeads(j.data || [])).catch(() => setLeads([])); }, [edit]);
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const pickLead = (id) => {
    const l = (leads || []).find(x => x._id === id);
    setF(s => ({ ...s, lead: id, ...(l ? { name: l.business || l.company || l.name, contact: l.name, phone: l.phone || "", email: l.email || "" } : {}) }));
    if (l) {
      const ads = l.services.find(x => x.type === "Google Ads" && x.active);
      if (ads && !Number(f.budget)) setF(s => ({ ...s, budget: ads.amount }));
    }
  };
  const options = useMemo(() => {
    const s = find.trim().toLowerCase();
    const L = (leads || []).filter(l => !D.clients.some(c => String(c.lead?._id || c.lead) === l._id));
    const hit = L.filter(l => !s || [l.name, l.business, l.company, l.phone].some(v => String(v || "").toLowerCase().includes(s)));
    // leads with an SEO / Ads monthly service first
    return hit.sort((a, b) => b.services.length - a.services.length).slice(0, 150);
  }, [leads, find, D.clients]);
  const submit = (ev) => {
    ev.preventDefault();
    const body = {
      lead: f.lead || null, name: f.name, contact: f.contact, phone: f.phone, email: f.email, site: f.site, start: f.start,
      members: f.members, budget: Number(f.budget) || 0, metaBudget: Number(f.metaBudget) || 0,
      targets: { backlink: Number(f.backlink), blog: Number(f.blog), gmb: Number(f.gmb), poster: Number(f.poster) },
      ...(edit ? {} : { keywords: f.keywords.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean) }),
    };
    run(() => seoApi(edit ? `/clients/${edit.id}` : "/clients", { method: edit ? "PUT" : "POST", body }), () => onSaved(edit ? "Client saved" : `${f.name} added`));
  };
  return (
    <Modal title={edit ? `Edit ${edit.name}` : "Add SEO / Ads client"} onClose={onClose} wide>
      <form className="m-b" onSubmit={submit}>
        {!edit && (
          <F label="CRM lead (fills the details below; leads with an SEO or Google Ads monthly service are listed first)">
            {leads == null ? <span className="note">Loading leads…</span> : (
              <>
                <input value={find} onChange={e => setFind(e.target.value)} placeholder="Search lead by name, company or phone" />
                <select size={5} value={f.lead} onChange={e => pickLead(e.target.value)} className="pick">
                  <option value="">Not in the CRM</option>
                  {options.map(l => <option key={l._id} value={l._id}>{l.name}{l.business || l.company ? ` · ${l.business || l.company}` : ""}{l.services.length ? ` · ${l.services.map(s => s.type).join(", ")}` : ""}</option>)}
                </select>
              </>
            )}
          </F>
        )}
        <div className="g2">
          <F label="Client / business name"><input value={f.name} onChange={set("name")} required /></F>
          <F label="Website"><input value={f.site} onChange={set("site")} placeholder="example.com" /></F>
        </div>
        <div className="g3">
          <F label="Contact person"><input value={f.contact} onChange={set("contact")} /></F>
          <F label="WhatsApp number"><input value={f.phone} onChange={set("phone")} inputMode="numeric" /></F>
          <F label="Email"><input type="email" value={f.email} onChange={set("email")} /></F>
        </div>
        <div className="g4">
          <F label="Day 1 (start date)"><input type="date" value={f.start} onChange={set("start")} required /></F>
          <div className="span3"><F label="Team on this client (everyone added works on it)"><TeamPick D={D} value={f.members} onChange={v => setF(x => ({ ...x, members: v }))} /></F></div>
        </div>
        <div className="g5">
          <F label="Backlinks / month"><input type="number" min="0" value={f.backlink} onChange={set("backlink")} /></F>
          <F label="Blogs / month"><input type="number" min="0" value={f.blog} onChange={set("blog")} /></F>
          <F label="GMB / month"><input type="number" min="0" value={f.gmb} onChange={set("gmb")} /></F>
          <F label="Posters / month"><input type="number" min="0" value={f.poster} onChange={set("poster")} /></F>
          <F label="Google Ads budget / month (₹)"><input type="number" min="0" step="1000" value={f.budget} onChange={set("budget")} /></F>
          <F label="Meta Ads budget / month (₹)"><input type="number" min="0" step="1000" value={f.metaBudget} onChange={set("metaBudget")} /></F>
        </div>
        {!edit && <F label="Agreed keywords (one per line, optional)"><textarea rows={4} value={f.keywords} onChange={set("keywords")} placeholder={"car ceramic coating\nppf near me"} /></F>}
        {!D.team.length && <div className="hint">Tip: add team members first so you can assign them here.</div>}
        <div className="foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={busy}>{edit ? "Save" : "Add client"}</button></div>
      </form>
    </Modal>
  );
}

export function MemberForm({ edit, onClose, onSaved }) {
  const [f, setF] = useState({ name: edit?.name || "", role: edit?.role || "seo", phone: edit?.phone || "", email: edit?.email || "", isActive: edit ? edit.isActive !== false : true });
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const submit = (ev) => {
    ev.preventDefault();
    run(() => seoApi(edit ? `/team/${edit.id}` : "/team", { method: edit ? "PUT" : "POST", body: f }), () => onSaved(edit ? "Saved" : `${f.name} added`));
  };
  return (
    <Modal title={edit ? `Edit ${edit.name}` : "Add team member"} onClose={onClose}>
      <form className="m-b" onSubmit={submit}>
        <div className="g2">
          <F label="Name"><input value={f.name} onChange={set("name")} required /></F>
          <F label="Role"><select value={f.role} onChange={set("role")}>{Object.entries(ROLE).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select></F>
        </div>
        <div className="g2">
          <F label="Phone"><input value={f.phone} onChange={set("phone")} /></F>
          <F label="Email"><input type="email" value={f.email} onChange={set("email")} /></F>
        </div>
        {edit && <label className="chkline"><input type="checkbox" checked={f.isActive} onChange={e => setF(s => ({ ...s, isActive: e.target.checked }))} /> Active</label>}
        <div className="foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}
