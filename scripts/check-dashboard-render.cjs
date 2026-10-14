/* Run with: node --import tsx scripts/check-dashboard-render.cjs. No DB/network writes. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
// Node has no stylesheet loader; Next handles these assets in the real application.
require.extensions[".css"] = () => {};
global.React = React;
const { SupportDashboard } = require("../components/admin/SupportDashboard.tsx");
const { DashboardTrend, DashboardDonut } = require("../components/admin/DashboardCharts.tsx");
const { DashboardAnalytics, InquirySourceChart, InquiryTrendChart } = require("../components/admin/DashboardAnalytics.tsx");
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

const daily = Array.from({ length: 90 }, (_, index) => {
  const key = new Date(Date.UTC(2026, 6, 17 + index)).toISOString().slice(0, 10);
  return { key, label: key.slice(5), conversations: index === 89 ? 2 : 0, customers: index === 89 ? 3 : 0, inbound: index === 89 ? 5 : 0, outbound: index === 89 ? 4 : 0 };
});
const support = {
  timezone: "Asia/Shanghai", generatedAt: "2026-10-14T10:30:00.000Z", daily,
  summary: { todayCustomers: 3, todayConversations: 2, todayInbound: 5, totalConversations: 18, totalCustomers: 14, totalInbound: 35, totalOutbound: 30, unreadMessages: 6, unreadConversations: 2, openConversations: 3, pendingConversations: 5, resolvedConversations: 10 },
  channels: [{ channel: "WEBSITE", label: "官网聊天 / 询盘", conversations: 15, inbound: 30 }, { channel: "EMAIL", label: "Email", conversations: 3, inbound: 5 }],
};
const supportHtml = render(SupportDashboard, { initial: support });
for (const label of ["今日接待客户", "今日新会话", "今日收到消息", "未读客户消息", "历史累计会话", "历史接待客户", "近7天", "近30天", "近90天", "查看数据明细", "18:30:00"]) assert.ok(supportHtml.includes(label), label);
assert.ok(supportHtml.includes("6 条未读客户消息"));
assert.ok(supportHtml.includes("/admin/inbox?unread=1"));
assert.equal((supportHtml.match(/scope="row"/g) || []).length, 30, "default displays last 30 days in accessible table");
assert.ok(!supportHtml.includes(daily[0].key), "unselected old dates are not mixed into the current chart");
const noData = render(SupportDashboard, { initial: null });
assert.ok(noData.includes("暂时未能加载"));
assert.ok(!noData.includes("未读客户消息"), "failed fetch is not presented as zero unread");

const metrics = [{ key: "inbound", label: "收到消息", color: "#2563eb" }];
assert.ok(render(DashboardTrend, { data: daily.slice(0, 7), metrics, title: "空客服趋势" }).includes("所选时段暂无记录"));
assert.ok(!render(DashboardTrend, { data: daily.slice(-7), metrics, title: "客服趋势" }).includes("所选时段暂无记录"));
assert.ok(render(DashboardDonut, { data: [], title: "空来源" }).includes("暂无记录"));
const escaped = render(InquirySourceChart, { sources: [{ source: "<script>alert(1)</script>", count: 2 }] });
assert.ok(escaped.includes("&lt;script&gt;"));
assert.ok(!escaped.includes("<script>alert"));

const analyticsPoints = daily.slice(-30).map((point) => ({ key: point.key, label: point.label, views: point.inbound * 10, visitors: point.customers, subscribers: 0, inquiries: point.conversations }));
const analytics = { daily: analyticsPoints, monthly: analyticsPoints.slice(-1), yearly: analyticsPoints.slice(-1), summary: { todayViews: 50, todayVisitors: 3, monthViews: 50, monthVisitors: 3, yearViews: 50, yearVisitors: 3, totalSubscribers: 0, activeSubscribers: 0, monthSubscribers: 0, yearSubscribers: 0 } };
assert.ok(render(DashboardAnalytics, { data: analytics, showTraffic: true, showSubscriptions: true }).includes("订阅增长趋势"));
assert.ok(!render(DashboardAnalytics, { data: analytics, showTraffic: true, showSubscriptions: false }).includes("订阅增长趋势"));
assert.ok(!render(DashboardAnalytics, { data: analytics, showTraffic: false, showSubscriptions: true }).includes("网站访问趋势"));
assert.ok(render(InquiryTrendChart, { data: analyticsPoints }).includes("近30天询盘趋势"));
console.log("Dashboard render checks passed: support counts, date ranges, error/zero states, readable tables, escaped labels, existing chart toggles.");
