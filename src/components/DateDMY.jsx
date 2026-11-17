import { useRef, useState } from "react";

// "2026-11-17" → "17/11/2026"
const dmy = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

// A date box that always reads day/month/year, whatever the computer's language setting.
// The browser's own calendar still opens on click; the value stays "YYYY-MM-DD".
// Works controlled (value + onChange) or inside a form (name + defaultValue).
export default function DateDMY({ value, defaultValue, onChange, className = "", placeholder = "dd/mm/yyyy", ...rest }) {
  const [own, setOwn] = useState(defaultValue || "");
  const v = value !== undefined ? value : own;
  const r = useRef(null);
  const open = () => { try { r.current?.showPicker(); } catch { r.current?.focus(); } };
  return (
    <span className={`dmy ${className}`} onClick={open}>
      <span className={v ? "dmy-v" : "dmy-v ph"}>{dmy(v) || placeholder}</span>
      <svg className="dmy-i" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      <input ref={r} type="date" value={v} onChange={e => { if (value === undefined) setOwn(e.target.value); onChange?.(e); }} {...rest} />
    </span>
  );
}
