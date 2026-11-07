// Live chat updates from the server (Socket.IO). The server only says "this chat changed";
// the screen then loads the new messages through the normal API.
import { useCallback, useEffect, useRef, useState } from "react";
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

// "X is typing…": chatOf(signal) says which chat and person a signal is for (or null to ignore it).
// Returns namesIn(chat) → the names typing there in the last few seconds.
export function useTyping(chatOf) {
  const [map, setMap] = useState({});
  useLive("typing", (d) => {
    const k = chatOf(d);
    if (k) setMap(m => ({ ...m, [`${k.chat}|${k.person}`]: { chat: k.chat, name: d.name, at: Date.now() } }));
  });
  useEffect(() => {
    const t = setInterval(() => setMap(m => {
      const now = Date.now(), keep = Object.entries(m).filter(([, v]) => now - v.at < 4000);
      return keep.length === Object.keys(m).length ? m : Object.fromEntries(keep);
    }), 1000);
    return () => clearInterval(t);
  }, []);
  return useCallback((chat) => Object.values(map).filter(v => v.chat === chat).map(v => v.name), [map]);
}
// Tell the others in a chat that I am typing (at most every 2 seconds)
let lastTyping = 0;
export function sayTyping(payload) {
  const now = Date.now();
  if (!sock?.connected || now - lastTyping < 2000) return;
  lastTyping = now;
  sock.emit("typing", payload);
}
export const typingText = (names) => (!names.length ? "" : names.length === 1 ? `${names[0].split(" ")[0]} is typing…` : `${names.length} people are typing…`);

// This admin's id in team chat ("admin:<id>"), read from the login token
export function myAdminWho() {
  try { return `admin:${JSON.parse(atob(readToken().split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).id}`; } catch { return ""; }
}
export const myAdminName = () => { try { return JSON.parse(localStorage.getItem("nnc_user") || "null")?.name || "Admin"; } catch { return "Admin"; } };
