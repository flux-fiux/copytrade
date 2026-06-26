"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./supabase/server";

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  // Ensure user record exists (covers OAuth→email merge edge cases)
  if (data.session) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ email, username: email.split("@")[0], role: "FOLLOWER" }),
      });
    } catch {
      // Non-fatal
    }
  }
  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  if (data.url) redirect(data.url);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string,
  _role: string
) {
  // Auto-confirmed signup via the backend (admin) so the user can log in
  // immediately — no email-confirmation round-trip. Also provisions the profile.
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${api}/api/v1/users/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, username }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return { error: e.detail ?? "Sign up failed" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}
