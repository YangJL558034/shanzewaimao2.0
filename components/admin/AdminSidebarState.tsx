"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const COLLAPSED_KEY = "shanze-admin-sidebar-collapsed";
const SidebarContext = createContext({ collapsed: false, mobile: false, mobileOpen: false, toggle: () => {}, close: () => {}, expand: () => {} });

export function AdminSidebarState({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1"); } catch { /* Storage may be unavailable. */ }
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => { setMobile(query.matches); setMobileOpen(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => { close(); }, [pathname, close]);

  useEffect(() => {
    if (!mobile || !mobileOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const sidebar = shellRef.current?.querySelector<HTMLElement>(".admin-sidebar");
    const main = shellRef.current?.querySelector<HTMLElement>(".admin-main");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (main) main.inert = true;
    const frame = requestAnimationFrame(() => sidebar?.querySelector<HTMLButtonElement>(".admin-sidebar-close")?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !sidebar) return;
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (main) main.inert = false;
      previouslyFocused?.focus();
    };
  }, [mobile, mobileOpen, close]);

  function remember(value: boolean) {
    setCollapsed(value);
    try { localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0"); } catch { /* Preference remains available for this page. */ }
  }

  return <SidebarContext.Provider value={{ collapsed, mobile, mobileOpen, close, toggle: () => mobile ? setMobileOpen((open) => !open) : remember(!collapsed), expand: () => remember(false) }}>
    <div className="admin-screen admin-redesign">
      <a className="admin-skip-link" href="#admin-content">跳转到主要内容</a>
      <div className="admin-shell" ref={shellRef} data-sidebar-collapsed={collapsed} data-sidebar-open={mobileOpen}>{children}</div>
      {mobile && mobileOpen && <button type="button" className="admin-sidebar-overlay" onClick={close} tabIndex={-1} aria-label="关闭导航菜单" />}
    </div>
  </SidebarContext.Provider>;
}

export function AdminSidebarFrame({ children }: { children: React.ReactNode }) {
  const { mobile, mobileOpen } = useContext(SidebarContext);
  return <aside className="admin-sidebar" id="admin-navigation" inert={mobile && !mobileOpen} role={mobile && mobileOpen ? "dialog" : undefined} aria-modal={mobile && mobileOpen ? true : undefined} aria-label="后台导航">{children}</aside>;
}

export function AdminSidebarToggle({ closeOnly = false }: { closeOnly?: boolean }) {
  const { collapsed, mobile, mobileOpen, close, toggle } = useContext(SidebarContext);
  const Icon = closeOnly ? X : mobile ? Menu : collapsed ? PanelLeftOpen : PanelLeftClose;
  return <button type="button" className={closeOnly ? "admin-sidebar-close" : "admin-sidebar-toggle"} onClick={closeOnly ? close : toggle} aria-label={closeOnly ? "关闭导航菜单" : mobile ? "打开导航菜单" : collapsed ? "展开侧边栏" : "收起侧边栏"} aria-controls="admin-navigation" aria-expanded={mobile ? mobileOpen : !collapsed} title={closeOnly ? "关闭导航菜单" : mobile ? "导航菜单" : collapsed ? "展开侧边栏" : "收起侧边栏"}><Icon size={19} /></button>;
}

export function useAdminSidebar() { return useContext(SidebarContext); }
