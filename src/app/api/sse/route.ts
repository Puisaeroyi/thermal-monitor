import { redisSub } from "@/lib/redis";
import { getLatestReadings } from "@/services/reading-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Create dedicated subscriber for this connection
      const sub = redisSub.duplicate();

      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      // Send initial data immediately so client doesn't wait for next publish
      getLatestReadings()
        .then((readings) => {
          send("readings", JSON.stringify(readings));
        })
        .catch((err) => {
          console.error("[sse] Initial data fetch error:", err);
        });

      sub.subscribe("readings:latest", "alerts:new");

      sub.on("message", (channel, message) => {
        if (channel === "readings:latest") {
          send("readings", message);
        } else if (channel === "alerts:new") {
          send("alert", message);
        }
      });

      // Cleanup on client disconnect
      const cleanup = () => {
        clearInterval(heartbeat);
        sub.unsubscribe();
        sub.disconnect();
      };

      // ReadableStream cancel callback
      stream.cancel = async () => {
        cleanup();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
