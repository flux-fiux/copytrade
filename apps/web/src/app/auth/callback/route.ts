import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // 只允许站内相对路径，防止开放重定向
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
    ? rawNext
    : "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // Upsert user record in our DB (handles OAuth signups)
      const { user, access_token } = data.session;
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/users/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${access_token}`,
            },
            body: JSON.stringify({
              email: user.email,
              // Sanitize: strip non-allowed chars, truncate, fallback to email prefix
              username: (
                (user.user_metadata?.preferred_username
                  || user.user_metadata?.name
                  || user.email?.split("@")[0]
                  || "user")
                  .replace(/[^a-zA-Z0-9_\-]/g, "_")
                  .replace(/^_+|_+$/g, "")
                  .slice(0, 30)
                  || "user"
              ),
              role: "FOLLOWER",
            }),
          }
        );
      } catch {
        // Non-fatal — user can still use the app; record created on next attempt
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
