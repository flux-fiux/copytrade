"use client";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
  winRate: number;
  sharpe: number;
  returnPct: number;
  consistency: number;
  riskScore: number;
}

export function StatsRadar({ winRate, sharpe, returnPct, consistency, riskScore }: Props) {
  const option = {
    backgroundColor: "transparent",
    radar: {
      indicator: [
        { name: "Win Rate", max: 100 },
        { name: "Sharpe", max: 100 },
        { name: "Return", max: 100 },
        { name: "Consistency", max: 100 },
        { name: "Risk Score", max: 100 },
      ],
      axisLine: { lineStyle: { color: "#27272a" } },
      splitLine: { lineStyle: { color: "#27272a" } },
      splitArea: { areaStyle: { color: ["transparent"] } },
      name: { textStyle: { color: "#a1a1aa", fontSize: 11 } },
    },
    series: [{
      type: "radar",
      data: [{
        value: [
          winRate,
          Math.min(sharpe / 5 * 100, 100),
          Math.min(returnPct / 200 * 100, 100),
          consistency,
          riskScore,
        ],
        areaStyle: { color: "rgba(59,130,246,0.2)" },
        lineStyle: { color: "#3b82f6", width: 2 },
        itemStyle: { color: "#3b82f6" },
      }],
    }],
    tooltip: {
      backgroundColor: "#18181b",
      borderColor: "#27272a",
      textStyle: { color: "#e5e5e5" },
    },
  };

  return <ReactECharts option={option} style={{ height: "220px" }} theme="dark" />;
}
