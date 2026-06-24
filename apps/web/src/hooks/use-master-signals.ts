"use client";

import { useEffect, useState } from "react";
import { connectSocket } from "@/lib/socket";

export interface LiveSignal {
  masterId: string;
  signalType: "OPEN" | "CLOSE";
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  openPrice?: number;
  closePrice?: number;
  profit?: number;
  receivedAt: number;
}

export function useMasterSignals(masterId: string): LiveSignal[] {
  const [signals, setSignals] = useState<LiveSignal[]>([]);

  useEffect(() => {
    if (!masterId) return;
    const sock = connectSocket();

    sock.emit("subscribe:signals", masterId);

    function onSignal(data: Omit<LiveSignal, "receivedAt">) {
      if (data.masterId !== masterId) return;
      setSignals((prev) => [{ ...data, receivedAt: Date.now() }, ...prev].slice(0, 50));
    }
    sock.on("signal", onSignal);

    return () => {
      sock.off("signal", onSignal);
    };
  }, [masterId]);

  return signals;
}
