"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, MailCheck, RefreshCw, Server } from "lucide-react";
import { getFreshCsrfToken } from "@/lib/csrf-client";

type Config = { host: string; port: number; secure: boolean; user: string; from: string; notifyTo: string; passwordConfigured: boolean };

export function SmtpSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch("/api/admin/smtp", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "加载邮件配置失败");
    setConfig(data.data);
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch("/api/admin/smtp", { method: "PUT", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ host: data.get("host"), port: Number(data.get("port")), secure: data.get("secure") === "on", user: data.get("user"), password: data.get("password") || undefined, from: data.get("from"), notifyTo: data.get("notifyTo") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setMessage("邮件服务器配置已保存。客户新询盘会先入库，再发送到指定收件邮箱。");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBusy(false); }
  }
  async function testConnection() {
    setBusy(true); setError(""); setMessage("");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch("/api/admin/smtp", { method: "POST", headers: { "x-csrf-token": token } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "测试失败");
      setMessage(result.message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "测试失败"); }
    finally { setBusy(false); }
  }
  if (!config) return <section className="admin-panel p-10 text-center"><RefreshCw className="mx-auto animate-spin"/><p>正在加载邮件配置…</p>{error && <div className="form-status error">{error}</div>}</section>;
  return <section className="admin-panel smtp-settings-panel">
    <div className="admin-panel-head"><div><h2>SMTP 邮件服务器</h2><p>客户在前台提交询盘后，系统先保存到 SQLite，再通过这里的邮箱转发通知。</p></div><span className={`status-pill ${config.passwordConfigured ? "PUBLISHED" : "FAILED"}`}>{config.passwordConfigured ? "已配置授权密码" : "尚未配置"}</span></div>
    <form onSubmit={save} className="smtp-settings-form">
      {error && <div className="form-status error full">{error}</div>}{message && <div className="form-status success full"><CheckCircle2 size={15}/>{message}</div>}
      <div className="field"><label htmlFor="smtp-host">SMTP 服务器 *</label><input id="smtp-host" name="host" required defaultValue={config.host} placeholder="smtp.qq.com"/></div>
      <div className="field"><label htmlFor="smtp-port">端口 *</label><input id="smtp-port" name="port" type="number" min="1" max="65535" required defaultValue={config.port}/></div>
      <div className="field"><label htmlFor="smtp-user">SMTP 登录账号 *</label><input id="smtp-user" name="user" required defaultValue={config.user} placeholder="your-email@example.com"/></div>
      <div className="field"><label htmlFor="smtp-password">授权密码 / 应用专用密码</label><input id="smtp-password" name="password" type="password" autoComplete="new-password" placeholder={config.passwordConfigured ? "已保存；留空表示不修改" : "请输入邮箱授权码"}/></div>
      <div className="field full"><label htmlFor="smtp-from">发件人 *</label><input id="smtp-from" name="from" required defaultValue={config.from} placeholder="Website <your-email@example.com>"/></div>
      <div className="field full"><label htmlFor="smtp-notify">询盘最终收件邮箱 *</label><input id="smtp-notify" name="notifyTo" type="email" required defaultValue={config.notifyTo}/><small>客户留言的通知最终发送到这个常用邮箱。</small></div>
      <label className="cms-checkbox full"><input name="secure" type="checkbox" defaultChecked={config.secure}/><span>启用 SSL/TLS（通常端口 465 开启，587 不开启）</span></label>
      <div className="smtp-actions full"><button type="button" className="btn btn-outline" onClick={testConnection} disabled={busy}><Server size={15}/>测试服务器连接</button><button className="btn btn-primary" disabled={busy}><MailCheck size={15}/>{busy ? "处理中…" : "保存邮件配置"}</button></div>
    </form>
  </section>;
}
