"use server";

import { revalidatePath } from "next/cache";

import { deleteFormResponse, ResponsesDataError } from "@/lib/data/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeleteResponseResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteResponse(
  responseId: string,
): Promise<DeleteResponseResult> {
  const id = responseId.trim();
  if (!id) return { ok: false, error: "Missing response id." };

  const supabase = await createSupabaseServerClient();
  try {
    await deleteFormResponse(supabase, id);
  } catch (e) {
    const message =
      e instanceof ResponsesDataError ? e.message : "Could not delete response.";
    return { ok: false, error: message };
  }

  revalidatePath("/forms/responses");
  revalidatePath("/home");
  return { ok: true };
}
