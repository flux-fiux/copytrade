"use client";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface DayResult { date: string; pnl: number; trades: number; }

interface Props { data: DayResult[]; }

export function TradeCalendar({ data }: Props) {
  if (!data.length) {
    return <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No trade data</div>;
  }

  const values = data.map(d => d.pnl);
  const maxAbs = Math.max(...values.map(Math.abs), 1);

  const option = {
    backgroundColor: "transparent",
    calendar: {
      top: 32,
      left: 40,
      right: 20,
      bottom: 0,
      range: [
        data[0]?.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
        data[data.length - 1]?.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
      ],
      cellSize: ["auto", 18],
      dayLabel: { color: "#71717a", fontSize: 10 },
      monthLabel: { color: "#a1a1aa", fontSize: 11 },
      yearLabel: { show: false },
      itemStyle: { borderWidth: 2, borderColor: "#09090b", color: "#18181b" },
      splitLine: { show: false },
    },
    visualMap: {
      min: -maxAbs,
      max: maxAbs,
      inRange: { color: ["#7f1d1d", "#18181b", "#14532d"] },
      show: false,
    },
    series: [{
      type: "heatmap",
      coordinateSystem: "calendar",
      data: data.map(d => [d.date, d.pnl]),
      label: { show: false },
    }],
    tooltip: {
      backgroundColor: "#18181b",
      borderColor: "#27272a",
      textStyle: { color: "#e5e5e5", fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) =>
        `${p.data[0]}: ${p.data[1] >= 0 ? "+" : ""}$${Number(p.data[1]).toFixed(2)}`,
    },
  };

  return <ReactECharts option={option} style={{ height: "180px" }} theme="dark" />;
}
