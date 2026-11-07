import Linkify from "../Linkify";
import { useEffect, useRef, useState } from "react";
import { MessageSquareText, X, ArrowLeft, Send, Hash } from "lucide-react";
import { billingApi } from "../../pages/ProjectBilling/billingMeta";
import { toast } from "../../utils/toast";
import { useRise, useNewMessage } from "../../utils/ding";
import { useLive, every, useTyping, sayTyping, typingText, myAdminName, myAdminWho } from "../../utils/live";
import { Tick } from "../Tick";
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
  const typingIn = useTyping((d) => (d.chat === "team" && d.who !== myAdminWho() ? { chat: d.channel, person: d.who } : null));
  const tp = cur ? typingIn(cur.id) : [];
  useRise(unread, "msg");                 // sound for new team messages
  useNewMessage(msgs, cur?.id, mine);

  useEffect(() => {
    if (off) return undefined;
    let live = true;
    const load = () => tapi("/channels").then(j => { if (live) { setChans(j.data); setUnread(j.unread); } }, (e) => { if (live && e.status === 403) setOff(true); });
    load();
    const stop = every(open ? 3000 : 8000, load);
    return () => { live = false; stop(); };
  }, [open, tick, off]);
  useEffect(() => {
    if (!cur) return undefined;
    let live = true;
    const load = () => tapi(`/messages?channel=${encodeURIComponent(cur.id)}`).then(j => live && setMsgs(j.data), () => {});
    load();
    const stop = every(2000, load);
    return () => { live = false; stop(); };
  }, [cur, tick]);
  // a new message in a group: reload straight away
  useLive("team", () => setTick(x => x + 1));
  useEffect(() => { const b = end.current?.parentElement; if (b) b.scrollTop = b.scrollHeight; }, [msgs.length, cur]);
  // Closing always goes back to the chat list, so the chat opens fresh next time.
  // A click anywhere outside the chat closes it; Esc goes back to the list, then closes.
  const root = useRef(null);
  const close = () => { setOpen(false); setCur(null); setMsgs([]); setText(""); };
  const back = () => { setCur(null); setTick(x => x + 1); };
  const closeRef = useRef(close), backRef = useRef(back);
  useEffect(() => { closeRef.current = close; backRef.current = back; });
  const hasCur = !!cur;
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (root.current && !root.current.contains(e.target)) closeRef.current(); };
    const key = (e) => { if (e.key === "Escape") (hasCur ? backRef.current : closeRef.current)(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); document.removeEventListener("keydown", key); };
  }, [open, hasCur]);


  if (off) return null;
  // The message shows straight away; it is swapped for the saved one when the server answers
  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !cur) return;
    const tmp = { _id: `tmp-${Date.now()}`, mine: true, who: "me", role: "admin", text: t, createdAt: new Date().toISOString(), pending: true };
    setMsgs(L => [...L, tmp]); setText(""); setBusy(true);
    try {
      const j = await tapi("/messages", { method: "POST", body: { channel: cur.id, text: t } });
      setMsgs(L => L.map(m => (m._id === tmp._id ? j.data : m)));
    } catch (ex) { setMsgs(L => L.filter(m => m._id !== tmp._id)); setText(t); toast.error(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className={`nnc-tc ${open ? "open" : ""}`} ref={root}>
      {open && (
        <div className="nnc-tc-panel" role="dialog" aria-label="Team chat">
          <div className="nnc-tc-h">
            {cur && <button type="button" className="nnc-tc-back" onClick={back} aria-label="Back to all chats" title="Back to all chats (Esc)"><ArrowLeft size={16} /><span>All chats</span></button>}
            <div className="nnc-tc-ht"><b>{cur ? cur.name : "Team chat"}</b><span>{cur ? "Everyone in this group can read it" : "Employee Portal groups"}</span></div>
            <button type="button" className="nnc-tc-ib" onClick={close} aria-label="Close chat" title="Close (click outside or Esc)"><X size={17} /></button>
          </div>
          {!cur ? (
            <div className="nnc-tc-list">
              {chans.map(c => (
                <button key={c.id} type="button" className={`nnc-tc-row ${c.unread ? "un" : ""}`} onClick={() => { setMsgs([]); setCur(c); }}>
                  <span className="nnc-tc-av grp"><Hash size={15} /></span>
                  <span className="nnc-tc-rx"><b>{c.name}</b>{typingIn(c.id).length ? <span className="row-typing">{typingText(typingIn(c.id))}</span> : <span>{c.last ? `${c.last.name}: ${c.last.text}` : "No messages yet"}</span>}</span>
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
                        <span className="nnc-tc-txt"><Linkify text={m.text} /></span>
                        <small>{tm(m.createdAt)}{m.mine && <Tick pending={m.pending} seen={m.seenBy > 0} title={m.seenBy > 0 ? `Seen by ${m.seenBy}` : "Sent"} />}{m.mine && m.seenBy > 0 && <span className="tick-n">{m.seenBy}</span>}</small>
                      </div>
                    </div>
                  );
                })}
                <div ref={end} />
              </div>
              {tp.length > 0 && <div className="typing" aria-live="polite"><i><b /><b /><b /></i>{typingText(tp)}</div>}
              <form className="nnc-tc-f" onSubmit={send}>
                <textarea rows={1} value={text} onChange={e => { setText(e.target.value); if (e.target.value) sayTyping({ chat: "team", channel: cur.id, name: myAdminName() }); }} placeholder={`Message ${cur.name}…`} aria-label="Message"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} />
                <button className="nnc-tc-send" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
              </form>
            </>
          )}
        </div>
      )}
      <button type="button" className={`nnc-tc-fab${unread > 0 ? " has-new" : ""}`} onClick={() => (open ? close() : setOpen(true))} title="Team chat" aria-label={`Team chat${unread ? `, ${unread} unread` : ""}`}>
        {open ? <X size={20} /> : <MessageSquareText size={20} />}
        {unread > 0 && !open && <em>{unread > 99 ? "99+" : unread}</em>}
      </button>
    </div>
  );
}
