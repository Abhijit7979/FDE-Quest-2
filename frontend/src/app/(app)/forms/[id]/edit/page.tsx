import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedSketchUrl, type FormRecord } from "@/lib/data/forms";
import { coerceDefinition } from "@/lib/schema/definition";
import { FormEditor } from "./form-editor";

export const metadata = { title: "Edit form" };

type Params = { id: string };

export default async function EditFormPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("forms")
    .select(
      "id, owner_id, title, description, status, public_slug, definition, sketch_path, created_at, updated_at, published_at",
    )
    .eq("id", id)
    .maybeSingle<FormRecord>();

  if (error || !data) notFound();
  const form = data;

  const { definition: initialDefinition, error: defError } = coerceDefinition(
    form.definition,
  );

  const sketchUrl = form.sketch_path
    ? await signedSketchUrl(supabase, form.sketch_path)
    : null;

  return (
    <FormEditor
      form={{
        id: form.id,
        title: form.title,
        description: form.description,
        status: form.status,
        public_slug: form.public_slug,
        sketch_path: form.sketch_path,
        updated_at: form.updated_at,
        published_at: form.published_at,
      }}
      initialDefinition={initialDefinition}
      definitionError={defError ? defError.message : null}
      sketchUrl={sketchUrl}
    />
  );
}
