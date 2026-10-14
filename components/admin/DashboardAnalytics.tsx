"use client";

import { useState } from "react";
import { Eye, MailCheck, MousePointerClick, Users } from "lucide-react";
import type { AnalyticsPoint, DashboardAnalyticsData } from "@/lib/analytics";
import { chartColors, DashboardDonut, DashboardTrend } from "./DashboardCharts";

type RangeKey = "daily" | "monthly" | "yearly";
const rangeLabels: Record<RangeKey, string> = { daily: "近30天", monthly: "本年按月", yearly: "近5年" };

export function DashboardAnalytics({ data, showTraffic, showSubscriptions }: { data: DashboardAnalyticsData; showTraffic: boolean; showSubscriptions: boolean }) {
  const [range, setRange] = useState<RangeKey>("daily");
  const points = data[range];
  return <section className="admin-panel dashboard-analytics-panel dashboard-visuals mt-3">
    <div className="admin-panel-head analytics-panel-head">
      <div><h2>网站访问与订阅</h2><p>真实访问与订阅记录 · 访问统计仅包含同意统计 Cookie 的访客</p></div>
      <div className="analytics-heading-actions"><a className="analytics-detail-link" href="/admin/website-visits">查看访问明细 →</a><div className="dashboard-periods" aria-label="网站统计时间范围">{(Object.keys(rangeLabels) as RangeKey[]).map((key) => <button type="button" aria-pressed={range === key} className={range === key ? "is-active" : ""} onClick={() => setRange(key)} key={key}>{rangeLabels[key]}</button>)}</div></div>
    </div>
    <div className="analytics-summary-grid">
      <div><Eye size={18}/><span>今日浏览量<strong>{data.summary.todayViews}</strong></span></div>
      <div><Users size={18}/><span>今日访客<strong>{data.summary.todayVisitors}</strong></span></div>
      <div><MousePointerClick size={18}/><span>本月浏览量<strong>{data.summary.monthViews}</strong></span></div>
      <div><MailCheck size={18}/><span>有效订阅<strong>{data.summary.activeSubscribers}</strong></span></div>
    </div>
    <div className={`analytics-chart-grid ${showTraffic && showSubscriptions ? "" : "is-single"}`}>
      {showTraffic && <div className="analytics-chart-card">
        <div className="analytics-chart-title"><div><strong>网站访问趋势</strong><span>浏览量 PV 与独立会话 UV · 同一数值坐标</span></div></div>
        <DashboardTrend title="网站访问趋势" data={points} metrics={[{ key: "views", label: "浏览量 PV", color: chartColors[0] }, { key: "visitors", label: "独立访客 UV", color: chartColors[1] }]}/>
        <div className="analytics-foot-metrics"><span>本月 PV <strong>{data.summary.monthViews}</strong></span><span>本月 UV <strong>{data.summary.monthVisitors}</strong></span><span>本年 PV <strong>{data.summary.yearViews}</strong></span><span>本年 UV <strong>{data.summary.yearVisitors}</strong></span></div>
      </div>}
      {showSubscriptions && <div className="analytics-chart-card">
        <div className="analytics-chart-title"><div><strong>订阅增长趋势</strong><span>新增订阅数量 · 零值如实显示</span></div><div className="analytics-total"><strong>{data.summary.totalSubscribers}</strong><span>累计订阅</span></div></div>
        <DashboardTrend title="订阅增长趋势" data={points} bars metrics={[{ key: "subscribers", label: "新增订阅", color: chartColors[2] }]}/>
        <div className="analytics-foot-metrics"><span>有效订阅 <strong>{data.summary.activeSubscribers}</strong></span><span>本月新增 <strong>{data.summary.monthSubscribers}</strong></span><span>本年新增 <strong>{data.summary.yearSubscribers}</strong></span></div>
      </div>}
    </div>
  </section>;
}

export function InquiryTrendChart({ data }: { data: AnalyticsPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.inquiries, 0);
  return <section className="admin-panel dashboard-small-panel dashboard-visuals">
    <div className="dashboard-small-head"><div><h2>近30天询盘趋势</h2><p>共 {total} 条询盘</p></div><a href="/admin/inquiries">查看询盘 →</a></div>
    <DashboardTrend title="近30天询盘趋势" data={data} compact metrics={[{ key: "inquiries", label: "新增询盘", color: chartColors[0] }]}/>
  </section>;
}

export function InquirySourceChart({ sources }: { sources: { source: string; count: number }[] }) {
  const labels: Record<string, string> = { website: "官网表单", live_chat: "官网在线客服", whatsapp: "WhatsApp", linkedin: "LinkedIn", email: "Email", crisp: "Crisp", google: "Google", direct: "直接访问", referral: "推荐链接", exhibition: "展会", alibaba: "Alibaba" };
  return <section className="admin-panel dashboard-small-panel dashboard-visuals"><div className="dashboard-small-head"><div><h2>询盘来源</h2><p>全部历史询盘</p></div><a href="/admin/inquiries">查看全部 →</a></div><DashboardDonut title="询盘来源分布" data={sources.map((item) => ({ key: item.source, label: labels[item.source.toLowerCase()] || item.source || "未标注", count: item.count }))}/></section>;
}
