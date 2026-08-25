export type DashboardPreferences = {
  version: 2;
  stats: string[];
  quick: string[];
  panels: string[];
};

export const dashboardDefaults: DashboardPreferences = {
  version: 2,
  stats: ["products", "news", "inquiries", "pending", "visits", "subscribers", "admins", "media"],
  quick: ["products", "news", "inquiries", "media", "seo", "security"],
  panels: ["traffic", "subscriptions", "trend", "sources", "recent", "quick", "system", "audit"],
};

export function dashboardSettingKey(userId: string) {
  return `dashboard_layout_${userId}`;
}
