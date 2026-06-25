"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const RT_URL = process.env.NEXT_PUBLIC_RT_URL || "http://localhost:3001";

let _socket: Socket | null = null;
let _refCount = 0;

function getSocket(): Socket {
  if (!_socket || !_socket.connected) {
    _socket = io(RT_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
  return _socket;
}

interface UseSocketOptions {
  onSignal?: (data: Record<string, unknown>) => void;
  onCopytrade?: (data: Record<string, unknown>) => void;
  onQuote?: (data: Record<string, unknown>) => void;
  masterIds?: string[];
  followerId?: string;
  symbols?: string[];
}

export function useSocket({
  onSignal,
  onCopytrade,
  onQuote,
  masterIds = [],
  followerId,
  symbols = [],
}: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    _refCount++;

    // Subscribe to rooms
    if (masterIds.length > 0) {
      masterIds.forEach((id) => socket.emit("subscribe:signals", id));
    }
    if (followerId) {
      socket.emit("subscribe:copytrades", followerId);
    }
    if (symbols.length > 0) {
      socket.emit("subscribe:market", symbols);
    }

    if (onSignal) socket.on("signal", onSignal);
    if (onCopytrade) socket.on("copytrade", onCopytrade);
    if (onQuote) socket.on("quote", onQuote);

    return () => {
      if (onSignal) socket.off("signal", onSignal);
      if (onCopytrade) socket.off("copytrade", onCopytrade);
      if (onQuote) socket.off("quote", onQuote);

      _refCount--;
      if (_refCount <= 0 && _socket) {
        _socket.disconnect();
        _socket = null;
        _refCount = 0;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followerId, masterIds.join(","), symbols.join(",")]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}
