import type { SupabaseClient } from "@supabase/supabase-js";
import { customAlphabet } from "nanoid";

import { SKETCHES_BUCKET } from "@/lib/storage/sketches";
import {
  DefinitionSchema,
  type Definition,
} from "@/lib/schema/definition";

// nanoid alphabet matches the PRD: URL-safe, unguessable, 12 chars.
const slugAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const generateSlug = customAlphabet(slugAlphabet, 12);

export type FormStatus = "draft" | "published" | "archived";

export type FormRecord = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  public_slug: string | null;
  definition: unknown;
  sketch_path: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type DraftPatch = {
  title?: string;
  description?: string | null;
  definition?: Definition;
};

export class FormsDataError extends Error {}

export async function saveFormDraft(
  supabase: SupabaseClient,
  formId: string,
  patch: DraftPatch,
): Promise<{ updated_at: string }> {
  const update: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const trimmed = patch.title.trim();
    update.title = trimmed.length > 0 ? trimmed : "Untitled form";
  }
  if (patch.description !== undefined) {
    const trimmed = patch.description?.trim() ?? "";
    update.description = trimmed.length > 0 ? trimmed : null;
  }
  if (patch.definition !== undefined) {
    const parsed = DefinitionSchema.safeParse(patch.definition);
    if (!parsed.success) {
      throw new FormsDataError(
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "definition"}: ${i.message}`)
          .join("; "),
      );
    }
    update.definition = parsed.data;
  }

  if (Object.keys(update).length === 0) {
    const { data, error } = await supabase
      .from("forms")
      .select("updated_at")
      .eq("id", formId)
      .single<{ updated_at: string }>();
    if (error) throw new FormsDataError(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("forms")
    .update(update)
    .eq("id", formId)
    .select("updated_at")
    .single<{ updated_at: string }>();

  if (error) throw new FormsDataError(error.message);
  return data;
}

export async function publishForm(
  supabase: SupabaseClient,
  formId: string,
): Promise<{ public_slug: string; published_at: string }> {
  // Read current row so we don't regenerate an existing slug.
  const { data: current, error: readErr } = await supabase
    .from("forms")
    .select("public_slug, definition")
    .eq("id", formId)
    .single<{ public_slug: string | null; definition: unknown }>();
  if (readErr) throw new FormsDataError(readErr.message);

  const parsed = DefinitionSchema.safeParse(current.definition);
  if (!parsed.success) {
    throw new FormsDataError(
      "Form has validation errors. Fix them before publishing.",
    );
  }
  if (parsed.data.fields.length === 0) {
    throw new FormsDataError("Add at least one field before publishing.");
  }

  const slug = current.public_slug ?? generateSlug();
  const publishedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("forms")
    .update({
      status: "published",
      public_slug: slug,
      published_at: publishedAt,
    })
    .eq("id", formId)
    .select("public_slug, published_at")
    .single<{ public_slug: string; published_at: string }>();

  if (error) throw new FormsDataError(error.message);
  return data;
}

export async function unpublishForm(
  supabase: SupabaseClient,
  formId: string,
): Promise<void> {
  const { error } = await supabase
    .from("forms")
    .update({ status: "draft" })
    .eq("id", formId);
  if (error) throw new FormsDataError(error.message);
}

/**
 * Generates a short-lived signed URL for a sketch in the private bucket.
 * Requires the caller to be the owner (storage RLS enforces this).
 */
export async function signedSketchUrl(
  supabase: SupabaseClient,
  storagePath: string,
  ttlSeconds = 60 * 10,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SKETCHES_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export function buildShareUrl(slug: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/f/${slug}`;
}
