"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, X } from "lucide-react";

export type UnreadConversation = { id: string; contactName: string; channel: string; preview: string; lastMessageAt: string; unreadCount: number };
export type SupportSummary = { unreadMessages: number; unreadConversations: number; recent: UnreadConversation[] };
type SupportNotificationsValue = {
  enabled: boolean;
  summary: SupportSummary | null;
  loading: boolean;
  error: string;
  refresh: () => void;
  notifyRead: () => void;
  revision: number;
};

const SupportNotificationsContext = createContext<SupportNotificationsValue>({ enabled: false, summary: null, loading: false, error: "", refresh: () => {}, notifyRead: () => {}, revision: 0 });
const UPDATE_KEY = "shanze:support-read-update";
export const SUPPORT_UPDATED_EVENT = "shanze:support-updated";
export const supportChannelName: Record<string, string> = { WEBSITE: "官网聊天 / 询盘", EMAIL: "Email", WHATSAPP: "WhatsApp", LINKEDIN: "LinkedIn", CRISP: "Crisp" };
export function unreadLabel(count: number) { return count > 99 ? "99+" : String(count); }

/** One authenticated poll shared by the sidebar, notification bell and inbox. */
export function SupportNotificationsProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState<UnreadConversation | null>(null);
  const [revision, setRevision] = useState(0);
  const refreshRef = useRef<() => void>(() => {});
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback(() => refreshRef.current(), []);
  const invalidate = useCallback(() => {
    setRevision((value) => value + 1);
    refreshRef.current();
    window.dispatchEvent(new Event(SUPPORT_UPDATED_EVENT));
  }, []);
  const notifyRead = useCallback(() => {
    invalidate();
    // Only an invalidation token crosses tabs, never customer names or messages.
    const token = `${Date.now()}-${Math.random()}`;
    broadcastRef.current?.postMessage(token);
    try { window.localStorage.setItem(UPDATE_KEY, token); } catch { /* Storage may be disabled. Polling remains available. */ }
  }, [invalidate]);

  useEffect(() => {
    if (!enabled) { setLoading(false); setSummary(null); return; }
    let disposed = false;
    let busy = false;
    let queued = false;
    let accessDenied = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let previous: SupportSummary | null = null;
    const schedule = (delay: number) => { clearTimeout(timer); if (!disposed && !accessDenied) timer = setTimeout(poll, delay); };
    async function poll() {
      clearTimeout(timer);
      if (disposed || accessDenied) return;
      if (busy) { queued = true; return; }
      if (document.visibilityState !== "visible") { schedule(60_000); return; }
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15_000);
      try {
        const response = await fetch("/api/admin/inbox/summary", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) { accessDenied = true; setSummary(null); }
          throw new Error(response.status === 401 ? "登录已失效，请重新登录" : response.status === 403 ? "没有查看客服消息的权限" : payload.error || "客服消息暂时无法同步");
        }
        const data = payload.data as SupportSummary;
        if (!data || !Number.isFinite(data.unreadMessages) || !Number.isFinite(data.unreadConversations) || !Array.isArray(data.recent)) throw new Error("客服消息返回内容异常");
        if (disposed) return;
        const newlyUnread = previous && data.recent.find((item) => item.unreadCount > (previous?.recent.find((old) => old.id === item.id)?.unreadCount ?? 0));
        if (newlyUnread) {
          setAnnouncement(`收到 ${newlyUnread.contactName} 的新客服消息，共 ${data.unreadMessages} 条未读消息。`);
          setToast(newlyUnread);
        }
        previous = data;
        setSummary(data);
        setError("");
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "客服消息同步超时，正在重试");
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!disposed) {
          setLoading(false);
          schedule(queued ? 0 : 5_000);
          queued = false;
        }
      }
    }
    refreshRef.current = () => { void poll(); };
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    const onStorage = (event: StorageEvent) => { if (event.key === UPDATE_KEY) invalidate(); };
    let channel: BroadcastChannel | null = null;
    try { channel = new BroadcastChannel(UPDATE_KEY); channel.onmessage = invalidate; broadcastRef.current = channel; } catch { /* Storage event and polling cover older browsers. */ }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("storage", onStorage);
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      refreshRef.current = () => {};
      channel?.close();
      broadcastRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled, invalidate]);

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 8_000); return () => clearTimeout(timer); } }, [toast]);
  const value = useMemo(() => ({ enabled, summary, loading, error, refresh, notifyRead, revision }), [enabled, summary, loading, error, refresh, notifyRead, revision]);
  return <SupportNotificationsContext.Provider value={value}>
    {children}
    <div className="support-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {toast && enabled && <div className="support-message-toast"><MessageSquareText size={20} aria-hidden="true" /><Link href={`/admin/inbox?conversation=${encodeURIComponent(toast.id)}`} onClick={() => setToast(null)}><strong>收到新的客户消息</strong><span>{toast.contactName} · 点击查看并回复</span></Link><button type="button" aria-label="关闭新消息提示" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </SupportNotificationsContext.Provider>;
}

export function useSupportNotifications() { return useContext(SupportNotificationsContext); }
