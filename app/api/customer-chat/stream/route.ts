import { NextResponse } from "next/server";
import { getPublicConversation, serializePublicConversation } from "@/lib/public-chat";

export const runtime = "nodejs";
export const maxDuration = 60;

const POLL_INTERVAL_MS = 2_000;
const STREAM_LIFETIME_MS = 55_000;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("conversation");
  const token = request.headers.get("x-chat-token");
  if (!id || !token) return NextResponse.json({ error: "Conversation credentials are required." }, { status: 400 });
  const initial = await getPublicConversation(id, token);
  if (!initial) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;
      let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
      let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
      let previousSnapshot = "";

      const stop = (closeController: boolean) => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        if (lifetimeTimer) clearTimeout(lifetimeTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        request.signal.removeEventListener("abort", onAbort);
        if (closeController) controller.close();
      };
      const onAbort = () => stop(true);
      cleanup = () => stop(false);

      const sendSnapshot = (conversation: NonNullable<typeof initial>) => {
        const snapshot = serializePublicConversation(conversation);
        const serialized = JSON.stringify(snapshot);
        if (serialized === previousSnapshot || closed) return;
        previousSnapshot = serialized;
        controller.enqueue(encoder.encode(`event: messages\ndata: ${JSON.stringify({ ...snapshot, syncedAt: new Date().toISOString() })}\n\n`));
      };

      // One database read is active at a time; cancellation prevents all later work.
      const poll = async () => {
        if (closed) return;
        try {
          const conversation = await getPublicConversation(id, token);
          if (closed) return;
          if (!conversation) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Conversation not found." })}\n\n`));
            stop(true);
            return;
          }
          sendSnapshot(conversation);
        } catch {
          if (closed) return;
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Unable to synchronize this conversation." })}\n\n`));
          stop(true);
          return;
        }
        if (!closed) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      };

      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) {
        stop(true);
        return;
      }
      sendSnapshot(initial);
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      heartbeatTimer = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);
      lifetimeTimer = setTimeout(() => stop(true), STREAM_LIFETIME_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
