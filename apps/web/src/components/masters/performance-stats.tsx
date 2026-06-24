import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Stat {
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  progressColor?: string;
}

const stats: Stat[] = [
  { label: "Total Return", value: "+142.3%", sub: "12-month", progress: 142, progressColor: "bg-emerald-500" },
  { label: "Max Drawdown", value: "8.2%", sub: "Peak-to-trough", progress: 8.2, progressColor: "bg-red-500" },
  { label: "Sharpe Ratio", value: "2.84", sub: "Risk-adjusted" },
  { label: "Sortino Ratio", value: "3.41", sub: "Downside risk" },
  { label: "Win Rate", value: "68.4%", sub: "of all trades", progress: 68.4, progressColor: "bg-blue-500" },
  { label: "Profit Factor", value: "2.21", sub: "Gross profit / loss" },
  { label: "Calmar Ratio", value: "17.4", sub: "Return / max DD" },
  { label: "Avg Trade", value: "4.2h", sub: "Duration" },
];

export function PerformanceStats() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
            <div className="text-lg font-bold">{s.value}</div>
            {s.sub && <div className="text-[11px] text-muted-foreground">{s.sub}</div>}
            {s.progress !== undefined && (
              <div className="mt-2">
                <Progress
                  value={Math.min(s.progress, 100)}
                  className={`h-1 [&>div]:${s.progressColor ?? "bg-primary"}`}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
