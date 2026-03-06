import { redisSub } from "@/lib/redis";
import { getLatestReadings } from "@/services/reading-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  let closed = false;
  let heartbeat: NodeJS.Timeout;
  let sub: ReturnType<typeof redisSub.duplicate>;

  const stream = new ReadableStream({
    async start(controller) {
      sub = redisSub.duplicate();
      await sub.connect();

      function cleanup() {
        if (closed) return;
        closed = true;

        clearInterval(heartbeat);

        try {
          sub.unsubscribe();
          sub.disconnect();
        } catch {}

        try {
          controller.close();
        } catch {}
      }

      function safeSend(event: string, data: string) {
        if (closed) return;

        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`)
          );
        } catch {
          // 🔥 VERY IMPORTANT
          cleanup();
        }
      }

      function safeComment(data: string) {
        if (closed) return;

        try {
          controller.enqueue(encoder.encode(`: ${data}\n\n`));
        } catch {
          cleanup();
        }
      }

      // Heartbeat
      heartbeat = setInterval(() => {
        safeComment("heartbeat");
      }, 30_000);

      // Initial data
      try {
        const readings = await getLatestReadings();
        safeSend("readings", JSON.stringify(readings));
      } catch (err) {
        console.error("[sse] Initial fetch error:", err);
      }

      await sub.subscribe("readings:latest", "alerts:new");

      sub.on("message", (channel, message) => {
        if (channel === "readings:latest") {
          safeSend("readings", message);
        } else if (channel === "alerts:new") {
          safeSend("alert", message);
        }
      });

      // 👇 CRITICAL: listen for client disconnect
      req.signal.addEventListener("abort", cleanup);
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}