"use client";

import { useEffect, useRef, useState } from "react";
import { getFreshCsrfToken } from "@/lib/csrf-client";
import type { VisitorChatMessage, VisitorChatSnapshot, VisitorConversation } from "@/lib/customer-chat-types";

const storageKey = "shanze-live-chat";

function mergeMessages(previous: VisitorChatMessage[], next: VisitorChatMessage[]) {
  const items = new Map(previous.map((item) => [item.id, item]));
  for (const item of next) items.set(item.id, { ...item, readAt: item.readAt || items.get(item.id)?.readAt || null });
  return [...items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function useCustomerChat(open: boolean, enabled: boolean, visibleReplyId: string) {
  const [conversation, setConversation] = useState<VisitorConversation | null>(null);
  const [messages, setMessages] = useState<VisitorChatMessage[]>([]);
  const [syncState, setSyncState] = useState<"connecting" | "live" | "polling" | "reconnecting">("connecting");
  const [foreground, setForeground] = useState(false);
  const [receiptRetry, setReceiptRetry] = useState(0);
  const liveRef = useRef(false);
  const ackRef = useRef("");
  const conversationId = conversation?.conversationId;
  const token = conversation?.token;

  useEffect(() => {
    if (!enabled) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as VisitorConversation;
        if (typeof parsed.conversationId === "string" && typeof parsed.token === "string" && typeof parsed.sessionId === "string") setConversation(parsed);
      }
    } catch { /* Storage is optional; an in-memory conversation still works. */ }
    const onFocus = () => setForeground(document.visibilityState === "visible" && document.hasFocus());
    onFocus();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onFocus);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !conversationId || !token) return;
    let stopped = false;
    let streamController: AbortController | undefined;
    const pollingController = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let pollingBusy = false;
    liveRef.current = false;
    setSyncState("connecting");
    const receive = (snapshot: VisitorChatSnapshot) => {
      if (!stopped && Array.isArray(snapshot.data)) setMessages((previous) => mergeMessages(previous, snapshot.data));
    };
    const forgetConversation = () => {
      if (stopped) return;
      stopped = true;
      streamController?.abort(); pollingController.abort();
      setConversation(null); setMessages([]); ackRef.current = "";
      try { window.localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
    };
    const poll = async () => {
      if (stopped || pollingBusy) return;
      pollingBusy = true;
      try {
        const response = await fetch(`/api/customer-chat?conversation=${encodeURIComponent(conversationId)}`, { credentials: "same-origin", cache: "no-store", headers: { "x-chat-token": token }, signal: pollingController.signal });
        if (response.status === 404) { forgetConversation(); return; }
        if (!response.ok) throw new Error("Chat sync unavailable");
        receive(await response.json());
        if (!liveRef.current && !stopped) setSyncState("polling");
      } catch { if (!stopped && !liveRef.current) setSyncState("reconnecting"); }
      finally { pollingBusy = false; }
    };
    const connect = async () => {
      if (stopped) return;
      streamController = new AbortController();
      const resetWatchdog = () => {
        if (watchdog) clearTimeout(watchdog);
        watchdog = setTimeout(() => streamController?.abort(), 25000);
      };
      try {
        resetWatchdog();
        const response = await fetch(`/api/customer-chat/stream?conversation=${encodeURIComponent(conversationId)}`, { credentials: "same-origin", cache: "no-store", headers: { "x-chat-token": token }, signal: streamController.signal });
        if (response.status === 404) { forgetConversation(); return; }
        if (!response.ok || !response.body) throw new Error("Chat stream unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (!stopped) {
            const chunk = await reader.read();
            if (chunk.done) break;
            resetWatchdog();
            buffer += decoder.decode(chunk.value, { stream: true });
            let boundary;
            while ((boundary = buffer.indexOf("\n\n")) !== -1) {
              const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              if (!frame.split("\n").some((line) => line.trim() === "event: messages")) continue;
              const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
              receive(JSON.parse(data));
              liveRef.current = true;
              if (!stopped) setSyncState("live");
            }
          }
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      } catch { /* Polling preserves reply delivery while the stream reconnects. */ }
      finally {
        if (watchdog) clearTimeout(watchdog);
        liveRef.current = false;
        if (!stopped) { setSyncState("reconnecting"); void poll(); retryTimer = setTimeout(connect, 1500); }
      }
    };
    void connect(); void poll();
    const pollingTimer = window.setInterval(() => { if (!liveRef.current) void poll(); }, 5000);
    const catchUp = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("focus", catchUp);
    return () => {
      stopped = true; liveRef.current = false;
      streamController?.abort(); pollingController.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (watchdog) clearTimeout(watchdog);
      window.clearInterval(pollingTimer);
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("focus", catchUp);
    };
  }, [conversationId, token, enabled]);

  useEffect(() => {
    if (!enabled || !open || !foreground || !conversationId || !token) return;
    const last = messages.find((item) => item.id === visibleReplyId && item.direction === "OUTBOUND" && !item.readAt);
    if (!last || ackRef.current === last.id) return;
    const unread = messages.filter((item) => item.direction === "OUTBOUND" && !item.readAt && (item.createdAt < last.createdAt || (item.createdAt === last.createdAt && item.id <= last.id)));
    ackRef.current = last.id;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const receiptController = new AbortController();
    const markRead = async () => {
      try {
        const csrfToken = await getFreshCsrfToken();
        if (cancelled || document.visibilityState !== "visible" || !document.hasFocus()) { if (ackRef.current === last.id) ackRef.current = ""; return; }
        const response = await fetch("/api/customer-chat/read", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": csrfToken, "x-chat-token": token }, body: JSON.stringify({ conversationId, messageId: last.id }), signal: receiptController.signal });
        if (!response.ok) throw new Error("Read receipt failed");
        if (!cancelled) setMessages((items) => items.map((item) => unread.some((seen) => seen.id === item.id) ? { ...item, readAt: new Date().toISOString() } : item));
      } catch {
        if (ackRef.current === last.id) ackRef.current = "";
        if (!cancelled) retryTimer = setTimeout(() => setReceiptRetry((value) => value + 1), 3000);
      }
    };
    void markRead();
    return () => { cancelled = true; receiptController.abort(); if (retryTimer) clearTimeout(retryTimer); if (ackRef.current === last.id) ackRef.current = ""; };
  }, [messages, open, foreground, enabled, conversationId, token, visibleReplyId, receiptRetry]);

  function acceptSentMessage(current: VisitorConversation, message: VisitorChatMessage) {
    setConversation(current);
    setMessages((previous) => mergeMessages(previous, [message]));
    try { window.localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Storage is optional. */ }
  }

  return { conversation, messages, syncState, acceptSentMessage, unreadCount: messages.filter((item) => item.direction === "OUTBOUND" && !item.readAt).length };
}
