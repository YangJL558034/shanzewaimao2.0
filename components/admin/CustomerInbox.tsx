"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, Mail, MessageCircleMore, MessageSquareText, RefreshCw, Send, UserRound, UsersRound } from "lucide-react";
import { getFreshCsrfToken } from "@/lib/csrf-client";
import { useSearchParams } from "next/navigation";
import { supportChannelName, unreadLabel, useSupportNotifications } from "./SupportNotifications";

type Agent = { id: string; name: string; email: string };
type Message = { id: string; content: string; direction: "INBOUND" | "OUTBOUND" | "INTERNAL"; createdAt: string; readAt?: string | null; author?: { name: string } | null };
type Conversation = { id: string; channel: "WEBSITE" | "EMAIL" | "WHATSAPP" | "LINKEDIN" | "CRISP"; status: "OPEN" | "PENDING" | "RESOLVED"; subject?: string | null; lastMessageAt: string; unreadCount: number; contact: { fullName?: string | null; companyName?: string | null; email?: string | null; phone?: string | null; country?: string | null; source: string }; assignedTo?: Agent | null; assignedToId?: string | null; messages: Message[] };

const channelName = supportChannelName;
const channelIcon = { WEBSITE: MessageSquareText, EMAIL: Mail, WHATSAPP: MessageCircleMore, LINKEDIN: UsersRound, CRISP: MessageSquareText } as const;
function stamp(value: string) { return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

export function CustomerInbox() {
  const searchParams = useSearchParams();
  const requestedConversation = searchParams.get("conversation");
  const requestedFilter = searchParams.get("unread") === "1" ? "UNREAD" : searchParams.get("status");
  const { summary: unreadSummary, error: summaryError, refresh: refreshSummary, notifyRead, revision } = useSupportNotifications();
  const [rows, setRows] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  // Visiting the inbox must not silently read the first customer's messages.
  const [selectedId, setSelectedId] = useState(requestedConversation || "");
  const [filter, setFilter] = useState(requestedFilter && ["UNREAD", "OPEN", "PENDING", "RESOLVED"].includes(requestedFilter) ? requestedFilter : "ALL");
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pages, setPages] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, hasMore: false });
  const [selectedDetail, setSelectedDetail] = useState<Conversation | null>(null);
  const [totals, setTotals] = useState({ open: 0, pending: 0, resolved: 0, channels: 0 });
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [readError, setReadError] = useState("");
  const [readRetry, setReadRetry] = useState(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const mounted = useRef(false);
  const pendingLoad = useRef<Promise<void> | null>(null);
  const pendingController = useRef<AbortController | null>(null);
  const reloadQueued = useRef(false);
  const dataVersion = useRef(0);
  const pendingReads = useRef(new Set<string>());
  const listContext = useRef({ filter, searchQuery, pages, selectedId });
  listContext.current = { filter, searchQuery, pages, selectedId };

  const load = useCallback((): Promise<void> => {
    if (pendingLoad.current) { reloadQueued.current = true; return pendingLoad.current; }
    const version = dataVersion.current;
    const controller = new AbortController();
    pendingController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const task = (async () => {
      try {
        const context = listContext.current;
        const params = new URLSearchParams({ limit: "50" });
        if (context.filter === "UNREAD") params.set("unread", "1");
        else if (["OPEN", "PENDING", "RESOLVED"].includes(context.filter)) params.set("status", context.filter);
        else if (context.filter !== "ALL") params.set("channel", context.filter);
        if (context.searchQuery.trim()) params.set("query", context.searchQuery.trim());
        if (context.selectedId) params.set("conversation", context.selectedId);
        const combined: Conversation[] = [];
        let payload;
        // Refresh every loaded page, so older rows do not keep stale unread/status values.
        for (let page = 0; page < context.pages; page++) {
          const response = await fetch(`/api/admin/inbox?${params}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
          payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "客服会话加载失败");
          if (!Array.isArray(payload.data)) throw new Error("客服会话数据异常");
          combined.push(...payload.data as Conversation[]);
          if (!payload.page?.hasMore || !payload.page.nextCursor) break;
          params.set("cursor", payload.page.nextCursor);
        }
        if (!mounted.current) return;
        // An earlier list request must not restore unread flags after a read acknowledgement.
        if (version !== dataVersion.current) { reloadQueued.current = true; return; }
        setRows(Array.from(new Map(combined.map((row) => [row.id, row])).values()));
        setAgents(payload.agents as Agent[]);
        setPageInfo({ total: payload.page.total, hasMore: payload.page.hasMore });
        setSelectedDetail(payload.selectedConversation as Conversation | null);
        setTotals(payload.totals);
        setLoadError("");
      } catch (error) {
        if (mounted.current) setLoadError(error instanceof Error && error.name !== "AbortError" ? error.message : "会话同步超时，正在重试");
      } finally {
        clearTimeout(timeout);
        pendingLoad.current = null;
        pendingController.current = null;
        if (mounted.current) {
          setLoading(false);
          if (reloadQueued.current) { reloadQueued.current = false; void load(); }
        }
      }
    })();
    pendingLoad.current = task;
    return task;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    let pollVersion = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const version = ++pollVersion;
      if (document.visibilityState === "visible") await load();
      if (!stopped && version === pollVersion) timer = setTimeout(poll, document.visibilityState === "visible" ? 5_000 : 60_000);
    }
    const onVisible = () => { if (document.visibilityState === "visible") { clearTimeout(timer); void poll(); } };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    void poll();
    return () => { mounted.current = false; stopped = true; clearTimeout(timer); pendingController.current?.abort(); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [load]);
  useEffect(() => { if (revision) void load(); }, [revision, load]);
  useEffect(() => {
    if (query === searchQuery) return;
    const timer = setTimeout(() => { setSearchQuery(query); setPages(1); }, 250);
    return () => clearTimeout(timer);
  }, [query, searchQuery]);
  useEffect(() => { dataVersion.current += 1; setLoading(true); void load(); }, [filter, searchQuery, pages, selectedId, load]);
  useEffect(() => { if (requestedConversation) setSelectedId(requestedConversation); }, [requestedConversation]);
  useEffect(() => { if (requestedFilter && ["UNREAD", "OPEN", "PENDING", "RESOLVED"].includes(requestedFilter)) { setFilter(requestedFilter); setPages(1); } }, [requestedFilter]);
  useEffect(() => { setReply(""); setReadError(""); }, [selectedId]);

  const visible = useMemo(() => rows.filter((item) => {
    const text = `${item.contact.fullName || ""} ${item.contact.companyName || ""} ${item.contact.email || ""} ${item.subject || ""}`.toLowerCase();
    return (filter === "ALL" || (filter === "UNREAD" && item.unreadCount > 0) || item.status === filter || item.channel === filter) && text.includes(query.trim().toLowerCase());
  }), [rows, filter, query]);
  const selected = rows.find((item) => item.id === selectedId) || (selectedDetail?.id === selectedId ? selectedDetail : undefined);
  const summary = totals;
  const unreadSignature = selected?.messages.filter((message) => message.direction === "INBOUND" && !message.readAt).map((message) => message.id).join(",") || "";

  useEffect(() => {
    const container = messagesRef.current;
    if (!selectedId || !container || !unreadSignature) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const conversationId = selectedId;
    const unreadIds = new Set(unreadSignature.split(","));
    const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]")).filter((element) => unreadIds.has(element.dataset.messageId || ""));
    function isVisible(element: HTMLElement) {
      if (document.visibilityState !== "visible" || selectedIdRef.current !== conversationId || !element.isConnected) return false;
      const rect = element.getBoundingClientRect();
      const clip = container!.getBoundingClientRect();
      return Math.min(rect.bottom, clip.bottom, window.innerHeight) - Math.max(rect.top, clip.top, 0) >= Math.min(20, rect.height) && Math.min(rect.right, clip.right, window.innerWidth) > Math.max(rect.left, clip.left, 0);
    }
    async function acknowledge() {
      if (disposed) return;
      const candidates = elements.filter((element) => isVisible(element) && !pendingReads.current.has(element.dataset.messageId!));
      if (!candidates.length) return;
      const ids = candidates.map((element) => element.dataset.messageId!);
      ids.forEach((id) => pendingReads.current.add(id));
      try {
        const token = await getFreshCsrfToken();
        // CSRF refresh is asynchronous: verify selection and visibility again before writing.
        const messageIds = candidates.filter(isVisible).map((element) => element.dataset.messageId!);
        if (disposed || !messageIds.length) return;
        const response = await fetch(`/api/admin/inbox/${encodeURIComponent(conversationId)}/read`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ messageIds }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "未读状态更新失败");
        if (!mounted.current) return;
        dataVersion.current += 1;
        const readAt = payload.data.readAt as string;
        const acknowledged = new Set(messageIds);
        setRows((current) => current.map((item) => item.id === conversationId ? { ...item, unreadCount: payload.data.unreadCount, messages: item.messages.map((message) => acknowledged.has(message.id) ? { ...message, readAt } : message) } : item));
        setSelectedDetail((item) => item?.id === conversationId ? { ...item, unreadCount: payload.data.unreadCount, messages: item.messages.map((message) => acknowledged.has(message.id) ? { ...message, readAt } : message) } : item);
        setReadError("");
        notifyRead();
      } catch (error) {
        if (mounted.current && selectedIdRef.current === conversationId) setReadError(error instanceof Error ? error.message : "未读状态更新失败");
      } finally { ids.forEach((id) => pendingReads.current.delete(id)); }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void acknowledge(), 350); };
    // A viewport observer accounts for both the chat scroller and the page viewport on mobile.
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(schedule, { threshold: [0, 0.25, 1] }) : null;
    elements.forEach((element) => observer?.observe(element));
    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => { disposed = true; clearTimeout(timer); observer?.disconnect(); container.removeEventListener("scroll", schedule); window.removeEventListener("scroll", schedule); document.removeEventListener("visibilitychange", schedule); };
  }, [selectedId, unreadSignature, notifyRead, readRetry]);

  async function update(data: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true); setNotice("");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch(`/api/admin/inbox?id=${selected.id}`, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify(data) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "更新失败"); await load(); refreshSummary();
    } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); } finally { setBusy(false); }
  }
  async function send() {
    if (!selected || !reply.trim()) return;
    const conversationId = selected.id;
    setBusy(true); setNotice("");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch(`/api/admin/inbox/${conversationId}/messages`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ content: reply }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "回复保存失败");
      if (selectedIdRef.current === conversationId) setReply("");
      if (payload.whatsappUrl) { window.open(payload.whatsappUrl, "_blank", "noopener,noreferrer"); setNotice("回复已保存；已打开 WhatsApp 以发送给客户。"); }
      else setNotice(payload.delivery === "website_available" ? "回复已同步到官网聊天窗，邮件副本已进入发送队列。" : payload.delivery === "email_queued" ? "邮件已进入发送队列。" : payload.delivery === "crisp_sent" ? "回复已通过 Crisp 发送。" : payload.delivery === "whatsapp_sent" ? "回复已通过 WhatsApp Business 发送。" : payload.transportError ? `回复已保存，但渠道发送失败：${payload.transportError}` : "回复已保存。请在已接入的渠道工作台中完成外发。");
      await load(); refreshSummary();
    } catch (error) { setNotice(error instanceof Error ? error.message : "回复保存失败"); } finally { setBusy(false); }
  }

  return <div className="inbox-workspace">
    <div className="crm-summary-grid inbox-summary">
      <div className="admin-panel inbox-unread-summary"><Bell/><span>未读客户消息<strong>{unreadSummary ? unreadSummary.unreadMessages : "—"}</strong><small>{unreadSummary ? `${unreadSummary.unreadConversations} 个会话待查看` : "正在同步"}</small></span></div><div className="admin-panel"><MessageSquareText/><span>待处理<strong>{summary.open}</strong><small>{summary.channels} 个活跃渠道</small></span></div><div className="admin-panel"><Send/><span>等待客户<strong>{summary.pending}</strong></span></div><div className="admin-panel is-success"><CheckCircle2/><span>已解决<strong>{summary.resolved}</strong></span></div>
    </div>
    <section className="admin-panel inbox-panel">
      <header className="admin-panel-head"><div><h2>统一客服中心</h2><p>官网表单、邮件、WhatsApp、LinkedIn 与 Crisp 会话归档；未读按团队共享，查看后同步更新。</p></div><button className="icon-btn" onClick={() => { setLoading(true); void load(); refreshSummary(); }} aria-label="刷新会话"><RefreshCw className={loading ? "animate-spin" : ""} size={16}/></button></header>
      <div className="inbox-toolbar"><input aria-label="搜索客服会话" maxLength={160} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户、公司、邮箱或主题"/><button className={`inbox-unread-filter ${filter === "UNREAD" ? "is-active" : ""}`} type="button" aria-pressed={filter === "UNREAD"} onClick={() => { setFilter(filter === "UNREAD" ? "ALL" : "UNREAD"); setPages(1); }}><Bell size={14}/>仅看未读{unreadSummary && unreadSummary.unreadConversations > 0 && <b>{unreadLabel(unreadSummary.unreadConversations)}</b>}</button><select aria-label="筛选客服会话" value={filter} onChange={(event) => { setFilter(event.target.value); setPages(1); }}><option value="ALL">全部会话</option><option value="UNREAD">未读会话</option><option value="OPEN">待处理</option><option value="PENDING">等待客户</option><option value="RESOLVED">已解决</option>{Object.entries(channelName).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      {(loadError || summaryError) && <div className="inbox-notice support-sync-error" role="status">{loadError || summaryError}；同步恢复前请勿将当前数量当作最新结果。<button type="button" onClick={() => { void load(); refreshSummary(); }}>重试</button></div>}
      {notice && <div className="inbox-notice" role="status">{notice}</div>}
      <div className="inbox-grid">
        <aside className="inbox-list" aria-label="客户会话">{visible.length ? visible.map((item) => { const Icon = channelIcon[item.channel]; const last = item.messages[item.messages.length - 1]; return <button className={`inbox-row ${selected?.id === item.id ? "active" : ""} ${item.unreadCount > 0 ? "has-unread" : ""}`} key={item.id} aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}><span className={`inbox-channel ${item.channel.toLowerCase()}`}><Icon size={15}/></span><span><strong>{item.contact.companyName || item.contact.fullName || "Unknown visitor"}</strong><small>{channelName[item.channel]} · {stamp(item.lastMessageAt)}</small><em>{last?.content || item.subject || "暂无消息"}</em></span><span className="inbox-row-meta">{item.unreadCount > 0 && <b className="support-unread-badge" aria-label={`${item.unreadCount} 条未读消息`}>{unreadLabel(item.unreadCount)}</b>}<i className={`status-dot ${item.status.toLowerCase()}`} title={item.status === "OPEN" ? "待处理" : item.status === "PENDING" ? "等待客户" : "已解决"}/></span></button>; }) : <p className="inbox-empty">{loading ? "正在加载会话…" : filter === "UNREAD" ? "当前列表没有未读会话" : "暂无匹配会话"}</p>}<div className="inbox-pagination"><span>已显示 {visible.length} / {pageInfo.total} 个会话</span>{pageInfo.hasMore && <button className="inbox-load-more" type="button" disabled={loading} onClick={() => setPages((value) => value + 1)}>{loading ? "加载中…" : "加载更多会话"}</button>}</div></aside>
        <main className="inbox-thread">{selected ? <><header className="inbox-thread-head"><div><span className={`inbox-channel ${selected.channel.toLowerCase()}`}>{channelName[selected.channel]}</span><h3>{selected.contact.fullName || selected.contact.companyName || "Unknown visitor"}</h3><p>{selected.contact.companyName || "—"} · {selected.contact.country || "Unknown location"}</p></div><div className="inbox-selects"><select aria-label="会话跟进状态" value={selected.status} disabled={busy} onChange={(event) => update({ status: event.target.value })}><option value="OPEN">待处理</option><option value="PENDING">等待客户</option><option value="RESOLVED">已解决</option></select><select aria-label="分配销售" value={selected.assignedToId || ""} disabled={busy} onChange={(event) => update({ assignedToId: event.target.value || null })}><option value="">未分配</option>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></div></header>
          <div className="inbox-customer"><UserRound size={15}/><span>{selected.contact.email || "未提供邮箱"}</span><span>{selected.contact.phone || "未提供电话"}</span>{selected.subject && <strong>{selected.subject}</strong>}</div>
          <div className="inbox-messages" ref={messagesRef} aria-label="聊天记录">{readError && <div className="support-sync-error" role="status">{readError}<button type="button" onClick={() => setReadRetry((value) => value + 1)}>重试标记已读</button></div>}{selected.messages.map((message) => <article className={`inbox-message ${message.direction.toLowerCase()}`} data-message-id={message.id} key={message.id}><small>{message.direction === "INBOUND" ? "客户" : message.author?.name || "销售"} · {stamp(message.createdAt)}{message.direction === "INBOUND" && !message.readAt && <span className="inbox-message-unread"> · 未读</span>}{message.direction === "OUTBOUND" && selected.channel === "WEBSITE" && <span> · {message.readAt ? "客户已读" : "已发送，等待客户阅读"}</span>}</small><p>{message.content}</p></article>)}</div>
          <footer className="inbox-reply"><textarea aria-label="回复客户消息" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} placeholder={selected.channel === "WHATSAPP" ? "保存回复后将打开 WhatsApp 发送" : "输入回复内容…"}/><button className="btn btn-primary" disabled={busy || !reply.trim()} onClick={send}><Send size={15}/>{busy ? "发送中…" : "发送回复"}</button></footer>
        </> : <div className="inbox-empty inbox-select-placeholder"><MessageSquareText size={36}/><strong>选择一条客户会话</strong><span>未读消息会保留提醒；打开会话并查看消息后自动标记已读。</span></div>}</main>
      </div>
    </section>
  </div>;
}
