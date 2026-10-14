"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./dashboard-visuals.css";

export const chartColors = ["#2563eb", "#10a58a", "#8b5cf6", "#f59e0b", "#ef6471", "#0891b2"];
type ChartPoint = { key: string; label: string; [key: string]: string | number };
type ChartMetric = { key: string; label: string; color: string };
const tooltipStyle = { border: "1px solid #e1e8f2", borderRadius: 10, boxShadow: "0 8px 28px #102f5414", fontSize: 12, padding: "10px 14px" };
const axisStyle = { fill: "#8391a5", fontSize: 10 };
const integerDomain: [number, (maximum: number) => number] = [0, (maximum) => Math.max(1, maximum)];

/** Recharts uses one shared numeric axis: series remain directly comparable. */
export function DashboardTrend({ data, metrics, bars = false, compact = false, title }: { data: ChartPoint[]; metrics: ChartMetric[]; bars?: boolean; compact?: boolean; title: string }) {
  const empty = !data.some((point) => metrics.some((metric) => Number(point[metric.key]) > 0));
  const Chart = bars ? BarChart : LineChart;
  return <div className="dashboard-chart-block">
    <div className={`dashboard-rechart ${compact ? "is-compact" : ""}`} aria-label={title}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50} initialDimension={{ width: 600, height: compact ? 180 : 250 }}>
        <Chart data={data} margin={{ top: 12, right: 16, left: -16, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#eaf0f7" strokeDasharray="3 4" vertical={false}/>
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={30} tickMargin={10}/>
          <YAxis domain={integerDomain} allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} width={48}/>
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#263954", fontWeight: 600 }} isAnimationActive={false}/>
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 12 }}/>
          {metrics.map((metric) => bars
            ? <Bar key={metric.key} dataKey={metric.key} name={metric.label} fill={metric.color} maxBarSize={25} radius={[3, 3, 0, 0]} isAnimationActive={false}/>
            : <Line key={metric.key} type="linear" dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2.5} dot={data.length <= 7 ? { r: 3, fill: metric.color, strokeWidth: 0 } : false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false}/>
          )}
        </Chart>
      </ResponsiveContainer>
      {empty && <span className="dashboard-chart-empty">所选时段暂无记录</span>}
    </div>
    <details className="dashboard-chart-details"><summary>查看数据明细</summary><div className="dashboard-detail-scroll" tabIndex={0} role="region" aria-label={`${title}数据明细`}><table><caption>{title}</caption><thead><tr><th scope="col">日期</th>{metrics.map((metric) => <th scope="col" key={metric.key}>{metric.label}</th>)}</tr></thead><tbody>{[...data].reverse().map((point) => <tr key={point.key}><th scope="row">{point.key}</th>{metrics.map((metric) => <td key={metric.key}>{point[metric.key]}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}

export function DashboardDonut({ data, title }: { data: { key: string; label: string; count: number }[]; title: string }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return <div className="dashboard-donut-block">
    <div className="dashboard-donut-chart" aria-label={title}>
      {total > 0 ? <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 240, height: 185 }} debounce={50}>
        <PieChart accessibilityLayer><Pie data={data} nameKey="label" dataKey="count" innerRadius="63%" outerRadius="88%" paddingAngle={data.filter((item) => item.count > 0).length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
          {data.map((item, index) => <Cell key={item.key} fill={chartColors[index % chartColors.length]}/>)}</Pie><Tooltip contentStyle={tooltipStyle} isAnimationActive={false}/></PieChart>
      </ResponsiveContainer> : <div className="dashboard-empty-ring"/>}
      <span className="dashboard-donut-total"><strong>{total.toLocaleString("zh-CN")}</strong><small>累计数量</small></span>
    </div>
    <ul className="dashboard-donut-legend" aria-label={`${title}明细`}>{data.length ? data.map((item, index) => <li key={item.key}><i style={{ background: chartColors[index % chartColors.length] }}/><span>{item.label}</span><b>{item.count.toLocaleString("zh-CN")}</b><small>{total ? Math.round(item.count / total * 100) : 0}%</small></li>) : <li className="dashboard-muted">暂无记录</li>}</ul>
  </div>;
}
