"use client";

export type PublicAnalyticsEvent = "generate_lead" | "chat_started" | "chat_message_sent" | "contact_click" | "catalog_click";
export function trackPublicEvent(name: PublicAnalyticsEvent, channel: string) {
  if (typeof window === "undefined") return;
  // Never pass customer names, contact details, inquiry text or CRM IDs to Google.
  window.dispatchEvent(new CustomEvent("shanze-analytics-event", { detail: { name, channel } }));
}
