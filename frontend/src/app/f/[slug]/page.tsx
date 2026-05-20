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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createSupabaseServerClient();
    const form = await fetchPublicFormBySlug(supabase, slug);
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
    const supabase = await createSupabaseServerClient();
    form = await fetchPublicFormBySlug(supabase, slug);
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
