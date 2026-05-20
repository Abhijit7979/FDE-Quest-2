import type { SupabaseClient } from "@supabase/supabase-js";

import {
  coerceDefinition,
  type Definition,
  type FormField,
} from "@/lib/schema/definition";

export type PublicFormRecord = {
  id: string;
  public_slug: string;
  title: string;
  description: string | null;
  definition: Definition;
  fields: FormField[];
};

export class PublicFormError extends Error {}

export async function fetchPublicFormBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<PublicFormRecord | null> {
  const { data, error } = await supabase
    .from("public_forms")
    .select("id, public_slug, title, description, definition")
    .eq("public_slug", slug)
    .maybeSingle<{
      id: string | null;
      public_slug: string | null;
      title: string | null;
      description: string | null;
      definition: unknown;
    }>();

  if (error) throw new PublicFormError(error.message);
  if (!data?.id || !data.public_slug) return null;

  const { definition, error: defErr } = coerceDefinition(data.definition);
  if (defErr) return null;

  return {
    id: data.id,
    public_slug: data.public_slug,
    title: data.title?.trim() || "Untitled form",
    description: data.description,
    definition,
    fields: definition.fields,
  };
}

export async function submitFormResponse(
  supabase: SupabaseClient,
  formId: string,
  answers: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("form_responses").insert({
    form_id: formId,
    answers,
    respondent_meta: {},
  });
  if (error) throw new PublicFormError(error.message);
}
