import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, Award, Activity } from "lucide-react";

const stats = [
  { label: "Verified Providers", value: "248", icon: Award, change: "+12 this month" },
  { label: "Active Followers", value: "9,840", icon: Users, change: "+340 this week" },
  { label: "Avg Sharpe Ratio", value: "1.82", icon: TrendingUp, change: "Top 10 average" },
  { label: "Trades Today", value: "14,203", icon: Activity, change: "Live updating" },
];

export function LeaderboardStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, change }) => (
        <Card key={label} className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{change}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
