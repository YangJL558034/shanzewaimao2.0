import "server-only";

import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type { InboxSummary, SupportAnalyticsData, SupportChannel } from "@/lib/support-types";

const DAY = 86_400_000;
const SHANGHAI_OFFSET = 8 * 60 * 60 * 1000;
const unreadWhere = { direction: "INBOUND" as const, readAt: null };
const channelLabels: Record<SupportChannel, string> = {
  WEBSITE: "官网聊天 / 询盘", EMAIL: "Email", WHATSAPP: "WhatsApp", LINKEDIN: "LinkedIn", CRISP: "Crisp",
};
type Count = bigint | number;

/** Stable across Windows/Linux process timezone settings. Shanghai is UTC+8. */
export function supportDayKey(date: Date): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET).toISOString().slice(0, 10);
}

export async function getInboxSummary(client: PrismaClient = db): Promise<InboxSummary> {
  const [unreadMessages, unreadConversations, recent] = await client.$transaction([
    client.conversationMessage.count({ where: unreadWhere }),
    client.conversation.count({ where: { messages: { some: unreadWhere } } }),
    client.conversation.findMany({
      where: { messages: { some: unreadWhere } },
      orderBy: { lastMessageAt: "desc" }, take: 8,
      select: {
        id: true, channel: true,
        contact: { select: { fullName: true, companyName: true, email: true } },
        messages: { where: unreadWhere, orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
        _count: { select: { messages: { where: unreadWhere } } },
      },
    }),
  ]);
  return {
    unreadMessages, unreadConversations,
    recent: recent.map((conversation) => ({
      id: conversation.id,
      contactName: conversation.contact.fullName || conversation.contact.companyName || conversation.contact.email || "访客",
      channel: conversation.channel,
      preview: conversation.messages[0]?.content.slice(0, 160) || "",
      lastMessageAt: conversation.messages[0]!.createdAt.toISOString(),
      unreadCount: conversation._count.messages,
    })),
  };
}

export async function getSupportAnalytics(client: PrismaClient = db, now = new Date()): Promise<SupportAnalyticsData> {
  const todayKey = supportDayKey(now);
  const todayStart = new Date(`${todayKey}T00:00:00+08:00`).getTime();
  const start = todayStart - 89 * DAY;
  const end = now.getTime();
  const [conversationDays, messageDays, totals, channelTotals, inboundChannels] = await client.$transaction([
    client.$queryRaw<Array<{ key: string; conversations: Count }>>`
      SELECT strftime('%Y-%m-%d', createdAt / 1000.0, 'unixepoch', '+8 hours') AS key, COUNT(*) AS conversations
      FROM Conversation WHERE createdAt >= ${start} AND createdAt <= ${end} GROUP BY key ORDER BY key`,
    client.$queryRaw<Array<{ key: string; customers: Count; inbound: Count; outbound: Count }>>`
      SELECT strftime('%Y-%m-%d', m.createdAt / 1000.0, 'unixepoch', '+8 hours') AS key,
        COUNT(DISTINCT CASE WHEN m.direction = 'INBOUND' THEN c.contactId END) AS customers,
        SUM(CASE WHEN m.direction = 'INBOUND' THEN 1 ELSE 0 END) AS inbound,
        SUM(CASE WHEN m.direction = 'OUTBOUND' THEN 1 ELSE 0 END) AS outbound
      FROM ConversationMessage m JOIN Conversation c ON c.id = m.conversationId
      WHERE m.createdAt >= ${start} AND m.createdAt <= ${end} AND m.direction IN ('INBOUND', 'OUTBOUND')
      GROUP BY key ORDER BY key`,
    client.$queryRaw<Array<{
      totalConversations: Count; totalCustomers: Count; totalInbound: Count; totalOutbound: Count;
      unreadMessages: Count; unreadConversations: Count; openConversations: Count; pendingConversations: Count; resolvedConversations: Count;
    }>>`
      SELECT (SELECT COUNT(*) FROM Conversation) AS totalConversations,
        (SELECT COUNT(DISTINCT c.contactId) FROM ConversationMessage m JOIN Conversation c ON c.id = m.conversationId WHERE m.direction = 'INBOUND') AS totalCustomers,
        (SELECT COUNT(*) FROM ConversationMessage WHERE direction = 'INBOUND') AS totalInbound,
        (SELECT COUNT(*) FROM ConversationMessage WHERE direction = 'OUTBOUND') AS totalOutbound,
        (SELECT COUNT(*) FROM ConversationMessage WHERE direction = 'INBOUND' AND readAt IS NULL) AS unreadMessages,
        (SELECT COUNT(DISTINCT conversationId) FROM ConversationMessage WHERE direction = 'INBOUND' AND readAt IS NULL) AS unreadConversations,
        (SELECT COUNT(*) FROM Conversation WHERE status = 'OPEN') AS openConversations,
        (SELECT COUNT(*) FROM Conversation WHERE status = 'PENDING') AS pendingConversations,
        (SELECT COUNT(*) FROM Conversation WHERE status = 'RESOLVED') AS resolvedConversations`,
    client.$queryRaw<Array<{ channel: SupportChannel; conversations: Count }>>`
      SELECT channel, COUNT(*) AS conversations FROM Conversation GROUP BY channel`,
    client.$queryRaw<Array<{ channel: SupportChannel; inbound: Count }>>`
      SELECT c.channel, COUNT(*) AS inbound FROM ConversationMessage m
      JOIN Conversation c ON c.id = m.conversationId WHERE m.direction = 'INBOUND' GROUP BY c.channel`,
  ]);
  const conversationMap = new Map(conversationDays.map((row) => [row.key, row]));
  const messageMap = new Map(messageDays.map((row) => [row.key, row]));
  const daily = Array.from({ length: 90 }, (_, index) => {
    const key = supportDayKey(new Date(start + index * DAY));
    const messages = messageMap.get(key);
    return {
      key, label: key.slice(5), conversations: Number(conversationMap.get(key)?.conversations || 0),
      customers: Number(messages?.customers || 0), inbound: Number(messages?.inbound || 0), outbound: Number(messages?.outbound || 0),
    };
  });
  const current = daily.at(-1)!;
  const aggregate = totals[0]!;
  return {
    timezone: "Asia/Shanghai", generatedAt: now.toISOString(), daily,
    summary: {
      todayCustomers: current.customers, todayConversations: current.conversations, todayInbound: current.inbound,
      totalConversations: Number(aggregate.totalConversations), totalCustomers: Number(aggregate.totalCustomers),
      totalInbound: Number(aggregate.totalInbound), totalOutbound: Number(aggregate.totalOutbound),
      unreadMessages: Number(aggregate.unreadMessages), unreadConversations: Number(aggregate.unreadConversations),
      openConversations: Number(aggregate.openConversations), pendingConversations: Number(aggregate.pendingConversations), resolvedConversations: Number(aggregate.resolvedConversations),
    },
    channels: (Object.keys(channelLabels) as SupportChannel[]).map((channel) => ({
      channel, label: channelLabels[channel],
      conversations: Number(channelTotals.find((row) => row.channel === channel)?.conversations || 0),
      inbound: Number(inboundChannels.find((row) => row.channel === channel)?.inbound || 0),
    })),
  };
}
