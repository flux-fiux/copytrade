"use client";

import { useEffect, useState } from "react";
import { connectSocket } from "@/lib/socket";

export interface CopyTradeEvent {
  type: string;
  symbol: string;
  direction?: string;
  volume?: number;
  profit?: number;
  receivedAt: number;
}

export function useCopyTradeUpdates(followerId: string): CopyTradeEvent[] {
  const [events, setEvents] = useState<CopyTradeEvent[]>([]);

  useEffect(() => {
    if (!followerId) return;
    const sock = connectSocket();

    sock.emit("subscribe:copytrades", followerId);

    function onCopyTrade(data: Omit<CopyTradeEvent, "receivedAt">) {
      setEvents((prev) => [{ ...data, receivedAt: Date.now() }, ...prev].slice(0, 100));
    }
    sock.on("copytrade", onCopyTrade);

    return () => {
      sock.off("copytrade", onCopyTrade);
    };
  }, [followerId]);

  return events;
}
