import { Check, CheckCheck, Clock3 } from "lucide-react";
// ✓ sent, ✓✓ seen (like WhatsApp)
export function Tick({ pending, seen, title }) {
  if (pending) return <span className="tick" title="Sending"><Clock3 size={12} /></span>;
  return <span className={`tick${seen ? " seen" : ""}`} title={title || (seen ? "Seen" : "Sent")}>{seen ? <CheckCheck size={14} /> : <Check size={14} />}</span>;
}
