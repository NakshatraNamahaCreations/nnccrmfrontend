// Live chat updates from the server (Socket.IO). The server only says "this chat changed";
// the screen then loads the new messages through the normal API.
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API } from "../pages/ProjectBilling/billingMeta";

const readToken = () => { try { return localStorage.getItem("nnc_token") || ""; } catch { return ""; } };

let sock = null, sockTok = "";
function socketFor(token) {
  if (!token) { sock?.close(); sock = null; sockTok = ""; return null; }
  if (sock && sockTok === token) return sock;
  sock?.close();
  sockTok = token;
  sock = io(API || undefined, { auth: { token }, path: "/socket.io" });
  return sock;
}

// True while the live connection is up (screens then check the server less often)
export const liveOn = () => !!sock?.connected;

// Run fn(data) when the server sends this event
export function useLive(event, fn) {
  const cb = useRef(fn);
  useEffect(() => { cb.current = fn; });
  const token = readToken();
  useEffect(() => {
    const s = socketFor(token);
    if (!s) return undefined;
    const h = (d) => cb.current(d);
    s.on(event, h);
    return () => { s.off(event, h); };
  }, [event, token]);
}

// Check the server every `ms`, but only every 15 seconds while the live connection is up
export function every(ms, fn) {
  let n = 0;
  const per = Math.max(1, Math.round(15000 / ms));
  const t = setInterval(() => { if (!liveOn() || ++n % per === 0) fn(); }, ms);
  return () => clearInterval(t);
}
