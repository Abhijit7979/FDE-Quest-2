import Link from "next/link";
import {
  ArrowUpRight,
  Globe2,
  Inbox,
  MessageSquare,
  Radio,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedSketchUrls } from "@/lib/data/forms";
import { formListMeta } from "@/lib/forms/list-meta";
import { FormStatusPill } from "@/components/form-status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { ShareLinkActions } from "./share-link-actions";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Published" };

type PublishedRow = {
  id: string;
  title: string;
  status: string;
  published_at: string;
  public_slug: string;
  fieldCount: number;
  responseCount: number;
  sketchUrl: string | null;
};

export default async function PublishedPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: rows, error }, { data: respRows, error: respErr }] =
    await Promise.all([
      supabase
        .from("forms")
        .select(
          "id, title, status, published_at, public_slug, sketch_path, definition",
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false }),
      supabase.from("form_responses").select("form_id"),
    ]);

  if (error) throw new Error(error.message);
  if (respErr) throw new Error(respErr.message);

  const responseCounts = new Map<string, number>();
  for (const r of respRows ?? []) {
    responseCounts.set(r.form_id, (responseCounts.get(r.form_id) ?? 0) + 1);
  }

  const sketchPaths = (rows ?? [])
    .map((form) => form.sketch_path)
    .filter((path): path is string => Boolean(path));
  const sketchUrls = await signedSketchUrls(supabase, sketchPaths, 60 * 60);

  const published: PublishedRow[] = (rows ?? []).map((form) => {
    const { fieldCount } = formListMeta(form.definition);
    return {
      id: form.id,
      title: form.title,
      status: form.status,
      published_at: form.published_at!,
      public_slug: form.public_slug!,
      fieldCount,
      responseCount: responseCounts.get(form.id) ?? 0,
      sketchUrl: form.sketch_path
        ? sketchUrls.get(form.sketch_path) ?? null
        : null,
    };
  });

  const totalResponses = published.reduce((n, p) => n + p.responseCount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-10 anim-rise">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
            / 03 · Published
          </p>
          <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1]">
            Live <em className="text-brand">forms</em>,
            <br />
            ready to share.
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Every published form with a public link lives here — sorted by when
            you went live. Copy the share URL, open the public page, or jump to
            responses.
          </p>
        </div>
        <Button
          size="lg"
          variant="outline"
          className="h-11 shrink-0 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          render={<Link href="/forms/responses" />}
        >
          <Inbox className="size-4" />
          All responses
        </Button>
      </header>

      {published.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <StatChip
            label="Published"
            value={published.length}
            icon={Radio}
            accent
          />
          <StatChip
            label="Total responses"
            value={totalResponses}
            icon={MessageSquare}
          />
          <StatChip label="Live links" value={published.length} icon={Globe2} />
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {published.length > 0 ? (
          <ul>
            {published.map((form, i) => (
              <li
                key={form.id}
                className="anim-rise"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {i > 0 && <Separator />}
                <div className="group flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <Link
                    href={`/forms/${form.id}/edit`}
                    className="flex min-w-0 flex-1 items-center gap-4 transition-colors hover:opacity-90"
                  >
                    <PublishedThumb sketchUrl={form.sketchUrl} index={i} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-display text-lg leading-tight truncate">
                        {form.title || "Untitled form"}
                      </p>
                      <p className="font-mono-tech uppercase tracking-[0.16em] text-[11px] text-muted-foreground">
                        Live since{" "}
                        {new Date(form.published_at).toLocaleString(
                          undefined,
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          },
                        )}
                        <span className="mx-2 text-border">·</span>
                        {form.fieldCount}{" "}
                        {form.fieldCount === 1 ? "field" : "fields"}
                        <span className="mx-2 text-border">·</span>
                        {form.responseCount}{" "}
                        {form.responseCount === 1
                          ? "response"
                          : "responses"}
                      </p>
                    </div>
                    <FormStatusPill status={form.status} />
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand sm:mr-1" />
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    {form.public_slug && (
                      <ShareLinkActions slug={form.public_slug} />
                    )}
                    {form.responseCount > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 font-mono-tech uppercase tracking-[0.12em] text-[10px]"
                        render={
                          <Link href={`/forms/responses?form=${form.id}`} />
                        }
                      >
                        <Inbox className="size-3.5" />
                        Sheet
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyPublished />
        )}
      </Card>
    </div>
  );
}

function PublishedThumb({
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
          width={64}
          height={48}
          loading="lazy"
          decoding="async"
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
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-lg border px-4 py-2.5",
        accent ? "border-brand/40 bg-brand-tint" : "border-border bg-card",
      )}
    >
      <Icon
        className={cn(
          "size-4",
          accent ? "text-brand" : "text-muted-foreground",
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

function EmptyPublished() {
  return (
    <EmptyState
      label="No published forms"
      headline={<>Nothing <em className="text-brand">live</em> yet.</>}
      description="Open a draft in the editor and publish when you're ready — it will show up here with a shareable link."
      action={
        <Button
          className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          render={<Link href="/forms/drafts" />}
        >
          Browse drafts
        </Button>
      }
    />
  );
}
