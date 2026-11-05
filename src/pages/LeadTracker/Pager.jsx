import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import "./Pager.css";

// Page numbers for long lists: first, previous, numbered pages, next, last, and rows per page
function nums(cur, pages) {
  const out = [], add = (n) => out.push(n);
  const lo = Math.max(1, cur - 2), hi = Math.min(pages - 2, cur + 2);
  add(0);
  if (lo > 1) add("…a");
  for (let i = lo; i <= hi; i++) add(i);
  if (hi < pages - 2) add("…b");
  if (pages > 1) add(pages - 1);
  return out;
}

export default function Pager({ total, page, per, onPage, onPer, sizes = [25, 50, 100, 200], label = "leads", top }) {
  const pages = Math.max(1, Math.ceil(total / per)), cur = Math.min(page, pages - 1);
  const go = (n) => { onPage(Math.max(0, Math.min(pages - 1, n))); if (!top) window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <div className={`lt-pager ${top ? "top" : ""}`}>
      <span>Showing <b>{total ? cur * per + 1 : 0}</b> to <b>{Math.min(total, cur * per + per)}</b> of <b>{total.toLocaleString("en-IN")}</b> {label}</span>
      <span className="lt-pages">
        {onPer && (
          <><label className="lt-sr" htmlFor={`per-${label}-${top ? "t" : "b"}`}>Rows per page</label>
            <select id={`per-${label}-${top ? "t" : "b"}`} className="lt-in sm" value={per} onChange={e => { onPer(Number(e.target.value)); onPage(0); }}>
              {sizes.map(n => <option key={n} value={n}>{n} per page</option>)}
            </select></>
        )}
        <button type="button" className="lt-pg" disabled={!cur} onClick={() => go(0)} aria-label="First page"><ChevronsLeft size={15} /></button>
        <button type="button" className="lt-pg" disabled={!cur} onClick={() => go(cur - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
        {nums(cur, pages).map(n => (typeof n === "string"
          ? <span key={n} className="lt-gap">…</span>
          : <button type="button" key={n} className={`lt-pg ${n === cur ? "on" : ""}`} aria-current={n === cur ? "page" : undefined} onClick={() => go(n)}>{n + 1}</button>))}
        <button type="button" className="lt-pg" disabled={cur >= pages - 1} onClick={() => go(cur + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
        <button type="button" className="lt-pg" disabled={cur >= pages - 1} onClick={() => go(pages - 1)} aria-label="Last page"><ChevronsRight size={15} /></button>
      </span>
    </div>
  );
}
