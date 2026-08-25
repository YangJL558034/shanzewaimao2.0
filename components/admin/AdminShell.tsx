import Link from "next/link";
import {
  ArchiveRestore,
  Boxes,
  Factory,
  FileText,
  Gauge,
  Globe2,
  Image,
  Languages,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  Newspaper,
  PanelTop,
  Settings,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import { cmsSections } from "@/lib/cms";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { AdminTopbarTools } from "@/components/admin/AdminTopbarTools";
import { AdminSidebarState } from "@/components/admin/AdminSidebarState";
import { AdminWelcomeToast } from "@/components/admin/AdminWelcomeToast";

const icons: Record<string, typeof Boxes> = {
  products: Boxes,
  categories: Tags,
  downloads: FileText,
  news: Newspaper,
  "news-categories": Tags,
  pages: FileText,
  "page-sections": PanelTop,
  equipment: Factory,
  workshops: Factory,
  certificates: ShieldCheck,
  banners: PanelTop,
  seo: Globe2,
  navigation: PanelTop,
  settings: Settings,
  locales: Languages,
  translations: Languages,
  inquiries: MessageSquareText,
  "newsletter-subscribers": Mail,
  "email-templates": Mail,
  "email-queue": Mail,
  "website-visits": Globe2,
  audit: FileText,
  "login-logs": ShieldCheck,
  trash: ArchiveRestore,
  backups: ArchiveRestore,
  media: Image,
};

const groups = [
  { label: "工作台", keys: [] },
  { label: "内容与营销", keys: ["products", "categories", "downloads", "news", "news-categories", "pages", "navigation", "seo"] },
  { label: "制造与质量", keys: ["equipment", "workshops", "certificates"] },
  { label: "客户与邮件", keys: ["inquiries", "newsletter-subscribers", "email-templates", "email-queue", "website-visits"] },
  { label: "系统安全中心", keys: ["media", "locales", "translations", "settings", "audit", "login-logs", "trash", "backups"] },
];

export function AdminShell({
  user,
  title,
  children,
}: {
  user: { name: string; email: string; permissions: Set<string> };
  title: string;
  children: React.ReactNode;
}) {
  const can = (permission: string) =>
    user.permissions.has("*") || user.permissions.has(`${permission}.read`);
  return (
    <div className="admin-screen">
      <AdminWelcomeToast fallbackName={user.name} />
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <AdminSidebarState />
          <Link className="brand" href="/admin">
            <span className="brand-mark">E</span>
            <span><span className="brand-name">ENERCORE</span><span className="brand-tag">MANUFACTURING CMS</span></span>
          </Link>
          <div className="admin-user"><strong>{user.name}</strong><span>{user.email}</span></div>
          <nav className="admin-nav">
            {groups.map((group) => (
              <div className="contents" key={group.label}>
                <div className="admin-nav-label">{group.label}</div>
                {group.label === "工作台" && <>
                  <Link href="/admin"><LayoutDashboard size={16} /><span>控制台</span></Link>
                  {can("pages") && <Link href="/admin/content"><PanelTop size={16} /><span>前台页面管理</span></Link>}
                </>}
                {group.keys.map((key) => {
                  const section = cmsSections.find((item) => item.key === key)!;
                  if (!can(section.permission)) return null;
                  const Icon = icons[key] || Gauge;
                  return <Link href={`/admin/${key}`} key={key}><Icon size={16} /><span>{section.label}</span></Link>;
                })}
                {group.label === "系统安全中心" && can("security") && <Link href="/admin/security"><Users size={16} /><span>用户与权限</span></Link>}
                {group.label === "系统安全中心" && can("settings") && <Link href="/admin/smtp"><Mail size={16} /><span>邮件服务器</span></Link>}
                {group.label === "系统安全中心" && can("settings") && <Link href="/admin/system"><Gauge size={16} /><span>系统状态</span></Link>}
              </div>
            ))}
          </nav>
        </aside>
        <div className="admin-main">
          <header className="admin-topbar">
            <h1>首页　/　{title}</h1>
            <AdminTopbarTools />
            <div className="admin-top-actions">
              <Link href="/" target="_blank">网站首页</Link>
              <span>中文</span>
              <div className="admin-profile">
                <span className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <span><strong className="block">{user.name}</strong><small className="text-slate-400">超级管理员</small></span>
              </div>
              <LogoutButton />
            </div>
          </header>
          <div className="admin-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
