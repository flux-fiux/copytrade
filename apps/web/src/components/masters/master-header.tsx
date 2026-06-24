import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, Calendar, CheckCircle } from "lucide-react";

interface MasterHeaderProps {
  name: string;
  broker: string;
  grade: string;
  returnPct: number;
  followers: number;
  tradingDays: number;
  isVerified: boolean;
}

const gradeStyle: Record<string, string> = {
  "A+": "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
  "A": "border-green-500/50 text-green-400 bg-green-500/10",
  "B+": "border-blue-500/50 text-blue-400 bg-blue-500/10",
  "B": "border-yellow-500/50 text-yellow-400 bg-yellow-500/10",
};

export function MasterHeader({ name, broker, grade, returnPct, followers, tradingDays, isVerified }: MasterHeaderProps) {
  return (
    <div className="border-b border-border/40 bg-muted/10 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{name}</h1>
              <Badge className={cn("text-sm font-bold px-2 border", gradeStyle[grade] ?? "")}>
                {grade}
              </Badge>
              {isVerified && (
                <Badge variant="outline" className="border-primary/40 text-primary gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mb-3">{broker}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <TrendingUp className="h-4 w-4" />
                +{returnPct}% return
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                {followers.toLocaleString()} followers
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {tradingDays} days track record
              </span>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button className={cn(buttonVariants({ variant: "outline" }))}>
              Watch
            </button>
            <button className={cn(buttonVariants({}), "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white")}>
              Subscribe — $49/mo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
