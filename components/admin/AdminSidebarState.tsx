"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SCROLL_KEY = "enercore-admin-sidebar-scroll";

export function AdminSidebarState() {
  const pathname = usePathname();

  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>(".admin-sidebar");
    if (!sidebar) return;
    const links = Array.from(sidebar.querySelectorAll<HTMLAnchorElement>(".admin-nav a"));
    const active = links.find((link) => {
      const href = new URL(link.href).pathname;
      return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    });

    links.forEach((link) => {
      const selected = link === active;
      link.classList.toggle("active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    const saved = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    const restore = requestAnimationFrame(() => {
      sidebar.scrollTop = Number.isFinite(saved) ? saved : 0;
      if (!active) return;
      const sidebarBox = sidebar.getBoundingClientRect();
      const activeBox = active.getBoundingClientRect();
      if (activeBox.top < sidebarBox.top || activeBox.bottom > sidebarBox.bottom) {
        active.scrollIntoView({ block: "nearest" });
        sessionStorage.setItem(SCROLL_KEY, String(sidebar.scrollTop));
      }
    });

    const remember = () => sessionStorage.setItem(SCROLL_KEY, String(sidebar.scrollTop));
    sidebar.addEventListener("scroll", remember, { passive: true });
    links.forEach((link) => link.addEventListener("click", remember));
    return () => {
      cancelAnimationFrame(restore);
      sidebar.removeEventListener("scroll", remember);
      links.forEach((link) => link.removeEventListener("click", remember));
    };
  }, [pathname]);

  return null;
}
