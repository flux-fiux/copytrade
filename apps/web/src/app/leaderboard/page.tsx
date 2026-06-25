import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { LeaderboardStats, type PlatformStats } from "@/components/leaderboard/leaderboard-stats";
import { api, type LeaderboardEntry } from "@/lib/api-client";
import { getTranslations } from "next-intl/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const metadata = {
  title: "Leaderboard — CopyTrade",
  description: "Ranked by verified performance. All accounts are independently audited via MetaAPI.",
};

async function fetchInitial(): Promise<LeaderboardEntry[] | null> {
  try {
    const data = await api.leaderboard.list("1M", 1);
    return data.entries;
  } catch {
    return null;
  }
}

async function fetchPlatformStats(): Promise<PlatformStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/leaderboard/platform-stats`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function LeaderboardPage() {
  const [initial, platformStats, t] = await Promise.all([fetchInitial(), fetchPlatformStats(), getTranslations("leaderboard")]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>
      <LeaderboardStats data={platformStats} />
      <div className="mt-8">
        <LeaderboardContent initial={initial} />
      </div>
    </div>
  );
}
