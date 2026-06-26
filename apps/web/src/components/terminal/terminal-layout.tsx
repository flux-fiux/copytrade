"use client";

import { useState, useEffect, useCallback } from "react";
import { QuoteBar } from "./quote-bar";
import { SymbolSearch } from "./symbol-search";
import { ChartPlaceholder } from "./chart-placeholder";
import { WatchList } from "./watchlist";
import { MarketNews } from "./market-news";
import { EconomicCalendar } from "./economic-calendar";
import { TerminalSignalFeed } from "./terminal-signal-feed";
import { CommandPalette } from "./command-palette";
import { AiAnalystPanel } from "./ai-analyst-panel";
import { MasterTradesPanel } from "./master-trades-panel";
import { CommunitySentiment } from "./community-sentiment";
import { MacroPanel } from "./macro-panel";
import { ForexScreener } from "./forex-screener";
import { CorrelationHeatmap } from "./correlation-heatmap";
import { PositionCalculator } from "./position-calculator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Command, Calculator } from "lucide-react";
import { useTranslations } from "next-intl";

const TF_TO_MINUTES: Record<string, number> = {
  "1m": 1, "5m": 5, "15m": 15, "1H": 60, "4H": 240, "1D": 1440, "1W": 10080,
};

export function TerminalLayout() {
  const t = useTranslations("terminal");
  const [activeSymbol, setActiveSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<string>("1H");
  const [leftTab, setLeftTab] = useState("watchlist");
  const [rightTab, setRightTab] = useState("signals");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const handleTabChange = useCallback((tab: string) => {
    const rightTabs = ["calendar", "news", "signals", "masters", "macro"];
    if (rightTabs.includes(tab)) setRightTab(tab);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setAiOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setCalcOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setAiOpen(false);
        setCalcOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      <QuoteBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — watchlist + screener */}
        <aside className="hidden lg:flex flex-col w-56 border-r border-border/50 shrink-0">
          <Tabs value={leftTab} onValueChange={setLeftTab} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="w-full rounded-none border-b border-border/50 h-8 bg-transparent shrink-0">
              <TabsTrigger value="watchlist" className="flex-1 text-[11px] rounded-none h-7">{t("tab_watch")}</TabsTrigger>
              <TabsTrigger value="screener" className="flex-1 text-[11px] rounded-none h-7">{t("tab_screen")}</TabsTrigger>
            </TabsList>
            <TabsContent value="watchlist" className="mt-0 overflow-y-auto flex-1">
              <WatchList activeSymbol={activeSymbol} onSelect={setActiveSymbol} />
            </TabsContent>
            <TabsContent value="screener" className="mt-0 flex-1 overflow-hidden">
              <ForexScreener onSymbolSelect={(s) => { setActiveSymbol(s); setLeftTab("watchlist"); }} />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Main chart */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50">
            <SymbolSearch value={activeSymbol} onChange={setActiveSymbol} />
            <Tabs value={timeframe} onValueChange={setTimeframe} className="ml-auto">
              <TabsList className="h-7">
                {Object.keys(TF_TO_MINUTES).map((tf) => (
                  <TabsTrigger key={tf} value={tf} className="text-[11px] px-2 h-6">{tf}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setCmdOpen(true)}
                title={t("title_cmd")}
                className="flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
              >
                <Command className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[10px]">⌃K</span>
              </button>
              <button
                onClick={() => setCalcOpen((v) => !v)}
                title={t("title_calc")}
                className={`flex items-center gap-1 h-7 px-2 rounded text-xs transition-colors border ${
                  calcOpen
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent hover:border-border/50"
                }`}
              >
                <Calculator className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[10px]">{t("btn_calc")}</span>
              </button>
              <button
                onClick={() => setAiOpen((v) => !v)}
                title={t("title_ai")}
                className={`flex items-center gap-1 h-7 px-2 rounded text-xs transition-colors border ${
                  aiOpen
                    ? "text-primary bg-primary/10 border-primary/30"
                    : "text-primary/80 hover:text-primary hover:bg-primary/10 border-primary/20 hover:border-primary/40"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[10px]">{t("btn_ai")}</span>
              </button>
            </div>
          </div>
          <ChartPlaceholder symbol={activeSymbol} resolution={TF_TO_MINUTES[timeframe] * 60} timeframeLabel={timeframe} />
        </div>

        {/* Right sidebar */}
        <aside className="hidden xl:flex flex-col w-72 border-l border-border/50 shrink-0 overflow-y-auto">
          <CommunitySentiment symbol={activeSymbol} />
          <div className="border-t border-border/50" />
          <Tabs value={rightTab} onValueChange={setRightTab}>
            <TabsList className="w-full rounded-none border-b border-border/50 h-9 bg-transparent">
              <TabsTrigger value="signals" className="flex-1 text-[10px] rounded-none">{t("tab_signals")}</TabsTrigger>
              <TabsTrigger value="masters" className="flex-1 text-[10px] rounded-none">{t("tab_masters")}</TabsTrigger>
              <TabsTrigger value="macro" className="flex-1 text-[10px] rounded-none">{t("tab_macro")}</TabsTrigger>
              <TabsTrigger value="corr" className="flex-1 text-[10px] rounded-none">{t("tab_corr")}</TabsTrigger>
              <TabsTrigger value="news" className="flex-1 text-[10px] rounded-none">{t("tab_news")}</TabsTrigger>
              <TabsTrigger value="calendar" className="flex-1 text-[10px] rounded-none">{t("tab_cal")}</TabsTrigger>
            </TabsList>
            <TabsContent value="signals" className="p-0 mt-0 overflow-y-auto max-h-[calc(100vh-240px)]">
              <TerminalSignalFeed />
            </TabsContent>
            <TabsContent value="masters" className="p-0 mt-0 overflow-y-auto max-h-[calc(100vh-240px)]">
              <MasterTradesPanel symbol={activeSymbol} />
            </TabsContent>
            <TabsContent value="macro" className="p-0 mt-0 overflow-y-auto max-h-[calc(100vh-240px)]">
              <MacroPanel />
            </TabsContent>
            <TabsContent value="corr" className="p-0 mt-0 overflow-y-auto max-h-[calc(100vh-240px)]">
              <CorrelationHeatmap />
            </TabsContent>
            <TabsContent value="news" className="mt-0">
              <MarketNews symbol={activeSymbol} />
            </TabsContent>
            <TabsContent value="calendar" className="p-0 mt-0 overflow-y-auto max-h-[calc(100vh-240px)]">
              <EconomicCalendar />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onSymbolSelect={setActiveSymbol}
        onTabChange={handleTabChange}
      />
      <AiAnalystPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        symbol={activeSymbol}
      />
      <PositionCalculator
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        symbol={activeSymbol}
      />
    </div>
  );
}
