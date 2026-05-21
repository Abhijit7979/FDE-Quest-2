import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  FilePlus2,
  FileText,
  Layers,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedSketchUrl } from "@/lib/data/forms";
import { formListMeta } from "@/lib/forms/list-meta";
import { FormStatusPill } from "@/components/form-status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

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
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const drafts: DraftRow[] = await Promise.all(
    (rows ?? []).map(async (form) => {
      const { fieldCount, reviewCount } = formListMeta(form.definition);
      const sketchUrl = form.sketch_path
        ? await signedSketchUrl(supabase, form.sketch_path, 60 * 60)
        : null;
      return {
        id: form.id,
        title: form.title,
        status: form.status,
        updated_at: form.updated_at,
        fieldCount,
        reviewCount,
        sketchUrl,
      };
    }),
  );

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
              <li
                key={form.id}
                className="anim-rise"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {i > 0 && <Separator />}
                <Link
                  href={`/forms/${form.id}/edit`}
                  className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/40 sm:px-5"
                >
                  <DraftThumb sketchUrl={form.sketchUrl} index={i} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-display text-lg leading-tight truncate">
                      {form.title || "Untitled form"}
                    </p>
                    <p className="font-mono-tech uppercase tracking-[0.16em] text-[11px] text-muted-foreground">
                      Updated{" "}
                      {new Date(form.updated_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      <span className="mx-2 text-border">·</span>
                      {form.fieldCount}{" "}
                      {form.fieldCount === 1 ? "field" : "fields"}
                      {form.reviewCount > 0 && (
                        <>
                          <span className="mx-2 text-border">·</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {form.reviewCount} to review
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <FormStatusPill status={form.status} />
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyDrafts />
        )}
      </Card>
    </div>
  );
}

function DraftThumb({
  sketchUrl,
  index,
}: {
  sketchUrl: string | null;
  index: number;
}) {
  if (sketchUrl) {
    return (
      <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sketchUrl}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/50 font-mono-tech text-[11px] tracking-[0.18em] text-muted-foreground">
      {String(index + 1).padStart(2, "0")}
    </span>
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