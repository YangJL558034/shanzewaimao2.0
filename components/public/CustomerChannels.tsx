"use client";

import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";
import { GripHorizontal, Linkedin, Mail, MessageCircleMore, Minus, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { getFreshCsrfToken } from "@/lib/csrf-client";
import { createChatSessionId } from "@/lib/chat-session-id";
import type { CustomerChannelConfig } from "@/lib/customer-channel-settings";
import { useCustomerChat } from "./useCustomerChat";
import { useSupportPosition } from "./useSupportPosition";
import { trackPublicEvent } from "@/lib/analytics-client";
import "./customer-support.css";

const crispId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

export function CustomerChannels({ config, locale = "en" }: { config: CustomerChannelConfig; locale?: string }) {
  const pathname = usePathname();
  const zh = locale === "zh";
  const copy = zh ? {
    error: "暂时无法发送消息，请重试。", sent: "消息已发送，客服回复会显示在这里。", liveSupport: "在线客户支持", live: "已连接 · 实时回复", polling: "已连接 · 正在同步消息", connecting: "正在连接…", reconnecting: "正在重新连接…", channels: "客户联系渠道", liveChat: "在线聊天", replies: "有新回复", online: "我们在线", whatsapp: "与我们聊天", linkedin: "关注我们", email: "电子邮件", emailMessage: "给我们留言", expand: "展开联系渠道", collapse: "收起联系渠道", consultation: "在线咨询", minimize: "最小化在线咨询", close: "关闭客服，刷新页面后恢复", move: "拖动调整客服位置，松手后靠右；可用上下方向键移动", support: "客户服务", chatMessages: "聊天消息", sales: "Shanze 销售", you: "您", sentStatus: "已发送", loading: "正在加载聊天记录…", start: "发送消息开始沟通，客服回复会显示在此窗口。", name: "姓名", namePlaceholder: "您的姓名", businessEmail: "工作邮箱", optionalDetails: "公司和电话（选填）", company: "公司", companyPlaceholder: "公司名称", phone: "WhatsApp / 电话", optional: "选填", message: "消息", messagePlaceholder: "请输入消息…", sending: "正在发送…", send: "发送", sendLabel: "发送消息", sendingLabel: "正在发送消息",
  } : {
    error: "Unable to send your message. Please try again.", sent: "Message sent. Our reply will appear here.", liveSupport: "Live customer support", live: "Connected · live replies", polling: "Connected · syncing messages", connecting: "Connecting…", reconnecting: "Reconnecting…", channels: "Customer contact channels", liveChat: "Live Chat", replies: "New replies", online: "We're online", whatsapp: "Chat with us", linkedin: "Follow us", email: "Email", emailMessage: "Send us a message", expand: "Open contact channels", collapse: "Close contact channels", consultation: "Online consultation", minimize: "Minimize online consultation", close: "Close support until page refresh", move: "Drag to move support; release to dock right. Up/down arrows move vertically.", support: "Customer support", chatMessages: "Chat messages", sales: "Shanze sales", you: "You", sentStatus: "Sent", loading: "Loading your conversation…", start: "Start a conversation. Our team's replies will appear in this window.", name: "Name", namePlaceholder: "Your name", businessEmail: "Business email", optionalDetails: "Company & phone (optional)", company: "Company", companyPlaceholder: "Company name", phone: "WhatsApp / phone", optional: "Optional", message: "Message", messagePlaceholder: "Type a message…", sending: "Sending…", send: "Send", sendLabel: "Send message", sendingLabel: "Sending message",
  };
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [visibleReplyId, setVisibleReplyId] = useState("");
  const disabled = dismissed || pathname.startsWith("/admin");
  const { conversation, messages, unreadCount, syncState, acceptSentMessage } = useCustomerChat(open && !dismissed, !disabled, visibleReplyId);
  const historyRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);
  const whatsapp = config.whatsappNumber.replace(/\D/g, "");
  const linkedin = config.linkedinUrl;
  const emailHref = `mailto:${config.supportEmail}`;

  const lastMessageId = messages.at(-1)?.id;
  const latestReply = messages.findLast((message) => message.direction === "OUTBOUND");
  const position = useSupportPosition(supportRef, { disabled, open, expanded: menuExpanded, replyKey: latestReply?.id });
  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [lastMessageId, open]);
  useEffect(() => { if (latestReply) setNotice(""); }, [latestReply?.id]);
  useEffect(() => {
    const body = historyRef.current;
    if (!open || !body) { setVisibleReplyId(""); return; }
    if (!("IntersectionObserver" in window)) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (!id) continue;
        if (entry.isIntersecting) visible.add(id); else visible.delete(id);
      }
      setVisibleReplyId(messages.filter((message) => message.direction === "OUTBOUND" && visible.has(message.id)).at(-1)?.id || "");
    }, { root: body, threshold: 0 });
    body.querySelectorAll(".customer-chat-message.sales").forEach((message) => observer.observe(message));
    return () => observer.disconnect();
  }, [messages, open]);
  if (disabled) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const message = String(form.get("message") || "");
    setBusy(true); setNotice("");
    try {
      const csrfToken = await getFreshCsrfToken();
      const sessionId = conversation?.sessionId || createChatSessionId();
      const response = await fetch("/api/customer-chat", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ ...Object.fromEntries(form), sessionId, token: conversation?.token }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || copy.error);
      trackPublicEvent(conversation ? "chat_message_sent" : "chat_started", "live_chat");
      if (!conversation) trackPublicEvent("generate_lead", "live_chat");
      const currentConversation = { conversationId: payload.conversationId, token: payload.token, sessionId };
      acceptSentMessage(currentConversation, payload.message || { id: `pending-${Date.now()}`, direction: "INBOUND", content: message, createdAt: new Date().toISOString() });
      setDraft("");
      setNotice("sent");
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.error); }
    finally { setBusy(false); }
  }

  const openChat = () => { setOpen(true); setMenuExpanded(false); };
  const closeSupport = () => { setDismissed(true); setOpen(false); setMenuExpanded(false); };
  const syncLabel = !conversation ? copy.liveSupport : syncState === "live" ? copy.live : syncState === "polling" ? copy.polling : syncState === "connecting" ? copy.connecting : copy.reconnecting;

  return <>
    {crispId && <Script id="crisp-chat" strategy="afterInteractive">{`window.$crisp=[];window.CRISP_WEBSITE_ID=${JSON.stringify(crispId)};(function(){var d=document,s=d.createElement('script');s.src='https://client.crisp.chat/l.js';s.async=1;d.getElementsByTagName('head')[0].appendChild(s)})();`}</Script>}
    <div ref={supportRef} className={`customer-support ${open ? "chat-open" : ""} ${position.dragging ? "is-position-dragging" : ""}`} onPointerDown={position.onPointerDown} onPointerMove={position.onPointerMove} onPointerUp={position.onPointerEnd} onPointerCancel={position.onPointerEnd} onLostPointerCapture={position.onPointerCaptureLost} onClickCapture={position.onClickCapture} onDragStart={(event) => { if (!(event.target as HTMLElement).closest("input, textarea")) event.preventDefault(); }} onClick={(event) => {
      const link = (event.target as Element).closest("a");
      if (!link) return;
      if (link.href.includes("wa.me/")) trackPublicEvent("contact_click", "whatsapp");
      else if (link.href.includes("linkedin.com")) trackPublicEvent("contact_click", "linkedin");
      else if (link.href.startsWith("mailto:")) trackPublicEvent("contact_click", "email");
    }}>
      <div className="customer-support-toolbar"><button type="button" className="customer-support-drag-handle" aria-label={copy.move} title={copy.move} onKeyDown={position.onHandleKeyDown}><GripHorizontal size={18}/><span>{copy.support}</span></button><button type="button" className="customer-support-close" data-support-position-exclude onClick={closeSupport} aria-label={copy.close} title={copy.close}><X size={16}/></button></div>
      {!open && unreadCount > 0 && latestReply && <button type="button" className="customer-reply-alert" onClick={openChat} aria-label={zh ? `查看 ${unreadCount} 条客服新回复` : `Read ${unreadCount} new support replies`}><strong>{zh ? `${latestReply.authorName || "Shanze"} 的新回复` : `New reply from ${latestReply.authorName || "Shanze"}`}</strong><span>{latestReply.content}</span></button>}
      {!open && <nav className={`customer-channel-menu ${menuExpanded ? "expanded" : ""}`} aria-label={copy.channels}>
        <button className="customer-channel-item live" type="button" onClick={openChat}><MessageCircleMore size={25}/><span><strong>{copy.liveChat}</strong><small>{unreadCount > 0 ? copy.replies : copy.online}</small></span>{unreadCount > 0 && <span className="customer-unread-badge">{unreadCount}</span>}</button>
        <a className="customer-channel-item whatsapp" href={whatsapp ? `https://wa.me/${whatsapp}` : "/contact#quote"} target={whatsapp ? "_blank" : undefined} rel={whatsapp ? "noreferrer" : undefined}><MessageCircleMore size={25}/><span><strong>WhatsApp</strong><small>{copy.whatsapp}</small></span></a>
        <a className="customer-channel-item linkedin" href={linkedin || "/contact#quote"} target={linkedin ? "_blank" : undefined} rel={linkedin ? "noreferrer" : undefined}><Linkedin size={25}/><span><strong>LinkedIn</strong><small>{copy.linkedin}</small></span></a>
        <a className="customer-channel-item email" href={emailHref}><Mail size={25}/><span><strong>{copy.email}</strong><small>{copy.emailMessage}</small></span></a>
      </nav>}
      {!open && <button className="customer-mobile-launcher" type="button" data-support-position-exclude onClick={() => setMenuExpanded((value) => !value)} aria-label={menuExpanded ? copy.collapse : unreadCount ? zh ? `${unreadCount} 条客服未读回复，展开联系渠道` : `${unreadCount} unread support replies — open contact channels` : copy.expand} aria-expanded={menuExpanded}>{menuExpanded ? <X size={23}/> : <MessageCircleMore size={24}/>} {unreadCount > 0 && <span className="customer-unread-badge">{unreadCount}</span>}</button>}
      {open && <section className="customer-chat-panel" role="dialog" aria-label={copy.consultation}>
        <header><div className="customer-chat-brand"><b>S</b><span><strong>Shanze</strong><small className={`customer-chat-sync ${syncState}`}><i/>{syncLabel}</small></span></div><button type="button" className="customer-chat-minimize" data-support-position-exclude onClick={() => setOpen(false)} aria-label={copy.minimize}><Minus size={18}/></button></header>
        <form className="customer-chat-form" onSubmit={submit}>
          <div className="customer-chat-body" ref={historyRef}>
          {!conversation && <div className="customer-chat-welcome">{config.welcomeMessage.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line || " "}</p>)}</div>}
          {messages.length > 0 && <div className="customer-chat-history" role="log" aria-label={copy.chatMessages} aria-live="polite">{messages.map((message) => <article data-message-id={message.id} className={`customer-chat-message ${message.direction === "OUTBOUND" ? "sales" : "visitor"}`} key={message.id}><small>{message.direction === "OUTBOUND" ? message.authorName || copy.sales : copy.you}</small><p>{message.content}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString(zh ? "zh-CN" : "en", { hour: "2-digit", minute: "2-digit" })}{message.direction === "INBOUND" ? ` · ${copy.sentStatus}` : ""}</time></article>)}</div>}
          {conversation && messages.length === 0 && <p className="customer-chat-empty" role="status">{copy.loading}</p>}
          {!conversation && <div className="customer-chat-start"><p>{copy.start}</p><div className="customer-chat-grid"><label>{copy.name}<input name="fullName" required minLength={2} maxLength={100} autoComplete="name" placeholder={copy.namePlaceholder}/></label><label>{copy.businessEmail}<input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="name@company.com"/></label></div>
          <details className="customer-chat-optional"><summary>{copy.optionalDetails}</summary><div className="customer-chat-grid"><label>{copy.company}<input name="companyName" maxLength={150} autoComplete="organization" placeholder={copy.companyPlaceholder}/></label><label>{copy.phone}<input name="phone" maxLength={50} autoComplete="tel" placeholder={copy.optional}/></label></div></details></div>}
          </div>
          {notice && <div className="customer-chat-notice">{notice === "sent" ? copy.sent : notice}</div>}
          <div className="customer-chat-compose"><textarea name="message" aria-label={copy.message} value={draft} onChange={(event) => setDraft(event.target.value)} required minLength={1} maxLength={5000} placeholder={copy.messagePlaceholder} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) event.currentTarget.form?.requestSubmit(); } }}/><button className="customer-chat-submit" disabled={busy || !draft.trim()} type="submit" aria-label={busy ? copy.sendingLabel : copy.sendLabel}><Send size={16}/><span>{busy ? copy.sending : copy.send}</span></button></div>
        </form>
        {(whatsapp || linkedin) && <footer>{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircleMore size={15}/>WhatsApp</a>}{linkedin && <a href={linkedin} target="_blank" rel="noreferrer"><Linkedin size={15}/>LinkedIn</a>}</footer>}
      </section>}
    </div>
  </>;
}
