import Link from "next/link";
import { AlertCircle, FilePlus2, FileText, Layers } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedSketchUrls } from "@/lib/data/forms";
import { formListMeta } from "@/lib/forms/list-meta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

import { DraftListRow } from "./draft-list-row";

export const metadata = { title: "Drafts" };

type DraftRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  fieldCount: number;
  reviewCount: number;
  sketchUrl: string | null;
};

export default async function DraftsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: rows, error } = await supabase
    .from("forms")
    .select("id, title, status, updated_at, sketch_path, definition")
    .in("status", ["draft", "archived"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const sketchPaths = (rows ?? [])
    .map((form) => form.sketch_path)
    .filter((path): path is string => Boolean(path));
  const sketchUrls = await signedSketchUrls(supabase, sketchPaths, 60 * 60);

  const drafts: DraftRow[] = (rows ?? []).map((form) => {
    const { fieldCount, reviewCount } = formListMeta(form.definition);
    return {
      id: form.id,
      title: form.title,
      status: form.status,
      updated_at: form.updated_at,
      fieldCount,
      reviewCount,
      sketchUrl: form.sketch_path
        ? sketchUrls.get(form.sketch_path) ?? null
        : null,
    };
  });

  const reviewTotal = drafts.reduce((n, d) => n + d.reviewCount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-10 anim-rise">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
            / 02 · Drafts
          </p>
          <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1]">
            Unpublished <em className="text-brand">work</em>,
            <br />
            ready to ship.
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Every form still in draft or archived lives here — sorted by when you
            last touched it. Open one to edit, review AI flags, and publish when
            you&apos;re ready.
          </p>
        </div>
        <Button
          size="lg"
          className="h-11 shrink-0 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          render={<Link href="/forms/create" />}
        >
          <FilePlus2 className="size-4" />
          New from sketch
        </Button>
      </header>

      {drafts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <StatChip
            label="Unpublished"
            value={drafts.length}
            icon={Layers}
            accent
          />
          <StatChip
            label="Fields total"
            value={drafts.reduce((n, d) => n + d.fieldCount, 0)}
            icon={FileText}
          />
          {reviewTotal > 0 && (
            <StatChip
              label="Needs review"
              value={reviewTotal}
              icon={AlertCircle}
              warn
            />
          )}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {drafts.length > 0 ? (
          <ul>
            {drafts.map((form, i) => (
              <DraftListRow
                key={form.id}
                id={form.id}
                title={form.title}
                status={form.status}
                updated_at={form.updated_at}
                fieldCount={form.fieldCount}
                reviewCount={form.reviewCount}
                sketchUrl={form.sketchUrl}
                index={i}
                showSeparator={i > 0}
              />
            ))}
          </ul>
        ) : (
          <EmptyDrafts />
        )}
      </Card>
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  accent,
  warn,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-lg border px-4 py-2.5",
        accent && "border-brand/40 bg-brand-tint",
        warn && "border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30",
        !accent && !warn && "border-border bg-card",
      )}
    >
      <Icon
        className={cn(
          "size-4",
          accent && "text-brand",
          warn && "text-amber-600 dark:text-amber-400",
          !accent && !warn && "text-muted-foreground",
        )}
      />
      <div className="leading-tight">
        <p className="font-mono-tech uppercase tracking-[0.18em] text-[11px] text-muted-foreground">
          {label}
        </p>
        <p className="font-display text-2xl">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function EmptyDrafts() {
  return (
    <EmptyState
      label="No unpublished forms"
      headline={<>Your draft shelf is <em className="text-brand">empty</em>.</>}
      description="Upload a sketch or publish from the editor — finished forms move off this list automatically."
      action={
        <Button
          className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          render={<Link href="/forms/create" />}
        >
          <FilePlus2 className="size-4" />
          Create from sketch
        </Button>
      }
    />
  );
}