"use client";

import { useMemo, useState } from "react";
import { Eye, MailCheck, MousePointerClick, Users } from "lucide-react";

import type { AnalyticsPoint, DashboardAnalyticsData } from "@/lib/analytics";

type RangeKey = "daily" | "monthly" | "yearly";
type MetricKey = "views" | "visitors" | "subscribers" | "inquiries";

const rangeLabels: Record<RangeKey, string> = {
  daily: "每日（近30天）",
  monthly: "月度（本年）",
  yearly: "年度（近5年）",
};

function chartCoordinates(data: AnalyticsPoint[], metric: MetricKey, width = 720, height = 190) {
  const values = data.map((item) => item[metric]);
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const x = data.length <= 1 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - 18 - (value / max) * (height - 38);
    return { x, y, value };
  });
}

function AxisLabels({ data }: { data: AnalyticsPoint[] }) {
  const step = Math.max(1, Math.ceil(data.length / 7));
  return <div className="analytics-axis">{data.map((point, index) => (
    (index % step === 0 || index === data.length - 1) && <span className={index === 0 ? "is-first" : index === data.length - 1 ? "is-last" : ""} key={point.key} style={{ left: `${data.length <= 1 ? 50 : (index / (data.length - 1)) * 100}%` }}>{point.label}</span>
  ))}</div>;
}

function LineChart({ data, primary, secondary, primaryLabel, secondaryLabel }: { data: AnalyticsPoint[]; primary: MetricKey; secondary?: MetricKey; primaryLabel: string; secondaryLabel?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const primaryCoordinates = useMemo(() => chartCoordinates(data, primary), [data, primary]);
  const secondaryCoordinates = useMemo(() => secondary ? chartCoordinates(data, secondary) : [], [data, secondary]);
  const primaryPoints = primaryCoordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const secondaryPoints = secondaryCoordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const current = hovered === null ? null : data[hovered];
  return <div className="analytics-chart" role="img" aria-label="真实数据库统计趋势图" onMouseLeave={() => setHovered(null)}>
    <svg viewBox="0 0 720 190" preserveAspectRatio="none">
      {[35, 75, 115, 155].map((y) => <line key={y} x1="0" x2="720" y1={y} y2={y} className="analytics-grid-line" />)}
      {secondary && <polyline points={secondaryPoints} className="analytics-line analytics-line-secondary" />}
      <polyline points={primaryPoints} className="analytics-line analytics-line-primary" />
      {primaryCoordinates.map(({ x, y }, index) => <g key={data[index].key} className="analytics-point-hit" onMouseEnter={() => setHovered(index)} onClick={() => setHovered(index)} tabIndex={0} onFocus={() => setHovered(index)}>
        {hovered === index && <line x1={x} x2={x} y1="10" y2="172" className="analytics-hover-line" />}
        <circle cx={x} cy={y} r={hovered === index ? 5 : 3} className="analytics-point analytics-point-primary" />
        {secondary && <circle cx={x} cy={secondaryCoordinates[index]?.y || y} r={hovered === index ? 5 : 3} className="analytics-point analytics-point-secondary" />}
        <circle cx={x} cy="95" r="14" className="analytics-point-target" />
      </g>)}
    </svg>
    {current && <div className="analytics-tooltip" style={{ left: `${data.length <= 1 ? 50 : (hovered! / (data.length - 1)) * 100}%` }}>
      <strong>{current.label}</strong><span><i className="blue"/>{primaryLabel}<b>{current[primary]}</b></span>{secondary && <span><i className="green"/>{secondaryLabel}<b>{current[secondary]}</b></span>}
    </div>}
    <AxisLabels data={data} />
  </div>;
}

function Bars({ data, metric }: { data: AnalyticsPoint[]; metric: MetricKey }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((item) => item[metric]));
  const step = Math.max(1, Math.ceil(data.length / 12));
  return <div className="analytics-bars" role="img" aria-label="真实数据库订阅数量柱状图">
    {data.map((point, index) => <div className={`analytics-bar-column ${hovered === index ? "is-hovered" : ""}`} key={point.key} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onClick={() => setHovered(index)} tabIndex={0} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)}>
      {hovered === index && <div className="analytics-bar-tooltip"><strong>{point.label}</strong><span>新增订阅 <b>{point[metric]}</b></span></div>}
      <div className="analytics-bar-track"><i style={{ height: `${Math.max(point[metric] ? 8 : 1, (point[metric] / max) * 100)}%` }} /></div>
      {(index % step === 0 || index === data.length - 1) && <span>{point.label}</span>}
    </div>)}
  </div>;
}

