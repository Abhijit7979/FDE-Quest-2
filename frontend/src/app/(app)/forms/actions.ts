"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  FormsDataError,
  restoreDraftFromTrash,
  softDeleteDraft,
} from "@/lib/data/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormActionResult = { ok: true } | { ok: false; error: string };

function revalidateFormPaths(formId: string) {
  revalidatePath("/home");
  revalidatePath("/forms/drafts");
  revalidatePath("/forms/trash");
  revalidatePath(`/forms/${formId}/edit`);
}

export async function deleteDraft(formId: string): Promise<FormActionResult> {
  const id = formId.trim();
  if (!id) return { ok: false, error: "Missing form id." };

  const supabase = await createSupabaseServerClient();
  try {
    await softDeleteDraft(supabase, id);
  } catch (e) {
    const message =
      e instanceof FormsDataError ? e.message : "Could not move draft to trash.";
    return { ok: false, error: message };
  }

  revalidateFormPaths(id);
  return { ok: true };
}

export async function deleteDraftAndRedirect(
  formId: string,
): Promise<FormActionResult> {
  const result = await deleteDraft(formId);
  if (!result.ok) return result;
  redirect("/forms/trash");
}

export async function restoreDraft(formId: string): Promise<FormActionResult> {
  const id = formId.trim();
  if (!id) return { ok: false, error: "Missing form id." };

  const supabase = await createSupabaseServerClient();
  try {
    await restoreDraftFromTrash(supabase, id);
  } catch (e) {
    const message =
      e instanceof FormsDataError ? e.message : "Could not restore draft.";
    return { ok: false, error: message };
  }

  revalidateFormPaths(id);
  return { ok: true };
}
