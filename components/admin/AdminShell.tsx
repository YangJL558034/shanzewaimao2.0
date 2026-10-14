import Link from "next/link";
import { ChevronRight, ExternalLink, ShieldCheck } from "lucide-react";
import { cmsSections } from "@/lib/cms";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { AdminTopbarTools } from "@/components/admin/AdminTopbarTools";
import { AdminNavigation, type AdminNavGroup, type AdminNavItem } from "@/components/admin/AdminNavigation";
import { AdminSidebarFrame, AdminSidebarState, AdminSidebarToggle } from "@/components/admin/AdminSidebarState";
import { AdminWelcomeToast } from "@/components/admin/AdminWelcomeToast";
import { SupportNotificationsProvider } from "@/components/admin/SupportNotifications";

import "./admin-shell.css";
import "./support-notifications.css";

const navigationGroups = [
  { id: "content", label: "网站内容", icon: "content", keys: ["news", "news-categories", "pages", "page-sections", "banners", "navigation", "seo", "media"] },
  { id: "products", label: "产品与制造", icon: "products", keys: ["products", "categories", "downloads", "equipment", "workshops", "certificates"] },
  { id: "customers", label: "客户与沟通", icon: "customers", keys: ["inquiries", "newsletter-subscribers", "email-templates", "email-queue", "website-visits"] },
  { id: "safety", label: "安全与数据", icon: "security", keys: ["audit", "login-logs", "backups", "trash"] },
  { id: "settings", label: "系统设置", icon: "settings", keys: ["settings", "locales", "translations"] },
];

export function AdminShell({
  user,
  title,
  children,
}: {
  user: { name: string; email: string; permissions: Set<string>; roles?: { role: { name: string } }[] };
  title: string;
  children: React.ReactNode;
}) {
  const can = (permission: string) =>
    user.permissions.has("*") || user.permissions.has(`${permission}.read`);
  const primary: AdminNavItem[] = [{ href: "/admin", label: "工作台", description: "概览与工作提醒", icon: "dashboard" }];
  if (can("inquiries")) primary.push({ href: "/admin/inbox", label: "客服中心", description: "客户消息与在线回复", icon: "inbox" });
  if (can("pages")) primary.push({ href: "/admin/content", label: "页面管理", description: "编辑官网页面内容", icon: "content" });
  const groups: AdminNavGroup[] = navigationGroups.map((group) => {
    const items: AdminNavItem[] = group.keys.flatMap((key) => {
      const section = cmsSections.find((item) => item.key === key);
      return section && can(section.permission) ? [{ href: `/admin/${key}`, label: section.label, description: section.description, icon: key }] : [];
    });
    if (group.id === "customers" && can("settings")) items.push({ href: "/admin/customer-channels", label: "客服渠道配置", description: "聊天入口与销售通知设置", icon: "inbox" });
    if (group.id === "content" && can("seo")) items.push({ href: "/admin/seo-tools", label: "Google 与 SEO 配置", description: "GA4、Search Console 与站点地图", icon: "seo" });
    if (group.id === "safety" && can("security")) items.unshift(
      { href: "/admin/system", label: "安全中心", description: "病毒检测、文件安全与防护状态", icon: "security" },
      { href: "/admin/security", label: "用户与权限", description: "管理员账号、角色和访问权限", icon: "customers" },
    );
    if (group.id === "settings" && can("settings")) items.push({ href: "/admin/smtp", label: "邮件服务器", description: "配置 SMTP 发信账号", icon: "email" });
    return { id: group.id, label: group.label, icon: group.icon, items };
  }).filter((group) => group.items.length > 0);
  const searchItems = [...primary, ...groups.flatMap((group) => group.items)];
  const roleLabel = user.roles?.map(({ role }) => role.name).join(" · ") || (user.permissions.has("*") ? "超级管理员" : "后台成员");
  return (
    <SupportNotificationsProvider enabled={can("inquiries")}><AdminSidebarState>
      <AdminWelcomeToast fallbackName={user.name} />
      <AdminSidebarFrame>
        <div className="admin-sidebar-brand-row">
          <Link className="brand" href="/admin" aria-label="Shanze 管理工作台">
            <span className="brand-mark">S</span>
            <span className="admin-brand-copy"><span className="brand-name">Shanze</span><span className="brand-tag">管理工作台</span></span>
          </Link>
          <AdminSidebarToggle closeOnly />
        </div>
        <AdminNavigation primary={primary} groups={groups} />
        <div className="admin-sidebar-footer">
          <span className="admin-sidebar-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.name}</strong><span title={user.email}>{user.email}</span></div>
          <ShieldCheck size={16} aria-hidden="true" />
        </div>
      </AdminSidebarFrame>
        <div className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-leading"><AdminSidebarToggle /><div className="admin-breadcrumb"><Link href="/admin">工作台</Link><ChevronRight size={14} aria-hidden="true" /><h1>{title}</h1></div></div>
            <AdminTopbarTools items={searchItems} />
            <div className="admin-top-actions">
              <Link className="admin-public-link" href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /><span>查看官网</span></Link>
              <div className="admin-profile">
                <span className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="admin-profile-copy"><strong>{user.name}</strong><small>{roleLabel}</small></span>
              </div>
              <LogoutButton />
            </div>
          </header>
          <div className="admin-content" id="admin-content">{children}</div>
        </div>
    </AdminSidebarState></SupportNotificationsProvider>
  );
}
