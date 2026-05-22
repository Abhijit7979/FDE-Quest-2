import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EMPTY_DEFINITION } from "@/lib/schema/definition";

export const metadata = { title: "New blank form" };

export default async function CreateBlankFormPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?redirect=/forms/create/blank");
  }

  const { data, error } = await supabase
    .from("forms")
    .insert({
      owner_id: user.id,
      title: "Untitled form",
      definition: EMPTY_DEFINITION,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create blank form");
  }

  redirect(`/forms/${data.id}/edit`);
}
