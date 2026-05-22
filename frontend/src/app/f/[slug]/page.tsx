import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  fetchPublicFormBySlug,
  PublicFormError,
} from "@/lib/data/public-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PublicForm } from "./public-form";

type PageProps = {
  params: Promise<{ slug: string }>;
};

// `generateMetadata` and the page body both need the form. Wrapping the
// fetch in `cache()` (keyed on `slug`) collapses them into one DB query.
const getForm = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient();
  return fetchPublicFormBySlug(supabase, slug);
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const form = await getForm(slug);
    if (!form) return { title: "Form not found" };
    return {
      title: form.title,
      description: form.description ?? undefined,
    };
  } catch {
    return { title: "Form" };
  }
}

export default async function PublicFormPage({ params }: PageProps) {
  const { slug } = await params;

  let form;
  try {
    form = await getForm(slug);
  } catch (err) {
    if (err instanceof PublicFormError) {
      throw new Error(err.message);
    }
    throw err;
  }

  if (!form) notFound();

  return (
    <main className="min-h-full flex-1 bg-background">
      <PublicForm form={form} />
    </main>
  );
}
