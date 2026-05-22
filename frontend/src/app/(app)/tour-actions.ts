"use server";

import {
  createSupabaseServerClient,
  getCurrentUser,
} from "@/lib/supabase/server";

/**
 * Marks the in-app product tour as completed for the current user by stamping
 * `profiles.tour_completed_at`. Called when the user finishes *or* skips the
 * tour — either way it should not auto-trigger again on the next session.
 * The header "Take a tour" button replays it regardless of this timestamp.
 */
export async function markTourCompleted(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("profiles")
    .update({ tour_completed_at: new Date().toISOString() })
    .eq("id", user.id);
}
