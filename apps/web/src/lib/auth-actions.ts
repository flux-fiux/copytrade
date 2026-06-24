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
  role: string
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  if (data.user) {
    try {
      const session = data.session;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ email, username, role }),
      });
    } catch {
      // Profile creation is best-effort; auth succeeded
    }
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}
