"use client";

import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SymbolSearch({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-bold">{value}</span>
        <span className="text-[10px] text-muted-foreground border border-border/50 rounded px-1">▾</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-lg font-bold">1.08423</span>
        <span className="text-xs text-emerald-400 font-medium">+0.11%</span>
      </div>
    </div>
  );
}
