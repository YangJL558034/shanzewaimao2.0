"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const VISITOR_KEY = "enercore_analytics_session";

function sessionToken() {
  let token = window.sessionStorage.getItem(VISITOR_KEY);
  if (!token) {
    if (typeof crypto.randomUUID === "function") token = crypto.randomUUID();
    else {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
      token = `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    }
    window.sessionStorage.setItem(VISITOR_KEY, token);
  }
  return token;
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api") || navigator.doNotTrack === "1") return;
    let cancelled = false;
    const track = () => {
      if (cancelled || window.localStorage.getItem("enercore_cookie_consent") !== "accepted") return;
      const dedupeKey = `enercore_visit_${pathname}`;
      const lastTracked = Number(window.sessionStorage.getItem(dedupeKey) || 0);
      if (Date.now() - lastTracked < 30_000) return;
      window.sessionStorage.setItem(dedupeKey, String(Date.now()));
      const payload = {
        visitorToken: sessionToken(),
        path: pathname,
        referrer: document.referrer,
        locale: document.documentElement.lang.startsWith("zh") ? "zh" : "en",
        device: window.innerWidth < 768 ? "mobile" : window.innerWidth < 1100 ? "tablet" : "desktop",
      };
      fetch("/api/analytics/visit", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    };
    track();
    window.addEventListener("enercore-consent-change", track);
    return () => {
      cancelled = true;
      window.removeEventListener("enercore-consent-change", track);
    };
  }, [pathname]);

  return null;
}
