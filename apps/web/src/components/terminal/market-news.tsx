import { ExternalLink } from "lucide-react";

const news = [
  { title: "Fed holds rates steady, signals caution on cuts", source: "Reuters", time: "2h ago", impact: "high" },
  { title: "EUR/USD holds above 1.08 ahead of ECB minutes", source: "FXStreet", time: "3h ago", impact: "medium" },
  { title: "Gold surges as dollar weakens on inflation data", source: "Bloomberg", time: "4h ago", impact: "high" },
  { title: "USD/JPY approaches 158 as BoJ remains dovish", source: "Investing", time: "5h ago", impact: "medium" },
  { title: "UK CPI comes in below expectations, GBP dips", source: "ForexFactory", time: "6h ago", impact: "high" },
  { title: "Risk-on sentiment lifts AUD/USD, NZD/USD", source: "DailyFX", time: "7h ago", impact: "low" },
];

const impactColor: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function MarketNews({ symbol }: { symbol: string }) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-border/30">
        <span className="text-[11px] text-muted-foreground">Filtered for {symbol}</span>
      </div>
      {news.map((item, i) => (
        <div key={i} className="flex gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer group">
          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${impactColor[item.impact]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed line-clamp-2 group-hover:text-foreground text-foreground/80">{item.title}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">{item.source} · {item.time}</span>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-muted-foreground" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
