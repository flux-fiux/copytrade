import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { LeaderboardFilters } from "@/components/leaderboard/leaderboard-filters";
import { LeaderboardStats } from "@/components/leaderboard/leaderboard-stats";
import { api, type LeaderboardEntry } from "@/lib/api-client";

export const metadata = { title: "Leaderboard — CopyTrade" };

async function fetchEntries(): Promise<LeaderboardEntry[] | null> {
  try {
    const data = await api.leaderboard.list("1M", 1);
    return data.entries;
  } catch {
    return null;
  }
}

export default async function LeaderboardPage() {
  const entries = await fetchEntries();

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
        <LeaderboardFilters />
        <div className="mt-4">
          <LeaderboardTable apiEntries={entries} />
        </div>
      </div>
    </div>
  );
}
