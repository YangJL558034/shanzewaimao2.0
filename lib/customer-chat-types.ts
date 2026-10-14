export type VisitorConversation = { conversationId: string; token: string; sessionId: string };
export type VisitorChatMessage = { id: string; direction: "INBOUND" | "OUTBOUND"; content: string; createdAt: string; readAt?: string | null; authorName?: string };
export type VisitorChatSnapshot = { data: VisitorChatMessage[]; conversation?: { id: string; status: "OPEN" | "PENDING" | "RESOLVED" }; syncedAt?: string };
