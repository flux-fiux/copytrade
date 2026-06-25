"use client";

import { useState } from "react";
import { QuoteBar } from "./quote-bar";
import { SymbolSearch } from "./symbol-search";
import { ChartPlaceholder } from "./chart-placeholder";
import { WatchList } from "./watchlist";
import { MarketNews } from "./market-news";
import { EconomicCalendar } from "./economic-calendar";
import { TerminalSignalFeed } from "./terminal-signal-feed";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function TerminalLayout() {
  const [activeSymbol, setActiveSymbol] = useState("EURUSD");

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      {/* Top quote bar */}
      <QuoteBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — watchlist */}
        <aside className="hidden lg:flex flex-col w-56 border-r border-border/50 shrink-0 overflow-y-auto">
          <WatchList activeSymbol={activeSymbol} onSelect={setActiveSymbol} />
        </aside>

        {/* Main chart area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50">
            <SymbolSearch value={activeSymbol} onChange={setActiveSymbol} />
            <Tabs defaultValue="1H" className="ml-auto">
              <TabsList className="h-7">
                {["1m", "5m", "15m", "1H", "4H", "1D", "1W"].map((tf) => (
                  <TabsTrigger key={tf} value={tf} className="text-[11px] px-2 h-6">{tf}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <ChartPlaceholder symbol={activeSymbol} />
        </div>

        {/* Right sidebar — news + info */}
        <aside className="hidden xl:flex flex-col w-72 border-l border-border/50 shrink-0 overflow-y-auto">
          <Tabs defaultValue="news">
            <TabsList className="w-full rounded-none border-b border-border/50 h-9 bg-transparent">
              <TabsTrigger value="news" className="flex-1 text-xs rounded-none">News</TabsTrigger>
              <TabsTrigger value="signals" className="flex-1 text-xs rounded-none">Signals</TabsTrigger>
              <TabsTrigger value="calendar" className="flex-1 text-xs rounded-none">Calendar</TabsTrigger>
            </TabsList>
            <TabsContent value="news" className="mt-0">
              <MarketNews symbol={activeSymbol} />
            </TabsContent>
            <TabsContent value="signals" className="p-0 mt-0 overflow-y-auto max-h-[calc(100vh-160px)]">
              <TerminalSignalFeed />
            </TabsContent>
            <TabsContent value="calendar" className="p-0 mt-0 overflow-y-auto max-h-[calc(100vh-160px)]">
              <EconomicCalendar />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
