import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  color?: "default" | "green" | "blue" | "amber" | "red";
  description?: string;
}

const colorMap = {
  default: "text-foreground",
  green: "text-emerald-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
  red: "text-red-400",
};

const iconBgMap = {
  default: "bg-muted",
  green: "bg-emerald-500/10",
  blue: "bg-blue-500/10",
  amber: "bg-amber-500/10",
  red: "bg-red-500/10",
};

export function StatCard({ title, value, icon: Icon, change, color = "default", description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBgMap[color])}>
          <Icon className={cn("h-4 w-4", colorMap[color])} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", colorMap[color])}>{value}</div>
        {(change !== undefined || description) && (
          <p className="text-xs text-muted-foreground mt-1">
            {change !== undefined && (
              <span className={change >= 0 ? "text-emerald-400" : "text-red-400"}>
                {change >= 0 ? "+" : ""}{change}%
              </span>
            )}
            {description && <span className="ml-1">{description}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
