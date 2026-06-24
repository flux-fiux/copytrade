"use client";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Point { date: string; equity: number; drawdown: number; }

interface Props {
  data: Point[];
}

export function EquityCurve({ data }: Props) {
  if (!data.length) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No equity data</div>;
  }

  const option = {
    backgroundColor: "transparent",
    grid: [
      { top: 16, left: 60, right: 24, height: "55%" },
      { top: "72%", left: 60, right: 24, bottom: 32 },
    ],
    xAxis: [
      {
        type: "category",
        data: data.map(d => d.date),
        axisLine: { lineStyle: { color: "#27272a" } },
        axisLabel: { color: "#71717a", fontSize: 11 },
        splitLine: { show: false },
        gridIndex: 0,
      },
      {
        type: "category",
        data: data.map(d => d.date),
        axisLine: { lineStyle: { color: "#27272a" } },
        axisLabel: { show: false },
        splitLine: { show: false },
        gridIndex: 1,
      },
    ],
    yAxis: [
      {
        type: "value",
        axisLabel: {
          color: "#71717a", fontSize: 11,
          formatter: (v: number) => `$${v.toLocaleString()}`,
        },
        splitLine: { lineStyle: { color: "#27272a", type: "dashed" } },
        gridIndex: 0,
      },
      {
        type: "value",
        inverse: true,
        axisLabel: {
          color: "#71717a", fontSize: 11,
          formatter: (v: number) => `-${v.toFixed(1)}%`,
        },
        splitLine: { show: false },
        gridIndex: 1,
      },
    ],
    series: [
      {
        name: "Equity",
        type: "line",
        data: data.map(d => d.equity),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#3b82f6", width: 2 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(59,130,246,0.3)" },
              { offset: 1, color: "rgba(59,130,246,0)" },
            ],
          },
        },
        xAxisIndex: 0, yAxisIndex: 0,
      },
      {
        name: "Drawdown",
        type: "line",
        data: data.map(d => d.drawdown),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#ef4444", width: 1.5 },
        areaStyle: { color: "rgba(239,68,68,0.2)" },
        xAxisIndex: 1, yAxisIndex: 1,
      },
    ],
    tooltip: {
      trigger: "axis",
      backgroundColor: "#18181b",
      borderColor: "#27272a",
      textStyle: { color: "#e5e5e5", fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params : [params];
        const date = p[0]?.axisValue;
        let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p.forEach((item: any) => {
          const val = item.seriesName === "Equity"
            ? `$${Number(item.value).toLocaleString()}`
            : `-${Number(item.value).toFixed(2)}%`;
          html += `<div>${item.seriesName}: ${val}</div>`;
        });
        return html;
      },
    },
  };

  return <ReactECharts option={option} style={{ height: "320px" }} theme="dark" />;
}
