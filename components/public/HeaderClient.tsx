"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PackageCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

type Item = { id: string; label: string; href: string };

export function HeaderClient({
  items,
  locales,
  activeLocale,
  brand,
  quoteLabel,
  quoteHref,
}: {
  items: Item[];
  locales: { code: string; name: string }[];
  activeLocale: string;
  brand: { name: string; tagline: string; logoUrl: string };
  quoteLabel: string;
  quoteHref: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const navigationItems = items.filter((item) => {
    const itemHref = item.href.replace(/\/$/, "");
    const actionHref = quoteHref.replace(/\/$/, "");
    return itemHref !== actionHref && !item.href.includes("#quote");
  });
  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", open);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [open]);
  useEffect(() => setOpen(false), [path]);
  function switchLocale(code: string) {
    document.cookie = `locale=${code}; path=/; max-age=31536000; samesite=lax`;
    location.reload();
  }
  return (
    <header className="site-header">
      <div className="container-site header-inner">
        <Link href="/" className="brand header-brand" aria-label={`${brand.name} home`}>
          {brand.logoUrl ? (
            <img className="brand-logo-image" src={brand.logoUrl} alt={brand.name} />
          ) : (
            <span className="brand-mark">{brand.name.slice(0, 1)}</span>
          )}
          <span>
            <span className="brand-name">{brand.name}</span>
            <span className="brand-tag">{brand.tagline}</span>
          </span>
        </Link>
        <nav
          className={`main-nav ${open ? "open" : ""}`}
          aria-label="Main navigation"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.id}
              onClick={() => setOpen(false)}
              href={item.href}
              className={`nav-link ${path === item.href || (item.href !== "/" && path.startsWith(item.href)) ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mobile-nav-tools">
            {locales.length > 1 && <label className="mobile-language-field">
              <span>{activeLocale === "zh" ? "网站语言" : "Language"}</span>
              <select value={activeLocale} onChange={(event) => switchLocale(event.target.value)} aria-label={activeLocale === "zh" ? "切换网站语言" : "Switch website language"}>
                {locales.map((locale) => <option key={locale.code} value={locale.code}>{locale.code === "en" ? "English" : locale.name}</option>)}
              </select>
            </label>}
            <Link href={quoteHref} className="btn btn-primary mobile-menu-quote" onClick={() => setOpen(false)}>
              <PackageCheck size={17} /> {quoteLabel}
            </Link>
          </div>
        </nav>
        <div className="header-actions">
          {locales.length > 1 && (
            <select
              id="site-language"
              className="language-select"
              value={activeLocale}
              onChange={(event) => switchLocale(event.target.value)}
              aria-label="Website language"
            >
              {locales.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.code === "en" ? "EN" : locale.name}
                </option>
              ))}
            </select>
          )}
          <Link href={quoteHref} className="btn btn-primary btn-sm header-quote-btn" aria-label={quoteLabel}>
            <span className="header-quote-icon"><PackageCheck size={15} /></span><span>{quoteLabel}</span>
          </Link>
          <button
            className="mobile-toggle"
            aria-expanded={open}
            aria-label={activeLocale === "zh" ? (open ? "关闭菜单" : "打开菜单") : (open ? "Close menu" : "Open menu")}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <button className={`mobile-nav-backdrop ${open ? "open" : ""}`} type="button" aria-label={activeLocale === "zh" ? "关闭菜单" : "Close menu"} onClick={() => setOpen(false)} />
    </header>
  );
}
