import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { LeaderboardStats } from "@/components/leaderboard/leaderboard-stats";
import { api, type LeaderboardEntry } from "@/lib/api-client";

export const metadata = { title: "Leaderboard — CopyTrade", description: "Ranked by verified performance. All accounts are independently audited via MetaAPI." };

async function fetchInitial(): Promise<LeaderboardEntry[] | null> {
  try {
    const data = await api.leaderboard.list("1M", 1);
    return data.entries;
  } catch {
    return null;
  }
}

export default async function LeaderboardPage() {
  const initial = await fetchInitial();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Signal Provider Leaderboard</h1>
        <p className="text-muted-foreground mt-2">
          Ranked by verified performance. All accounts are independently audited via MetaAPI.
        </p>
      </div>
      <LeaderboardStats />
      <div className="mt-8">
        <LeaderboardContent initial={initial} />
      </div>
    </div>
  );
}
