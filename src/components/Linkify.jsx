// Text with any web address in it turned into a link that opens in a new tab
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;

export default function Linkify({ text }) {
  const s = String(text ?? "");
  const parts = s.split(URL_RE);
  return parts.map((p, i) => (i % 2
    ? <a key={i} className="lnk" href={/^https?:/i.test(p) ? p : `https://${p}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{p}</a>
    : p));
}
