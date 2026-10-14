/** JSON contracts shared by the support APIs and client-side dashboards. */
export type SupportChannel = "WEBSITE" | "EMAIL" | "WHATSAPP" | "LINKEDIN" | "CRISP";

export type InboxSummary = {
  unreadMessages: number;
  unreadConversations: number;
  recent: Array<{
    id: string;
    contactName: string;
    channel: SupportChannel;
    preview: string;
    lastMessageAt: string;
    unreadCount: number;
  }>;
};

export type SupportAnalyticsPoint = {
  key: string;
  label: string;
  conversations: number;
  customers: number;
  inbound: number;
  outbound: number;
};

export type SupportAnalyticsData = {
  timezone: "Asia/Shanghai";
  generatedAt: string;
  summary: {
    todayCustomers: number;
    todayConversations: number;
    todayInbound: number;
    totalConversations: number;
    totalCustomers: number;
    totalInbound: number;
    totalOutbound: number;
    unreadMessages: number;
    unreadConversations: number;
    openConversations: number;
    pendingConversations: number;
    resolvedConversations: number;
  };
  daily: SupportAnalyticsPoint[];
  channels: Array<{ channel: SupportChannel; label: string; conversations: number; inbound: number }>;
};
