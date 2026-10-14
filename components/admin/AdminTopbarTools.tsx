"use client";

import Link from "next/link";
import { Bell, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminNavItem } from "./AdminNavigation";
import { supportChannelName, unreadLabel, useSupportNotifications } from "./SupportNotifications";

export function AdminTopbarTools({ items }: { items: AdminNavItem[] }) {
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { enabled, summary, loading, error, refresh } = useSupportNotifications();
  const results = useMemo(
    () =>
      query.trim()
        ? items
            .filter((item) =>
              `${item.label} ${item.description}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            )
            .slice(0, 7)
        : [],
    [query, items],
  );
  const reminderItems = items.filter((item) => ["/admin/inquiries", "/admin/email-queue", "/admin/system"].includes(item.href));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); inputRef.current?.focus(); }
      if (event.key === "Escape") { setQuery(""); setNotificationsOpen(false); }
    };
    const onOutside = (event: PointerEvent) => { if (!toolsRef.current?.contains(event.target as Node)) { setNotificationsOpen(false); setQuery(""); } };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onOutside); };
  }, []);
  return (
    <div className="admin-topbar-tools" ref={toolsRef}>
      <div className="admin-command-search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索管理功能"
          aria-label="搜索后台功能"
          aria-expanded={Boolean(query.trim())}
          aria-controls="admin-command-results"
        />
        {query ? <button className="admin-search-clear" type="button" onClick={() => setQuery("")} aria-label="清除搜索"><X size={13} /></button> : <kbd>Ctrl K</kbd>}
        {query.trim() && (
          <div className="admin-command-results" id="admin-command-results">
            {results.length ? results.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setQuery("")}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </Link>
            )) : <p className="admin-search-empty">没有找到相关功能</p>}
          </div>
        )}
      </div>
      <button
        type="button"
        className="admin-top-tool icon-only"
        onClick={() => location.reload()}
        title="刷新当前后台数据"
        aria-label="刷新当前数据"
      >
        <RefreshCw size={17} />
      </button>
      <div className="admin-notifications">
        <button
          type="button"
          className="admin-top-tool icon-only"
          onClick={() => { setNotificationsOpen((open) => !open); if (!notificationsOpen) refresh(); }}
          aria-label={summary?.unreadMessages ? `客服通知，${summary.unreadMessages} 条未读消息` : error ? `客服通知，${error}` : "客服通知"}
          aria-expanded={notificationsOpen}
          aria-controls="admin-work-reminders"
        >
          <Bell size={17} />
          {Boolean(summary?.unreadMessages) && <b className="support-unread-badge support-bell-badge" aria-hidden="true">{unreadLabel(summary!.unreadMessages)}</b>}
          {error && !summary?.unreadMessages && <b className="support-bell-error" aria-hidden="true">!</b>}
        </button>
        {notificationsOpen && (
          <div className="admin-notification-panel support-notification-panel" id="admin-work-reminders">
            <div className="support-notification-head"><strong>客服消息</strong><span>{summary ? `${summary.unreadMessages} 条未读 · ${summary.unreadConversations} 个会话` : ""}</span></div>
            {enabled ? <>
              {error && <div className="support-sync-error" role="status">{error}{summary && "；当前显示上次同步结果"}<button type="button" onClick={refresh}>重试</button></div>}
              {loading && !summary && <p className="support-notification-empty">正在同步客户消息…</p>}
              {summary?.recent.map((conversation) => <Link className="support-notification-item" href={`/admin/inbox?conversation=${encodeURIComponent(conversation.id)}`} key={conversation.id} onClick={() => setNotificationsOpen(false)}><div><strong>{conversation.contactName}</strong><b className="support-unread-badge">{unreadLabel(conversation.unreadCount)}</b></div><p>{conversation.preview || "客户发来了新消息"}</p><small>{supportChannelName[conversation.channel] || conversation.channel} · {new Date(conversation.lastMessageAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></Link>)}
              {summary && !summary.unreadMessages && !error && <p className="support-notification-empty">当前没有未读客户消息</p>}
              <Link className="support-notification-all" href="/admin/inbox" onClick={() => setNotificationsOpen(false)}>进入客服中心 →</Link>
            </> : <p className="support-notification-empty">当前账号没有客服消息查看权限</p>}
            {reminderItems.length > 0 && <div className="support-reminder-shortcuts"><span>快捷处理</span>{reminderItems.map((item) => <Link href={item.href} key={item.href} onClick={() => setNotificationsOpen(false)}>{item.label}</Link>)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
