"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Generic SSE hook that connects to /api/sse and manages EventSource lifecycle.
 * Returns the EventSource instance for event listener registration.
 * EventSource auto-reconnects on connection loss.
 */
export function useSSE() {
  const [source, setSource] = useState<EventSource | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/sse");
      sourceRef.current = es;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSource(es);

      es.onerror = () => {
        // EventSource auto-reconnects, but log for debugging
        console.debug("[sse] Connection error, EventSource will auto-reconnect");
      };

      return () => {
        es?.close();
        sourceRef.current = null;
      };
    } catch (err) {
      console.error("[sse] EventSource constructor failed:", err);
      setSource(null);
    }
  }, []);

  return source;
}
