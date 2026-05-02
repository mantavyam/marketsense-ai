"use client";

import { useEffect, useRef, useState } from "react";

import type { SSEEvent } from "./api";

export interface UseSseResult {
  events: SSEEvent[];
  latest: SSEEvent | null;
  done: boolean;
  error: string | null;
}

/**
 * Subscribe to a Server-Sent Events stream. The hook owns the EventSource
 * lifetime and tears it down on unmount or url change.
 */
export function useSSE(url: string | null): UseSseResult {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [latest, setLatest] = useState<SSEEvent | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when URL changes.
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    if (prevUrl.current !== url) {
      prevUrl.current = url;
      setEvents([]);
      setLatest(null);
      setDone(false);
      setError(null);
    }
    if (!url) return;

    const source = new EventSource(url);

    source.onmessage = (raw) => {
      try {
        const parsed: SSEEvent = JSON.parse(raw.data);
        setEvents((prev) => [...prev, parsed]);
        setLatest(parsed);
        if (parsed.status === "error") {
          setError(("message" in parsed && parsed.message) || "Pipeline error");
          setDone(true);
          source.close();
        } else if (parsed.stage === "run_complete") {
          setDone(true);
          source.close();
        }
      } catch (e) {
        // Ignore malformed events
      }
    };

    source.onerror = () => {
      // EventSource fires onerror on normal close too. Treat as done if we
      // already received a terminal event.
      if (!done) {
        // Allow a graceful close: if we are mid-run, mark error.
        setError((curr) => curr ?? "Connection lost");
      }
      source.close();
    };

    return () => {
      source.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { events, latest, done, error };
}
