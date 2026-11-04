import { useEffect, useRef } from "react";

// Short sounds for new notifications and chat messages, made with Web Audio (no sound files).
// Browsers only allow sound after the person has clicked or typed on the page once.
let ctx = null;
let last = 0;
function unlock() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* no audio in this browser */ }
}
if (typeof window !== "undefined") ["pointerdown", "keydown"].forEach(e => window.addEventListener(e, unlock, { passive: true }));

// kind "msg": two quick notes; "notif": a three note chime
export function ding(kind = "msg") {
  const now = Date.now();
  if (now - last < 1200) return;            // one sound for a burst of new items
  last = now;
  try {
    unlock();
    if (!ctx || ctx.state !== "running") return;
    (kind === "msg" ? [880, 1320] : [660, 990, 1320]).forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.12;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.3);
    });
  } catch { /* ignore */ }
}

// Sound when a count goes up (not on the first reading)
export function useRise(n, kind) {
  const prev = useRef(null);
  useEffect(() => {
    if (prev.current != null && n > prev.current) ding(kind);
    prev.current = n;
  }, [n, kind]);
}

// Sound when a newer message from someone else shows up in the open conversation
export function useNewMessage(list, key, isMine) {
  const prev = useRef({ key: null, at: 0 });
  useEffect(() => {
    const L = list || [];
    const newest = L.reduce((a, m) => (!a || new Date(m.createdAt) > new Date(a.createdAt) ? m : a), null);
    const at = newest ? +new Date(newest.createdAt) : 0;
    const p = prev.current;
    if (p.key === key && p.at && at > p.at && !isMine(newest)) ding("msg");
    prev.current = { key, at };
  }, [list, key, isMine]);
}
