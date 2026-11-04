import { useEffect, useRef, useState } from "react";
import { MessageSquareText, X, ArrowLeft, Send, Hash } from "lucide-react";
import { billingApi } from "../../pages/ProjectBilling/billingMeta";
import { toast } from "../../utils/toast";
import { useRise, useNewMessage } from "../../utils/ding";
import "./TeamChat.css";

// Floating team chat in the CRM: the admin joins the Employee Portal group channels
// (Everyone, Development and design, Digital Marketing). Employees chat from the portal.
const tapi = (path, opts) => billingApi(`/portal/admin/team${path}`, opts);
const ROLE = { admin: ["Admin", "#0F172A"], seo: ["SEO analyst", "#0891B2"], seox: ["SEO expert", "#0E7490"], ads: ["Google Ads expert", "#D97706"], gfx: ["Graphic designer", "#DB2777"], app: ["App developer", "#2563EB"], web: ["Website developer", "#0D9488"], back: ["Backend developer", "#4F46E5"], full: ["Full stack developer", "#0369A1"], ux: ["UI/UX designer", "#DB2777"], test: ["Tester", "#7C3AED"], other: ["Team member", "#64748B"], acc: ["Accountant", "#475569"] };
const mine = (m) => m.mine;
const ini = (n) => String(n || "?").split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase();
const tm = (d) => {
  const x = new Date(d);
  return x.toDateString() === new Date().toDateString() ? x.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function TeamChat() {
  const [open, setOpen] = useState(false);
  const [chans, setChans] = useState([]);
  const [unread, setUnread] = useState(0);
  const [cur, setCur] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [off, setOff] = useState(false);
  const end = useRef(null);
  useRise(unread, "msg");                 // sound for new team messages
  useNewMessage(msgs, cur?.id, mine);

  useEffect(() => {
    if (off) return undefined;
    let live = true;
    const load = () => tapi("/channels").then(j => { if (live) { setChans(j.data); setUnread(j.unread); } }, (e) => { if (live && e.status === 403) setOff(true); });
    load();
    const t = setInterval(load, open ? 3000 : 8000);
    return () => { live = false; clearInterval(t); };
  }, [open, tick, off]);
  useEffect(() => {
    if (!cur) return undefined;
    let live = true;
    const load = () => tapi(`/messages?channel=${encodeURIComponent(cur.id)}`).then(j => live && setMsgs(j.data), () => {});
    load();
    const t = setInterval(load, 2000);
    return () => { live = false; clearInterval(t); };
  }, [cur, tick]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, cur]);

  if (off) return null;
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !cur) return;
    setBusy(true);
    try { await tapi("/messages", { method: "POST", body: { channel: cur.id, text: text.trim() } }); setText(""); setTick(x => x + 1); }
    catch (ex) { toast.error(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className={`nnc-tc ${open ? "open" : ""}`}>
      {open && (
        <div className="nnc-tc-panel" role="dialog" aria-label="Team chat">
          <div className="nnc-tc-h">
            {cur && <button type="button" className="nnc-tc-ib" onClick={() => { setCur(null); setTick(x => x + 1); }} aria-label="Back"><ArrowLeft size={17} /></button>}
            <div className="nnc-tc-ht"><b>{cur ? cur.name : "Team chat"}</b><span>{cur ? "Everyone in this group can read it" : "Employee Portal groups"}</span></div>
            <button type="button" className="nnc-tc-ib" onClick={() => setOpen(false)} aria-label="Close chat"><X size={17} /></button>
          </div>
          {!cur ? (
            <div className="nnc-tc-list">
              {chans.map(c => (
                <button key={c.id} type="button" className={`nnc-tc-row ${c.unread ? "un" : ""}`} onClick={() => { setMsgs([]); setCur(c); }}>
                  <span className="nnc-tc-av grp"><Hash size={15} /></span>
                  <span className="nnc-tc-rx"><b>{c.name}</b><span>{c.last ? `${c.last.name}: ${c.last.text}` : "No messages yet"}</span></span>
                  <span className="nnc-tc-rm">{c.last && <small>{tm(c.last.at)}</small>}{c.unread > 0 && <em>{c.unread}</em>}</span>
                </button>
              ))}
              <p className="nnc-tc-note">One-to-one chats with an employee are in Employee Portal → Messages.</p>
            </div>
          ) : (
            <>
              <div className="nnc-tc-body">
                {!msgs.length ? <div className="nnc-tc-empty">No messages yet.</div> : msgs.map((m, i) => {
                  const first = i === 0 || msgs[i - 1].who !== m.who || new Date(m.createdAt) - new Date(msgs[i - 1].createdAt) > 600000;
                  const R = ROLE[m.role] || [m.role, "#64748B"];
                  return (
                    <div key={m._id} className={`nnc-tc-m ${m.mine ? "me" : ""} ${first ? "first" : ""}`}>
                      {!m.mine && <span className="nnc-tc-av" style={{ background: R[1], visibility: first ? "visible" : "hidden" }}>{ini(m.name)}</span>}
                      <div className="nnc-tc-bub">
                        {first && !m.mine && <b className="nnc-tc-who">{m.name} <span>{R[0]}</span></b>}
                        <span className="nnc-tc-txt">{m.text}</span>
                        <small>{tm(m.createdAt)}</small>
                      </div>
                    </div>
                  );
                })}
                <div ref={end} />
              </div>
              <form className="nnc-tc-f" onSubmit={send}>
                <textarea rows={1} value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${cur.name}…`} aria-label="Message"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} />
                <button className="nnc-tc-send" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
              </form>
            </>
          )}
        </div>
      )}
      <button type="button" className="nnc-tc-fab" onClick={() => setOpen(o => !o)} aria-label={`Team chat${unread ? `, ${unread} unread` : ""}`}>
        {open ? <X size={22} /> : <MessageSquareText size={22} />}
        {!open && <span className="nnc-tc-lbl">Team chat</span>}
        {unread > 0 && !open && <em>{unread > 99 ? "99+" : unread}</em>}
      </button>
    </div>
  );
}
