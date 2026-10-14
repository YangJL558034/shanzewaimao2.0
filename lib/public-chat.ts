import "server-only";
import { db } from "@/lib/db";

/** Return only visitor-safe fields after authenticating the website conversation. */
export async function getPublicConversation(id: string, token: string) {
  return db.conversation.findFirst({
    where: { id, publicToken: token, channel: "WEBSITE" },
    select: {
      id: true,
      status: true,
      messages: {
        where: { direction: { in: ["INBOUND", "OUTBOUND"] } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          direction: true,
          content: true,
          createdAt: true,
          readAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
}

export type PublicConversation = NonNullable<Awaited<ReturnType<typeof getPublicConversation>>>;

/** The shared snapshot contract used by HTTP recovery and live SSE updates. */
export function serializePublicConversation(conversation: PublicConversation) {
  return {
    data: conversation.messages.map((message) => ({
      id: message.id,
      direction: message.direction as "INBOUND" | "OUTBOUND",
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      authorName: message.direction === "OUTBOUND" ? message.author?.name || "Shanze sales" : "You",
    })),
    conversation: { id: conversation.id, status: conversation.status },
  };
}