export function DashboardAnalytics({ data, showTraffic, showSubscriptions }: { data: DashboardAnalyticsData; showTraffic: boolean; showSubscriptions: boolean }) {
  const [range, setRange] = useState<RangeKey>("daily");
  const points = data[range];
  return <section className="admin-panel dashboard-analytics-panel mt-3">
    <div className="admin-panel-head analytics-panel-head">
      <div><h2>网站访问与订阅数据</h2><p>直接读取 SQLite 真实记录；访问统计仅包含同意统计 Cookie 的前台访客</p></div>
      <div className="analytics-heading-actions"><a className="analytics-detail-link" href="/admin/website-visits">查看 IP 与地区明细 →</a><div className="analytics-range-tabs">{(Object.keys(rangeLabels) as RangeKey[]).map((key) => <button type="button" className={range === key ? "active" : ""} onClick={() => setRange(key)} key={key}>{rangeLabels[key]}</button>)}</div></div>
    </div>
    <div className="analytics-summary-grid">
      <div><Eye size={18}/><span>今日浏览量<strong>{data.summary.todayViews}</strong></span></div>
      <div><Users size={18}/><span>今日访客<strong>{data.summary.todayVisitors}</strong></span></div>
      <div><MousePointerClick size={18}/><span>本月浏览量<strong>{data.summary.monthViews}</strong></span></div>
      <div><MailCheck size={18}/><span>有效订阅<strong>{data.summary.activeSubscribers}</strong></span></div>
    </div>
    <div className={`analytics-chart-grid ${showTraffic && showSubscriptions ? "" : "is-single"}`}>
      {showTraffic && <div className="analytics-chart-card">
        <div className="analytics-chart-title"><div><strong>网站访问趋势</strong><span>浏览量 PV 与独立会话 UV</span></div><div className="analytics-legend"><span><i className="blue"/>浏览量</span><span><i className="green"/>独立访客</span></div></div>
        <LineChart data={points} primary="views" secondary="visitors" primaryLabel="浏览量 PV" secondaryLabel="独立访客 UV" />
        <div className="analytics-foot-metrics"><span>本月 PV <strong>{data.summary.monthViews}</strong></span><span>本月 UV <strong>{data.summary.monthVisitors}</strong></span><span>本年 PV <strong>{data.summary.yearViews}</strong></span><span>本年 UV <strong>{data.summary.yearVisitors}</strong></span></div>
      </div>}
      {showSubscriptions && <div className="analytics-chart-card">
        <div className="analytics-chart-title"><div><strong>订阅增长趋势</strong><span>前台真实订阅提交数量</span></div><div className="analytics-total"><strong>{data.summary.totalSubscribers}</strong><span>累计订阅</span></div></div>
        <Bars data={points} metric="subscribers" />
        <div className="analytics-foot-metrics"><span>有效订阅 <strong>{data.summary.activeSubscribers}</strong></span><span>本月新增 <strong>{data.summary.monthSubscribers}</strong></span><span>本年新增 <strong>{data.summary.yearSubscribers}</strong></span></div>
      </div>}
    </div>
  </section>;
}

export function InquiryTrendChart({ data }: { data: AnalyticsPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.inquiries, 0);
  return <div className="admin-panel mini-chart inquiry-real-chart">
    <div className="admin-panel-head !border-0 !p-0"><div><h2>近30天询盘趋势</h2><p>共 {total} 条真实询盘</p></div><a className="text-xs text-brand-600" href="/admin/inquiries">查看询盘 ›</a></div>
    <LineChart data={data} primary="inquiries" primaryLabel="询盘数量" />
  </div>;
}

const sourceColors = ["#1478f3", "#39a4f5", "#ffae3b", "#29bf71", "#f45261", "#a15dee"];

export function InquirySourceChart({ sources }: { sources: { source: string; count: number }[] }) {
  const total = sources.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const segments = sources.map((item, index) => {
    const start = cursor;
    cursor += total ? (item.count / total) * 100 : 0;
    return `${sourceColors[index % sourceColors.length]} ${start}% ${cursor}%`;
  });
  const background = total ? `conic-gradient(${segments.join(",")})` : "#e7edf5";
  const labels: Record<string, string> = { website: "官网表单", google: "Google", direct: "直接访问", referral: "推荐链接", exhibition: "展会", alibaba: "Alibaba" };
  return <a href="/admin/inquiries" className="admin-panel donut-wrap admin-clickable">
    <div className="donut" style={{ background }}><strong>{total}</strong></div>
    <div><h2 className="text-sm">询盘来源分析</h2><div className="donut-legend">{sources.length ? sources.slice(0, 6).map((item, index) => <span key={item.source}><i className="dot" style={{ background: sourceColors[index % sourceColors.length] }}/>{labels[item.source.toLowerCase()] || item.source} {total ? Math.round(item.count / total * 100) : 0}%（{item.count}）</span>) : <span>暂无询盘数据</span>}</div></div>
  </a>;
}
