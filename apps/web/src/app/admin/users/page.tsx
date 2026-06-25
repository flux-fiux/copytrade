"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, ChevronLeft, ChevronRight, MoreHorizontal,
  ShieldCheck, ShieldOff, UserX, UserCheck, ExternalLink, RefreshCw, BadgeCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  is_certified?: boolean;
  created_at: string;
  apply_strategy?: string | null;
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
  NONE:     "text-muted-foreground border-border",
  PENDING:  "text-amber-400 border-amber-500/30",
  VERIFIED: "text-emerald-400 border-emerald-500/30",
  REJECTED: "text-red-400 border-red-500/30",
};

const PER_PAGE = 20;

async function getToken() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

async function patchUser(id: string, token: string, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/v1/admin/users/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Patch failed");
  return res.json() as Promise<AdminUser>;
}

export default function UsersPage() {
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [busy, setBusy]             = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = useCallback(async (q: string, role: RoleFilter, pg: number) => {
    setLoading(true);
    try {
      const token = await getToken();
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
    debounceRef.current = setTimeout(() => { setPage(1); fetchUsers(search, roleFilter, 1); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, roleFilter, fetchUsers]);

  useEffect(() => { fetchUsers(search, roleFilter, page); }, [page]); // eslint-disable-line

  const patchAndUpdate = async (user: AdminUser, payload: Record<string, unknown>, successMsg: string) => {
    setBusy(user.id);
    try {
      const token = await getToken();
      const updated = await patchUser(user.id, token, payload);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updated } : u));
      showToast(successMsg);
    } catch {
      showToast("Action failed — try again", false);
    } finally {
      setBusy(null);
    }
  };

  const promoteToMaster = (u: AdminUser) =>
    patchAndUpdate(u, { roles: [...(u.roles ?? []).filter(r => r !== "FOLLOWER"), "MASTER"], kyc_status: "VERIFIED" },
      `${u.display_name || u.email} promoted to Master`);

  const revokeMaster = (u: AdminUser) =>
    patchAndUpdate(u, { roles: (u.roles ?? []).filter(r => r !== "MASTER") },
      `Master role revoked for ${u.display_name || u.email}`);

  const toggleActive = (u: AdminUser) =>
    patchAndUpdate(u, { is_active: !u.is_active },
      u.is_active ? `${u.email} deactivated` : `${u.email} reactivated`);

  const setKyc = (u: AdminUser, status: string) =>
    patchAndUpdate(u, { kyc_status: status }, `KYC set to ${status}`);

  const toggleCertify = (u: AdminUser) =>
    patchAndUpdate(u, { is_certified: !u.is_certified },
      u.is_certified ? `${u.email} certification removed` : `${u.email} certified`);

  const totalPages = Math.ceil(total / PER_PAGE);
  const isMaster = (u: AdminUser) => (u.roles ?? []).includes("MASTER");

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
          toast.ok ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} total users</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchUsers(search, roleFilter, page)} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search email or username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-72 rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          {ROLE_FILTERS.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                roleFilter === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "TENANT_ADMIN" ? "Admin" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 bg-muted/40 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b border-border">
          <div>User</div>
          <div />
          <div>Roles</div>
          <div>KYC</div>
          <div>Joined</div>
          <div>Actions</div>
        </div>

        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-border/50 last:border-0 animate-pulse bg-muted/10" />
          ))
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No users found</div>
        ) : (
          users.map(u => {
            const name = u.display_name || u.username || u.email;
            const initials = name.slice(0, 2).toUpperCase();
            const isBusy = busy === u.id;
            return (
              <div
                key={u.id}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center",
                  "border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors",
                  !u.is_active && "opacity-50"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {!u.is_active && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inactive</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.apply_strategy && <p className="text-[10px] text-amber-400 truncate mt-0.5">📋 {u.apply_strategy}</p>}
                </div>

                {/* Roles */}
                <div className="flex gap-1 flex-wrap min-w-0">
                  {(u.roles ?? []).map(r => (
                    <Badge key={r} variant="secondary" className="text-[10px] px-1.5">{r}</Badge>
                  ))}
                </div>

                {/* KYC */}
                <Badge className={cn("text-xs border", kycColors[u.kyc_status] ?? "")}>
                  {u.kyc_status}
                </Badge>

                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>

                {/* Actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={isBusy}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{u.email}</div>
                    <DropdownMenuSeparator />

                    {/* Role actions */}
                    {!isMaster(u) ? (
                      <DropdownMenuItem onClick={() => promoteToMaster(u)} className="gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Promote to Master
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => revokeMaster(u)} className="gap-2">
                        <ShieldOff className="h-3.5 w-3.5 text-amber-400" />
                        Revoke Master Role
                      </DropdownMenuItem>
                    )}

                    {isMaster(u) && (
                      <DropdownMenuItem onClick={() => toggleCertify(u)} className="gap-2">
                        <BadgeCheck className="h-3.5 w-3.5 text-sky-400" />
                        {u.is_certified ? "Remove Certification" : "Certify Master"}
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    {/* KYC */}
                    {u.kyc_status !== "VERIFIED" && (
                      <DropdownMenuItem onClick={() => setKyc(u, "VERIFIED")} className="gap-2">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Set KYC Verified
                      </DropdownMenuItem>
                    )}
                    {u.kyc_status !== "REJECTED" && u.kyc_status !== "NONE" && (
                      <DropdownMenuItem onClick={() => setKyc(u, "REJECTED")} className="gap-2">
                        <UserX className="h-3.5 w-3.5 text-red-400" />
                        Reject KYC
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    {/* Active toggle */}
                    <DropdownMenuItem
                      onClick={() => toggleActive(u)}
                      className={cn("gap-2", u.is_active && "text-destructive focus:text-destructive")}
                    >
                      {u.is_active
                        ? <><UserX className="h-3.5 w-3.5" /> Deactivate User</>
                        : <><UserCheck className="h-3.5 w-3.5" /> Reactivate User</>
                      }
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="gap-2"
                      onClick={() => window.open("/leaderboard", "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View on Leaderboard
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages} · {total.toLocaleString()} users</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const MOCK_USERS: AdminUser[] = [
  { id: "1", email: "alpha@example.com", username: "AlphaWave", display_name: "AlphaWave FX", roles: ["MASTER"], kyc_status: "VERIFIED", is_active: true, created_at: "2026-01-10T00:00:00Z", apply_strategy: "Momentum FX" },
  { id: "2", email: "follower1@example.com", username: "follower1", display_name: null, roles: ["FOLLOWER"], kyc_status: "NONE", is_active: true, created_at: "2026-02-15T00:00:00Z" },
  { id: "3", email: "admin@copytrade.com", username: "admin", display_name: "Platform Admin", roles: ["TENANT_ADMIN"], kyc_status: "VERIFIED", is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { id: "4", email: "pending@example.com", username: "newtrader", display_name: null, roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-20T00:00:00Z", apply_strategy: "Gold Scalper Pro" },
  { id: "5", email: "inactive@example.com", username: "olduser", display_name: null, roles: ["FOLLOWER"], kyc_status: "NONE", is_active: false, created_at: "2026-03-01T00:00:00Z" },
  { id: "6", email: "goldmaster@example.com", username: "GoldPro", display_name: "Gold Trader Pro", roles: ["MASTER"], kyc_status: "VERIFIED", is_active: true, created_at: "2026-02-01T00:00:00Z" },
  { id: "7", email: "rejected@example.com", username: "tryagain", display_name: null, roles: ["FOLLOWER"], kyc_status: "REJECTED", is_active: true, created_at: "2026-05-10T00:00:00Z" },
];
