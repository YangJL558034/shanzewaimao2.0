"use client";
import { FormEvent, useEffect, useState } from "react";
import { getFreshCsrfToken } from "@/lib/csrf-client";
import Link from "next/link";

const initial = { whatsappNumber: "", linkedinUrl: "", supportEmail: "", catalogUrl: "/contact#quote", welcomeMessage: "", adminNotificationEmail: "", salesNotificationEmails: "" };

export function CustomerChannelSettings() {
  const [data, setData] = useState(initial);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  useEffect(() => {
    fetch("/api/admin/customer-channels", { credentials: "same-origin" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "渠道配置加载失败");
      setData({ ...initial, ...payload.data });
      setSmtpConfigured(payload.smtpConfigured === true);
      setLoaded(true);
    }).catch((error) => setNotice(error.message || "渠道配置加载失败"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch("/api/admin/customer-channels", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify(data) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败");
      setNotice("客服渠道与邮件通知收件人已保存。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  }

  const field = (key: keyof typeof data, label: string, type = "text") => <label className="field"><span>{label}</span><input type={type} value={data[key]} onChange={(event) => setData({ ...data, [key]: event.target.value })}/></label>;
  return <section className="admin-panel p-5">
    <div className="admin-panel-head -m-5 mb-5"><div><h2>前台客服渠道</h2><p>网站 Live Chat 消息进入 CRM，并自动通知管理员和销售。</p></div></div>
    {loaded && <p className="mb-5 rounded border p-3 text-sm">{smtpConfigured ? "SMTP 已配置，请通过 SMTP 设置中的测试邮件确认投递。" : "SMTP 尚未配置完整，聊天通知将保存在邮件队列中，配置发信账号后才能投递。"} <Link className="text-link" href="/admin/smtp">配置发信账号 →</Link></p>}
    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit}>
      {field("whatsappNumber", "WhatsApp Business 号码")}
      {field("linkedinUrl", "LinkedIn 链接", "url")}
      {field("supportEmail", "前台客服邮箱", "email")}
      {field("catalogUrl", "Catalog 下载 / 索取链接")}
      {field("adminNotificationEmail", "管理员通知邮箱", "email")}
      {field("salesNotificationEmails", "销售通知邮箱（多个地址用逗号分隔）")}
      <p className="muted text-xs md:col-span-2">客户每次发送聊天消息都会生成邮件通知，包含客户信息、消息和 CRM 会话链接。通知邮箱仅后台可见；同一地址不会重复发送。</p>
      <label className="field md:col-span-2"><span>Live Chat 欢迎语</span><textarea rows={9} value={data.welcomeMessage} onChange={(event) => setData({ ...data, welcomeMessage: event.target.value })}/></label>
      {notice && <div className="form-status md:col-span-2" role="status">{notice}</div>}
      <div className="md:col-span-2"><button className="btn btn-primary" disabled={busy || !loaded}>{busy ? "正在保存…" : "保存客服渠道配置"}</button></div>
    </form>
  </section>;
}
