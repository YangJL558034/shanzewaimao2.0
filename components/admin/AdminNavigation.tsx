"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArchiveRestore, Boxes, ChevronDown, Factory, FileText, Globe2, Image, Languages, LayoutDashboard, Mail, MessageSquareText, MessagesSquare, Newspaper, PanelTop, Settings, ShieldCheck, Tags, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminSidebar } from "./AdminSidebarState";
import { unreadLabel, useSupportNotifications } from "./SupportNotifications";

export type AdminNavItem = { href: string; label: string; description: string; icon: string };
export type AdminNavGroup = { id: string; label: string; icon: string; items: AdminNavItem[] };

const icons: Record<string, typeof Boxes> = { dashboard: LayoutDashboard, inbox: MessagesSquare, content: PanelTop, customers: Users, security: ShieldCheck, settings: Settings, email: Mail, products: Boxes, categories: Tags, downloads: FileText, news: Newspaper, "news-categories": Tags, pages: FileText, "page-sections": PanelTop, banners: PanelTop, navigation: PanelTop, seo: Globe2, equipment: Factory, workshops: Factory, certificates: ShieldCheck, inquiries: MessageSquareText, "newsletter-subscribers": Mail, "email-templates": Mail, "email-queue": Mail, "website-visits": Globe2, media: Image, locales: Languages, translations: Languages, audit: FileText, "login-logs": ShieldCheck, backups: ArchiveRestore, trash: ArchiveRestore };

export function AdminNavigation({ primary, groups }: { primary: AdminNavItem[]; groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  const { close, collapsed, mobile, expand } = useAdminSidebar();
  const { summary, error } = useSupportNotifications();
  const selected = (href: string) => href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activeGroup = groups.find((group) => group.items.some((item) => selected(item.href)))?.id;
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroup);
  useEffect(() => { setOpenGroup(activeGroup); }, [activeGroup, pathname]);

  function itemLink(item: AdminNavItem, nested = false) {
    const Icon = icons[item.icon] || FileText;
    const active = selected(item.href);
    const unread = item.href === "/admin/inbox" ? summary?.unreadMessages : 0;
    const syncError = item.href === "/admin/inbox" && Boolean(error);
    return <Link href={item.href} key={item.href} className={`admin-nav-link${nested ? " admin-nav-child" : ""}${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={`${item.label}${unread ? ` · ${unread} 条未读消息` : ""}${syncError ? ` · ${error}` : ""}`} onClick={close}><Icon size={17} aria-hidden="true" /><span>{item.label}</span>{unread ? <b className="support-unread-badge support-nav-badge" aria-label={`${unread} 条未读客服消息`}>{unreadLabel(unread)}</b> : syncError ? <b className="support-sync-indicator" aria-label={error}>!</b> : !nested && active && <i className="admin-nav-active-dot" aria-hidden="true" />}</Link>;
  }

  return <nav className="admin-nav" aria-label="管理功能">
    <div className="admin-nav-primary">{primary.map((item) => itemLink(item))}</div>
    <span className="admin-nav-caption">管理功能</span>
    <div className="admin-nav-groups">{groups.map((group) => {
      const Icon = icons[group.icon] || FileText;
      const open = openGroup === group.id;
      return <section className={`admin-nav-group${open ? " is-open" : ""}${activeGroup === group.id ? " has-active" : ""}`} key={group.id}>
        <button type="button" className="admin-nav-group-toggle" aria-expanded={open && (!collapsed || mobile)} aria-controls={`admin-nav-${group.id}`} title={group.label} onClick={() => { if (collapsed && !mobile) { expand(); setOpenGroup(group.id); } else setOpenGroup(open ? undefined : group.id); }}><Icon size={18} aria-hidden="true" /><span>{group.label}</span><ChevronDown className="admin-nav-chevron" size={14} aria-hidden="true" /></button>
        <div id={`admin-nav-${group.id}`} className="admin-nav-group-items" hidden={!open || (collapsed && !mobile)}>{group.items.map((item) => itemLink(item, true))}</div>
      </section>;
    })}</div>
  </nav>;
}
