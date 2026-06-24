"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

const periods = ["1M", "3M", "6M", "1Y", "ALL"];
const categories = [
  { label: "All", count: 248 },
  { label: "Forex", count: 142 },
  { label: "Gold/Silver", count: 48 },
  { label: "Crypto CFD", count: 31 },
  { label: "Indices", count: 27 },
];

export function LeaderboardFilters() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Period */}
        <Tabs defaultValue="1M">
          <TabsList className="h-8">
            {periods.map((p) => (
              <TabsTrigger key={p} value={p} className="text-xs px-3 h-7">{p}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Category */}
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(({ label, count }) => (
            <button
              key={label}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                ${label === "All"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
            >
              {label}
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{count}</Badge>
            </button>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" className="gap-2">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
      </Button>
    </div>
  );
}
