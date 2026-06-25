"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  symbol: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const QUICK_QUESTIONS = [
  "Why is {symbol} moving today?",
  "What's the market sentiment on {symbol}?",
  "Key support & resistance for {symbol}?",
  "Any high-impact events this week?",
];

export function AiChatPanel({ open, onClose, symbol }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! I'm your AI terminal assistant. Ask me anything about ${symbol} — price action, news context, master sentiment, or upcoming events.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([
        {
          role: "assistant",
          content: `Hi! I'm your AI terminal assistant. Ask me anything about ${symbol} — price action, news context, master sentiment, or upcoming events.`,
        },
      ]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, symbol]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (question?: string) => {
    const text = (question ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, symbol }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't reach the AI service right now. Please check your API configuration." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, symbol]);

  if (!open) return null;

  return (
    <div className="fixed right-0 bottom-0 z-40 w-80 h-[480px] bg-zinc-900 border border-zinc-700 rounded-tl-xl shadow-2xl flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold text-zinc-100">AI Terminal</span>
        <span className="ml-1 text-xs text-zinc-500 border border-zinc-700 rounded px-1.5">{symbol}</span>
        <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center mt-0.5">
                <Bot className="h-3.5 w-3.5 text-violet-400" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[84%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <div className="bg-zinc-800 rounded-xl rounded-bl-sm px-3 py-2">
              <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q) => {
            const text = q.replace("{symbol}", symbol);
            return (
              <button
                key={q}
                onClick={() => send(text)}
                className="text-[11px] text-zinc-400 border border-zinc-700 rounded-lg px-2 py-1 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                {text}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-zinc-800 shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Ask about ${symbol}…`}
          disabled={loading}
          className="flex-1 bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="shrink-0 p-1.5 bg-primary rounded-lg disabled:opacity-40 hover:bg-primary/80 transition-colors"
        >
          <Send className="h-3.5 w-3.5 text-primary-foreground" />
        </button>
      </div>
      <div className="px-3 pb-2 text-[10px] text-zinc-600 text-center">
        Ctrl+J to toggle · Not financial advice
      </div>
    </div>
  );
}
