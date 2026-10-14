"use client";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import "./cookie-consent.css";

export function CookieConsent({ locale }: { locale: string }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const zh = locale === "zh" || locale.startsWith("zh-");
  const adminPage = pathname.startsWith("/admin");

  useEffect(() => {
    try {
      const consent = window.localStorage.getItem("enercore_cookie_consent");
      setVisible(consent !== "accepted" && consent !== "necessary");
    }
    catch { setVisible(true); }
    const open = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("#cookie-preferences-trigger")) {
        setVisible(true);
      }
    };
    document.addEventListener("click", open, true);
    return () => document.removeEventListener("click", open, true);
  }, []);

  useEffect(() => {
    const publishOffset = (offset: number) => {
      const value = `${offset}px`;
      const root = document.documentElement;
      if (root.style.getPropertyValue("--customer-support-consent-offset") !== value) {
        root.style.setProperty("--customer-support-consent-offset", value);
        window.dispatchEvent(new Event("customer-support-consent-change"));
      }
    };
    const banner = bannerRef.current;
    if (!visible || adminPage || !banner) { publishOffset(0); return; }

    let frame = 0;
    const measure = () => {
      const bounds = banner.getBoundingClientRect();
      // Includes the banner's actual bottom/safe-area margin plus a 12px gap.
      publishOffset(bounds.height > 0 ? Math.max(0, Math.ceil(window.innerHeight - bounds.top + 12)) : 0);
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
    observer?.observe(banner);
    window.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("scroll", scheduleMeasure);
    measure();
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("scroll", scheduleMeasure);
      publishOffset(0);
    };
  }, [visible, adminPage]);

  if (!visible || adminPage) return null;
  const choose = (value: string) => {
    try { window.localStorage.setItem("enercore_cookie_consent", value); }
    catch { /* The current page still honors this choice when persistent storage is unavailable. */ }
    window.dispatchEvent(new Event("enercore-consent-change"));
    setVisible(false);
  };
  return <aside ref={bannerRef} className="cookie-consent shanze-cookie-consent" role="dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
    <div className="cookie-consent-copy"><strong id={titleId}>{zh ? "隐私与访问统计" : "Privacy & website analytics"}</strong><p id={descriptionId}>{zh ? "必要功能用于网站安全与在线客服。同意后，我们会统计访问页面、来源和大致地区，并在配置后启用谷歌分析；不会上传客户联系方式或消息正文。您可在页脚的偏好设置中更改选择。" : "Necessary cookies support security and customer service. With your consent, we measure page visits, referrals and approximate location, including Google Analytics when configured. Customer contact details and message text are not sent to Google. Change your choice in the footer preferences."}</p><a className="text-link" href="/privacy-policy">{zh ? "隐私政策" : "Privacy Policy"}</a></div>
    <div className="cookie-consent-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => choose("necessary")}>{zh ? "仅必要功能" : "Necessary only"}</button><button type="button" className="btn btn-primary btn-sm" onClick={() => choose("accepted")}>{zh ? "同意统计" : "Accept analytics"}</button></div>
  </aside>;
}
