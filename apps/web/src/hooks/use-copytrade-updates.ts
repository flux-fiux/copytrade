"use client";

import { useEffect, useState } from "react";
import { connectSocket } from "@/lib/socket";

export interface ArbMindEvent {
  type: string;
  symbol: string;
  direction?: string;
  volume?: number;
  profit?: number;
  receivedAt: number;
}

export function useArbMindUpdates(followerId: string): ArbMindEvent[] {
  const [events, setEvents] = useState<ArbMindEvent[]>([]);

  useEffect(() => {
    if (!followerId) return;
    const sock = connectSocket();

    sock.emit("subscribe:copytrades", followerId);

    function onArbMind(data: Omit<ArbMindEvent, "receivedAt">) {
      setEvents((prev) => [{ ...data, receivedAt: Date.now() }, ...prev].slice(0, 100));
    }
    sock.on("copytrade", onArbMind);

    return () => {
      sock.off("copytrade", onArbMind);
    };
  }, [followerId]);

  return events;
}
