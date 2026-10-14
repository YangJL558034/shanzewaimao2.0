"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BellRing, Headphones, Mail, MessagesSquare, RefreshCw, Users } from "lucide-react";
import type { SupportAnalyticsData } from "@/lib/support-types";
import { chartColors, DashboardDonut, DashboardTrend } from "./DashboardCharts";

const formatCount = (value: number) => value.toLocaleString("zh-CN");
const ranges = [7, 30, 90] as const;

export function SupportDashboard({ initial }: { initial: SupportAnalyticsData | null }) {
  const [data, setData] = useState(initial);
  const [range, setRange] = useState<typeof ranges[number]>(30);
  const [error, setError] = useState(initial ? "" : "客服统计暂时未能加载，正在重试。");
  const [busy, setBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let disposed = false;
    let active: AbortController | null = null;
    async function refresh() {
      if (active || document.visibilityState === "hidden") return;
      const controller = new AbortController();
      active = controller;
      setBusy(true);
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch("/api/admin/support-analytics", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          if (!disposed) setData(null);
          throw new Error(response.status === 401 ? "登录已过期，请重新登录查看客服统计。" : "当前账号没有查看客服数据的权限。");
        }
        const payload = await response.json();
        if (!response.ok || !payload.data?.summary || !Array.isArray(payload.data.daily) || !Array.isArray(payload.data.channels)) throw new Error("客服统计更新失败，请稍后重试。");
        if (!disposed) { setData(payload.data); setError(""); }
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "更新超时，当前保留上次成功的数据。");
      } finally {
        window.clearTimeout(timeout);
        active = null;
        if (!disposed) setBusy(false);
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { disposed = true; active?.abort(); window.clearInterval(interval); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshVersion]);

  const points = useMemo(() => data?.daily.slice(-range) || [], [data, range]);
  const periodTotals = useMemo(() => points.reduce((total, point) => ({ conversations: total.conversations + point.conversations, inbound: total.inbound + point.inbound, outbound: total.outbound + point.outbound }), { conversations: 0, inbound: 0, outbound: 0 }), [points]);
  const summary = data?.summary;
  const updated = data ? new Date(data.generatedAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "尚未同步";

  return <section className="admin-panel support-dashboard dashboard-visuals" aria-labelledby="support-dashboard-title">
    <header className="support-dashboard-head">
      <div className="support-dashboard-title"><span><Headphones size={21}/></span><div><h2 id="support-dashboard-title">客服工作概览</h2><p>今日接待、未读消息与历史沟通，一处掌握</p></div></div>
      <div className="support-dashboard-actions"><span className={`support-dashboard-sync ${error ? "is-error" : ""}`}><i/>{error ? "同步异常" : "自动同步"} · {updated}</span><button type="button" className="support-dashboard-refresh" disabled={busy} onClick={() => setRefreshVersion((value) => value + 1)} aria-label="刷新客服统计"><RefreshCw size={13}/>{busy ? "更新中" : "刷新"}</button><a href="/admin/inbox" className="btn btn-primary btn-sm">进入客服中心<ArrowUpRight size={14}/></a></div>
    </header>
    {error && <div className="support-dashboard-notice" role="status">{error}{data && " 数据为上次成功同步结果。"}</div>}
    {summary ? <>
      <div className="support-dashboard-stats">
        <div className="support-dashboard-stat"><div className="support-dashboard-stat-top"><span>今日接待客户</span><Users size={18}/></div><strong>{formatCount(summary.todayCustomers)}</strong><small>今天发来消息的客户（去重）</small></div>
        <div className="support-dashboard-stat"><div className="support-dashboard-stat-top"><span>今日新会话</span><MessagesSquare size={18}/></div><strong>{formatCount(summary.todayConversations)}</strong><small>今天首次创建的客服会话</small></div>
        <div className="support-dashboard-stat"><div className="support-dashboard-stat-top"><span>今日收到消息</span><Mail size={18}/></div><strong>{formatCount(summary.todayInbound)}</strong><small>客户消息，不含销售回复</small></div>
        <a href="/admin/inbox?unread=1" className={`support-dashboard-stat is-unread ${summary.unreadMessages ? "is-attention" : ""}`} aria-label={`${summary.unreadMessages} 条未读客户消息，打开客服中心`}><div className="support-dashboard-stat-top"><span>未读客户消息</span><BellRing size={18}/></div><strong>{formatCount(summary.unreadMessages)}</strong><small>{summary.unreadMessages ? `${formatCount(summary.unreadConversations)} 个会话等待查看 →` : "当前没有未读消息"}</small></a>
      </div>
      <div className="support-dashboard-history"><span>历史累计会话<b>{formatCount(summary.totalConversations)}</b></span><span>历史接待客户<b>{formatCount(summary.totalCustomers)}</b></span><a href="/admin/inbox?status=OPEN"><i/>待处理<b>{formatCount(summary.openConversations)}</b></a><a href="/admin/inbox?status=PENDING"><i className="is-pending"/>等待客户<b>{formatCount(summary.pendingConversations)}</b></a><a href="/admin/inbox?status=RESOLVED"><i className="is-resolved"/>已解决<b>{formatCount(summary.resolvedConversations)}</b></a></div>
      <div className="support-dashboard-chart-grid">
        <section><div className="support-dashboard-chart-head"><div><h3>客户沟通趋势</h3><p>按日查看新会话、客户来信与销售回复</p></div><div className="dashboard-periods" aria-label="客服统计时间范围">{ranges.map((days) => <button type="button" key={days} aria-pressed={range === days} className={range === days ? "is-active" : ""} onClick={() => setRange(days)}>近{days}天</button>)}</div></div>
          <div className="support-dashboard-period-total"><span>新会话<b>{formatCount(periodTotals.conversations)}</b></span><span>收到消息<b>{formatCount(periodTotals.inbound)}</b></span><span>销售回复<b>{formatCount(periodTotals.outbound)}</b></span></div>
          <DashboardTrend title={`近${range}天客服历史数据`} data={points} metrics={[{ key: "conversations", label: "新会话", color: chartColors[0] }, { key: "inbound", label: "收到消息", color: chartColors[1] }, { key: "outbound", label: "销售回复", color: chartColors[2] }, { key: "customers", label: "接待客户", color: chartColors[3] }]}/>
        </section>
        <section><div className="support-dashboard-chart-head"><div><h3>客户沟通渠道</h3><p>全部历史会话 · 按来源统计</p></div></div><DashboardDonut title="历史客服渠道分布" data={data.channels.map((item) => ({ key: item.channel, label: item.label, count: item.conversations }))}/></section>
      </div>
      <p className="support-dashboard-footnote">客服统计来自 CRM 真实会话与消息；按北京时间（UTC+8）划分日期，每 15 秒自动同步。渠道未接入或没有消息时显示 0。可展开图表下方明细查看历史每日数量。</p>
    </> : <p className="dashboard-muted" role="status">{busy ? "正在加载客服数据…" : "暂无可显示的客服统计，请点击刷新重试。"}</p>}
  </section>;
}
