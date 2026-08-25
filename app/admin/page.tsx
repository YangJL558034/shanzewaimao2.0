import { Activity, Boxes, Eye, FileImage, Mail, MailCheck, MessageSquareText, Newspaper, Search, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardDefaults, dashboardSettingKey, type DashboardPreferences } from "@/lib/dashboard";
import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardCustomizeButton } from "@/components/admin/DashboardCustomizeButton";
import { DashboardAnalytics, InquirySourceChart, InquiryTrendChart } from "@/components/admin/DashboardAnalytics";
import { getDashboardAnalytics } from "@/lib/analytics";

function preferencesFrom(value?: string): DashboardPreferences {
  if (!value) return dashboardDefaults;
  try {
    const parsed = JSON.parse(value);
    if (parsed.version === 2 && Array.isArray(parsed.stats) && Array.isArray(parsed.quick) && Array.isArray(parsed.panels)) return parsed;
  } catch { /* use defaults */ }
  return dashboardDefaults;
}

export default async function AdminDashboard() {
  const user = await requireUser();
  const [products, posts, inquiries, pending, admins, media, recent, audit, setting, analytics, sourceGroups] = await Promise.all([
    db.product.count(),
    db.news.count(),
    db.inquiry.count(),
    db.inquiry.count({ where: { status: { in: ["NEW", "ASSIGNED", "CONTACTED"] } } }),
    db.user.count({ where: { isActive: true } }),
    db.media.count(),
    db.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { name: true } } } }),
    db.setting.findUnique({ where: { key: dashboardSettingKey(user.id) } }),
    getDashboardAnalytics(),
    db.inquiry.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
  ]);
  const preferences = preferencesFrom(setting?.value);
  const statItems = [
    { key: "products", Icon: Boxes, label: "产品总数", value: products, href: "/admin/products", hint: "实时数据" },
    { key: "news", Icon: Newspaper, label: "新闻总数", value: posts, href: "/admin/news", hint: "实时数据" },
    { key: "inquiries", Icon: MessageSquareText, label: "询盘总数", value: inquiries, href: "/admin/inquiries", hint: "实时数据" },
    { key: "pending", Icon: Mail, label: "待跟进", value: pending, href: "/admin/inquiries", hint: "需要处理" },
    { key: "visits", Icon: Eye, label: "今日访问量", value: analytics.summary.todayViews, href: "/admin/website-visits", hint: `${analytics.summary.todayVisitors} 位访客` },
    { key: "subscribers", Icon: MailCheck, label: "有效订阅", value: analytics.summary.activeSubscribers, href: "/admin/newsletter-subscribers", hint: `本月新增 ${analytics.summary.monthSubscribers}` },
    { key: "admins", Icon: Users, label: "管理员", value: admins, href: "/admin/security", hint: "实时数据" },
    { key: "media", Icon: FileImage, label: "文件数量", value: media, href: "/admin/media", hint: "实时数据" },
  ].filter((item) => preferences.stats.includes(item.key));
  const quickItems = [
    { key: "products", Icon: Boxes, title: "产品管理", sub: "管理产品信息", href: "/admin/products" },
    { key: "news", Icon: Newspaper, title: "新闻管理", sub: "发布与维护新闻", href: "/admin/news" },
    { key: "inquiries", Icon: MessageSquareText, title: "询盘管理", sub: "查看与跟进询盘", href: "/admin/inquiries" },
    { key: "media", Icon: FileImage, title: "媒体中心", sub: "管理图片与文件", href: "/admin/media" },
    { key: "seo", Icon: Search, title: "SEO 设置", sub: "网站 SEO 优化", href: "/admin/seo" },
    { key: "security", Icon: Users, title: "管理员", sub: "用户与权限管理", href: "/admin/security" },
  ].filter((item) => preferences.quick.includes(item.key));
  const inquirySources = sourceGroups.map((item) => ({ source: item.source, count: item._count._all }));

  return <AdminShell user={user} title="控制台">
    <section className="admin-panel admin-welcome"><div><h2>欢迎回来，{user.name} 👋</h2><p>今天是 {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p></div><DashboardCustomizeButton initial={preferences}/></section>

    <div className="admin-stat-grid">{statItems.map(({ key, Icon, label, value, href, hint }) => (
      <a className="admin-panel admin-stat admin-clickable" href={href} key={key} aria-label={`打开${label}`}>
        <div><span>{label}</span><strong>{value}</strong><small className={key === "pending" ? "text-red-500" : "text-emerald-500"}>↑ {hint}</small></div><span className="icon-badge ml-auto"><Icon size={20}/></span>
      </a>
    ))}</div>

    {(preferences.panels.includes("traffic") || preferences.panels.includes("subscriptions")) && <DashboardAnalytics data={analytics} showTraffic={preferences.panels.includes("traffic")} showSubscriptions={preferences.panels.includes("subscriptions")} />}

    {(preferences.panels.includes("trend") || preferences.panels.includes("sources") || preferences.panels.includes("recent")) && <div className="dashboard-insight-grid mt-3">
      {preferences.panels.includes("trend") && <InquiryTrendChart data={analytics.daily} />}
      {preferences.panels.includes("sources") && <InquirySourceChart sources={inquirySources} />}
      {preferences.panels.includes("recent") && <section className="admin-panel"><div className="admin-panel-head"><div><h2>最新询盘</h2></div><a className="text-xs text-brand-600" href="/admin/inquiries">查看全部 ›</a></div><div className="admin-table-wrap"><table className="admin-table"><tbody>{recent.map((item) => <tr key={item.id}><td><a className="block" href="/admin/inquiries"><strong>{item.fullName}</strong><small className="block text-slate-400">{item.companyName}</small></a></td><td><span className={`status-pill ${item.status}`}>{item.status}</span></td></tr>)}</tbody></table></div></section>}
    </div>}

    {preferences.panels.includes("quick") && <section className="admin-panel mt-3 p-4"><h2 className="mb-3 text-sm">快捷操作</h2><div className="quick-grid">{quickItems.map(({ key, Icon, title, sub, href }) => <a className="quick-card card admin-clickable" href={href} key={key}><span className="icon-badge"><Icon size={18}/></span><span><strong>{title}</strong><span>{sub}</span></span></a>)}</div></section>}

    {(preferences.panels.includes("system") || preferences.panels.includes("audit")) && <div className="security-grid mt-3">
      {preferences.panels.includes("system") && <a href="/admin/system" className="admin-panel p-5 admin-clickable"><div className="flex items-center gap-3"><span className="icon-badge"><Activity/></span><div><h2 className="m-0 text-sm">系统运行正常</h2><p className="muted m-0 text-xs">数据库、SMTP 队列和安全审计已启用</p></div></div><ul className="check-list mt-4 grid grid-cols-2"><li>SQLite 数据库持久化</li><li>RBAC 接口级验证</li><li>密码哈希与账号锁定</li><li>询盘先入库后通知</li></ul><span className="mt-3 block text-xs text-brand-600">查看系统状态 ›</span></a>}
      {preferences.panels.includes("audit") && <section className="admin-panel"><div className="admin-panel-head"><div><h2>最近操作日志</h2></div><a href="/admin/audit" className="text-xs text-brand-600">查看全部 ›</a></div><div className="admin-table-wrap"><table className="admin-table"><tbody>{audit.map((item) => <tr key={item.id}><td><a href="/admin/audit"><strong>{item.action}</strong><small className="block text-slate-400">{item.user?.name || "系统"} · {item.entityType}</small></a></td><td>{item.createdAt.toLocaleString("zh-CN")}</td></tr>)}</tbody></table></div></section>}
    </div>}
  </AdminShell>;
}
