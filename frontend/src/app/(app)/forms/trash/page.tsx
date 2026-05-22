import Link from "next/link";
import { Archive, FilePlus2 } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formListMeta } from "@/lib/forms/list-meta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

import { TrashRow } from "./trash-row";

export const metadata = { title: "Trash" };

type TrashItem = {
  id: string;
  title: string;
  deleted_at: string;
  fieldCount: number;
};

export default async function TrashPage() {
  const supabase = await createSupabaseServerClient();

  const { data: rows, error } = await supabase
    .from("forms")
    .select("id, title, deleted_at, definition")
    .eq("status", "draft")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const items: TrashItem[] = (rows ?? []).map((form) => {
    const { fieldCount } = formListMeta(form.definition);
    return {
      id: form.id,
      title: form.title,
      deleted_at: form.deleted_at as string,
      fieldCount,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-10 anim-rise">
      <header className="space-y-3">
        <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
          / 03 · Trash
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1]">
          Deleted <em className="text-brand">drafts</em>
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
          Drafts stay here for 24 hours after you delete them. Restore anytime
          before permanent removal — sketches are kept until purge.
        </p>
      </header>

      <Card className="overflow-hidden p-0">
        {items.length > 0 ? (
          <ul>
            {items.map((item, i) => (
              <TrashRow
                key={item.id}
                id={item.id}
                title={item.title}
                deleted_at={item.deleted_at}
                fieldCount={item.fieldCount}
                showSeparator={i > 0}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            label="Trash is empty"
            headline={
              <>
                Nothing in <em className="text-brand">trash</em>.
              </>
            }
            description="Deleted drafts appear here for 24 hours. After that they are permanently removed."
            action={
              <Button
                className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
                render={<Link href="/forms/drafts" />}
              >
                <Archive className="size-4" />
                Back to drafts
              </Button>
            }
          />
        )}
      </Card>

      {items.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
            render={<Link href="/forms/create" />}
          >
            <FilePlus2 className="size-4" />
            New from sketch
          </Button>
        </div>
      )}
    </div>
  );
}
