"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function CookieConsent() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    setVisible(!window.localStorage.getItem("enercore_cookie_consent"));
  }, [pathname]);
  if (!visible || pathname.startsWith("/admin")) return null;
  const choose = (value: string) => {
    window.localStorage.setItem("enercore_cookie_consent", value);
    window.dispatchEvent(new Event("enercore-consent-change"));
    setVisible(false);
  };
  return <aside className="cookie-consent" role="dialog" aria-label="Cookie 设置">
    <div><strong>我们使用 Cookie</strong><p>接受后会记录访问页面、来源、IP 和城市级粗略地区，用于网站统计；不会获取精确定位。We use page, referrer, IP and approximate city-level data for analytics after consent.</p></div>
    <div className="cookie-consent-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => choose("necessary")}>仅必要 Cookie</button><button type="button" className="btn btn-primary btn-sm" onClick={() => choose("accepted")}>接受 Cookie</button></div>
  </aside>;
}
