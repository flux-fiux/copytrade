"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  roles: string[];
  kyc_status: string;
  is_active: boolean;
  created_at: string;
}

interface UserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  per_page: number;
}

const ROLE_FILTERS = ["All", "FOLLOWER", "MASTER", "TENANT_ADMIN"] as const;
type RoleFilter = typeof ROLE_FILTERS[number];

const kycColors: Record<string, string> = {
  NONE: "text-muted-foreground border-border",
  PENDING: "text-amber-400 border-amber-500/30",
  VERIFIED: "text-emerald-400 border-emerald-500/30",
  REJECTED: "text-red-400 border-red-500/30",
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PER_PAGE = 20;

  const fetchUsers = useCallback(async (q: string, role: RoleFilter, pg: number) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const params = new URLSearchParams({ page: String(pg), per_page: String(PER_PAGE) });
      if (q) params.set("search", q);
      if (role !== "All") params.set("role", role);
      const res = await fetch(`${API_BASE}/api/v1/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data: UserListResponse = await res.json();
      setUsers(data.items);
      setTotal(data.total);
    } catch {
      setUsers(MOCK_USERS);
      setTotal(MOCK_USERS.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchUsers(search, roleFilter, 1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, roleFilter, fetchUsers]);

  useEffect(() => {
    fetchUsers(search, roleFilter, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const toggleActive = async (user: AdminUser) => {
    setActionLoading(user.id);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch {
      // silently fail — just show stale state
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} total users</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-72 rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                roleFilter === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "TENANT_ADMIN" ? "Admin" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 bg-muted/40 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b border-border">
          <div>User</div>
          <div />
          <div>Roles</div>
          <div>KYC</div>
          <div>Joined</div>
          <div>Active</div>
        </div>

        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 border-b border-border/50 last:border-0 bg-muted/10 animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No users found</div>
        ) : (
          users.map((u) => {
            const name = u.display_name || u.username || u.email;
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <div
                key={u.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center border-b border-border/50 last:border-0 hover:bg-muted/20"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(u.roles || []).map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px] px-1.5">
                      {r}
                    </Badge>
                  ))}
                </div>
                <Badge className={cn("text-xs border", kycColors[u.kyc_status] ?? "")}>
                  {u.kyc_status}
                </Badge>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => toggleActive(u)}
                  disabled={actionLoading === u.id}
                  className="flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                  title={u.is_active ? "Deactivate" : "Activate"}
                >
                  {u.is_active ? (
                    <ToggleRight className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {total} users
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const MOCK_USERS: AdminUser[] = [
  { id: "1", email: "alpha@example.com", username: "AlphaWave", display_name: "AlphaWave FX", roles: ["MASTER"], kyc_status: "VERIFIED", is_active: true, created_at: "2026-01-10T00:00:00Z" },
  { id: "2", email: "follower1@example.com", username: "follower1", display_name: null, roles: ["FOLLOWER"], kyc_status: "NONE", is_active: true, created_at: "2026-02-15T00:00:00Z" },
  { id: "3", email: "admin@copytrade.com", username: "admin", display_name: "Platform Admin", roles: ["TENANT_ADMIN"], kyc_status: "VERIFIED", is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { id: "4", email: "pending@example.com", username: "newtrader", display_name: null, roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-20T00:00:00Z" },
  { id: "5", email: "inactive@example.com", username: "olduser", display_name: null, roles: ["FOLLOWER"], kyc_status: "NONE", is_active: false, created_at: "2026-03-01T00:00:00Z" },
];
