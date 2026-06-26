"use client";

/**
 * TanStack Query hooks over the typed `api` gateway. Unified caching, dedup,
 * retry, and loading/error state — replaces hand-rolled fetch + useState + interval.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: api.users.me });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications.list,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useAgentStatus() {
  return useQuery({ queryKey: ["agent-status"], queryFn: api.agents.status });
}

export function useAnalyses(limit = 15) {
  return useQuery({ queryKey: ["analyses", limit], queryFn: () => api.agents.list(limit) });
}

export function useSubscriptions() {
  return useQuery({ queryKey: ["subscriptions"], queryFn: api.subscriptions.my });
}
