"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TourActionResult = { ok: true } | { ok: false; error: string };

export async function markTourCompleted(): Promise<TourActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ tour_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
