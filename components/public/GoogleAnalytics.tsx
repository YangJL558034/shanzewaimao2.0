"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicAnalyticsEvent } from "@/lib/analytics-client";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    shanzeGaId?: string;
  }
}
const eventNames = new Set<PublicAnalyticsEvent>(["generate_lead", "chat_started", "chat_message_sent", "contact_click", "catalog_click"]);
const channels = new Set(["website_form", "live_chat", "whatsapp", "email", "linkedin", "catalog"]);

function analyticsCookiesClear() {
  const domains = ["", `; domain=${location.hostname}`, `; domain=.${location.hostname.replace(/^www\./, "")}`];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (/^_ga(?:_|$)/.test(name)) for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
  }
}

export function GoogleAnalytics({ measurementId, nonce, enabled }: { measurementId: string; nonce: string; enabled: boolean }) {
  const pathname = usePathname();
  const [accepted, setAccepted] = useState(false);
  const lastPage = useRef("");
  const allowed = enabled && /^G-[A-Z0-9]{4,20}$/.test(measurementId) && !pathname.startsWith("/admin") && !pathname.startsWith("/api") && pathname !== "/unsubscribe";

  useEffect(() => {
    const update = () => {
      const consent = localStorage.getItem("enercore_cookie_consent") === "accepted" && navigator.doNotTrack !== "1";
      setAccepted(consent);
      if (!consent) {
        (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
        window.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        analyticsCookiesClear();
        lastPage.current = "";
      }
    };
    update();
    window.addEventListener("enercore-consent-change", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("enercore-consent-change", update); window.removeEventListener("storage", update); };
  }, [measurementId]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = !allowed || !accepted;
    if (!allowed || !accepted) return;
    if (window.shanzeGaId !== measurementId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer!.push(arguments); };
      window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      window.gtag("js", new Date());
      // Manual SPA pageviews: disable GA4 history-based pageviews in the data stream too.
      window.gtag("config", measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: `${location.origin}${pathname}`, page_referrer: safeReferrer() });
      window.shanzeGaId = measurementId;
    }
    window.gtag?.("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    if (lastPage.current !== pathname) {
      window.gtag?.("event", "page_view", { send_to: measurementId, page_location: `${location.origin}${pathname}`, page_title: document.title, page_referrer: safeReferrer() });
      lastPage.current = pathname;
    }
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ name: PublicAnalyticsEvent; channel: string }>).detail;
      if (!detail || !eventNames.has(detail.name) || !channels.has(detail.channel)) return;
      if (localStorage.getItem("enercore_cookie_consent") !== "accepted") return;
      window.gtag?.("event", detail.name, { send_to: measurementId, channel: detail.channel, page_location: `${location.origin}${pathname}` });
    };
    window.addEventListener("shanze-analytics-event", onEvent);
    return () => window.removeEventListener("shanze-analytics-event", onEvent);
  }, [allowed, accepted, measurementId, pathname]);

  if (!allowed || !accepted) return null;
  return <Script id={`shanze-ga4-${measurementId}`} src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} nonce={nonce} strategy="afterInteractive" />;
}

function safeReferrer() {
  try { const url = new URL(document.referrer); return url.origin; } catch { return ""; }
}
