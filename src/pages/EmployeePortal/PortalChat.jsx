import { useEffect, useRef, useState } from "react";
import { Send, Megaphone, X } from "lucide-react";
import { toast } from "../../utils/toast";
import { billingApi } from "../ProjectBilling/billingMeta";
import { initials } from "../SeoTeam/seoUtil";

// Chat with each employee in the Employee Portal, plus announcements to everyone
const papi = (path, opts) => billingApi(`/portal/admin${path}`, opts);
const tm = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const ROLE = { seo: "SEO analyst", seox: "SEO expert", ads: "Google Ads expert", gfx: "Graphic designer", app: "App developer", web: "Website developer", back: "Backend developer", full: "Full stack developer", ux: "UI/UX designer", test: "Tester", other: "Team member", acc: "Accountant" };
const TEAM = [["", "Everyone"], ["seo,seox,ads,gfx", "Digital Marketing"], ["app,web,back,full,ux,test,other", "Development and design"], ["acc", "Accounts"]];

export default function PortalChat({ onUnread }) {
  const [threads, setThreads] = useState(null);
  const [sel, setSel] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ann, setAnn] = useState(false);
  const [tick, setTick] = useState(0);
  const end = useRef(null);

  useEffect(() => {
    let live = true;
    const load = () => papi("/threads").then(j => { if (live) { setThreads(j.data); onUnread?.(j.data.reduce((a, t) => a + t.unread, 0)); } }, () => live && setThreads(t => t || []));
    load();
    const t = setInterval(load, 5000);
    return () => { live = false; clearInterval(t); };
  }, [tick, onUnread]);
  useEffect(() => {
    if (!sel) return undefined;
    let live = true;
    const load = () => papi(`/messages/${sel}`).then(j => live && setMsgs(j.data), () => {});
    load();
    const t = setInterval(load, 2500);
    return () => { live = false; clearInterval(t); };
  }, [sel, tick]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !sel) return;
    setBusy(true);
    try { await papi(`/messages/${sel}`, { method: "POST", body: { text: text.trim() } }); setText(""); setTick(x => x + 1); }
    catch (ex) { toast.error(ex.message); }
    finally { setBusy(false); }
  };
  const announce = async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    try {
      const j = await papi("/announce", { method: "POST", body: { text: f.text, roles: f.team ? f.team.split(",") : [] } });
      toast.success(`Announcement sent to ${j.sent} employee${j.sent === 1 ? "" : "s"}`); setAnn(false);
    } catch (ex) { toast.error(ex.message); }
  };
  const cur = (threads || []).find(t => t.id === sel);

  return (
    <>
      <div className="filters">
        <span className="sub">Messages reach the employee's portal straight away, with a notification on their bell.</span>
        <span className="sp" />
        <button type="button" className="btn pri" onClick={() => setAnn(true)}><Megaphone size={14} /> Send an announcement</button>
      </div>
      <div className="card ep-chat">
        <div className="ep-threads">
          {threads == null ? <div className="empty">Loading…</div> : !threads.length ? <div className="empty">No employees yet.</div> : threads.map(t => (
            <button key={t.id} type="button" className={`ep-th ${sel === t.id ? "on" : ""}`} onClick={() => setSel(t.id)}>
              <span className="av" style={{ background: "#2563EB" }}>{initials(t.name)}</span>
              <span className="ep-th-x"><b>{t.name}</b><span className="sub">{t.last ? `${t.last.from === "admin" ? "You: " : ""}${t.last.text}` : ROLE[t.role] || t.role}</span></span>
              {t.unread > 0 && <em>{t.unread}</em>}
            </button>
          ))}
        </div>
        <div className="ep-conv">
          {!cur ? <div className="empty">Pick an employee to read and reply.</div> : (
            <>
              <div className="ep-conv-h"><b>{cur.name}</b><span className="sub">{ROLE[cur.role] || cur.role}{cur.status === "disabled" ? " · disabled" : ""}</span></div>
              <div className="ep-conv-b">
                {msgs.length ? msgs.map(m => (
                  <div key={m._id} className={`ep-cm ${m.from === "admin" ? "me" : ""}`}>
                    <div className="bub">
                      {m.from === "admin" && <b className="who">{m.by}</b>}
                      {m.refName && <span className="about">About {m.refName}</span>}
                      <span className="txt">{m.text}</span>
                      <small>{tm(m.createdAt)}{m.from === "admin" ? (m.readEmp ? " · seen" : " · sent") : ""}</small>
                    </div>
                  </div>
                )) : <div className="empty">No messages yet. Write the first one below.</div>}
                <div ref={end} />
              </div>
              <form className="ep-conv-f" onSubmit={send}>
                <textarea rows={1} value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${cur.name}…`} aria-label="Message"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} />
                <button className="btn pri" disabled={busy || !text.trim()} aria-label="Send"><Send size={15} /></button>
              </form>
            </>
          )}
        </div>
      </div>
      {ann && (
        <>
          <div className="mscrim" onClick={() => setAnn(false)} />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="m-h"><h3>Send an announcement</h3><button type="button" className="btn sm" onClick={() => setAnn(false)} aria-label="Close"><X size={14} /></button></div>
            <form className="ep-mb ep-form" onSubmit={announce}>
              <label className="f"><span className="flabel">To</span><select name="team">{TEAM.map(([k, l]) => <option key={l} value={k}>{l}</option>)}</select></label>
              <label className="f"><span className="flabel">Announcement</span><textarea name="text" rows={4} required placeholder="Office closed on Friday for Diwali. Submit your day by Thursday 7 pm." /></label>
              <p className="sub">It appears on each employee's notification bell.</p>
              <div className="ep-row"><button className="btn pri">Send</button></div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
