"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCcw,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FormsApiError,
  generateForm,
  waitForGenerationJob,
} from "@/lib/api/forms";
import {
  buildShareUrl,
  FormsDataError,
  publishForm,
  unpublishForm,
  type FormStatus,
} from "@/lib/data/forms";
import {
  ALLOWED_SKETCH_MIME,
  SketchUploadError,
  uploadSketch,
  validateSketchFile,
} from "@/lib/storage/sketches";

type RegenPhase =
  | "idle"
  | "uploading"
  | "queued"
  | "processing"
  | "error";

export function PublishBar({
  formId,
  status,
  publicSlug,
  publishedAt,
  sketchUrl,
  sketchPath,
  isDirty,
  validationOk,
  onBeforePublish,
  onPublishedChange,
  onRegenerated,
}: {
  formId: string;
  status: FormStatus;
  publicSlug: string | null;
  publishedAt: string | null;
  sketchUrl: string | null;
  sketchPath: string | null;
  isDirty: boolean;
  validationOk: boolean;
  onBeforePublish: () => Promise<boolean>;
  onPublishedChange: (next: {
    status: FormStatus;
    public_slug: string | null;
    published_at: string | null;
  }) => void;
  onRegenerated: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [regenPhase, setRegenPhase] = useState<RegenPhase>("idle");
  const [regenError, setRegenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shareUrl = publicSlug ? buildShareUrl(publicSlug) : null;
  const isPublished = status === "published";

  async function handlePublish() {
    if (!validationOk) {
      toast.error("Resolve validation errors before publishing.");
      return;
    }
    setPublishing(true);
    try {
      // Persist any pending edits first so the published version matches.
      if (isDirty) {
        const ok = await onBeforePublish();
        if (!ok) {
          setPublishing(false);
          return;
        }
      }
      const result = await publishForm(supabase, formId);
      onPublishedChange({
        status: "published",
        public_slug: result.public_slug,
        published_at: result.published_at,
      });
      toast.success("Form published");
    } catch (err) {
      const msg =
        err instanceof FormsDataError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Publish failed.";
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!window.confirm("Unpublish this form? Respondents will no longer be able to submit.")) {
      return;
    }
    setUnpublishing(true);
    try {
      await unpublishForm(supabase, formId);
      // Keep the slug so re-publishing reuses the same share URL.
      onPublishedChange({
        status: "draft",
        public_slug: publicSlug,
        published_at: publishedAt,
      });
      toast.success("Form unpublished");
    } catch (err) {
      const msg =
        err instanceof FormsDataError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unpublish failed.";
      toast.error(msg);
    } finally {
      setUnpublishing(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share URL copied");
    } catch {
      toast.error("Could not copy. Select and copy manually.");
    }
  }

  function openRegenPicker() {
    if (
      !window.confirm(
        "Re-run AI on a new sketch? The current draft will be overwritten.",
      )
    ) {
      return;
    }
    fileInputRef.current?.click();
  }

  async function runRegen(file: File) {
    setRegenError(null);
    try {
      validateSketchFile(file);
    } catch (err) {
      if (err instanceof SketchUploadError) {
        setRegenPhase("error");
        setRegenError(err.message);
        toast.error(err.message);
      }
      return;
    }

    const { data: userResult, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userResult.user) {
      setRegenPhase("error");
      setRegenError("Not authenticated.");
      return;
    }

    setRegenPhase("uploading");
    let storagePath: string;
    try {
      const result = await uploadSketch(supabase, userResult.user.id, file);
      storagePath = result.storagePath;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to upload sketch.";
      setRegenPhase("error");
      setRegenError(msg);
      toast.error(msg);
      return;
    }

    setRegenPhase("queued");
    let jobId: string;
    try {
      const queued = await generateForm(supabase, {
        storage_path: storagePath,
        form_id: formId,
      });
      jobId = queued.job_id;
    } catch (err) {
      const msg =
        err instanceof FormsApiError
          ? err.message
          : "Could not start generation.";
      setRegenPhase("error");
      setRegenError(msg);
      toast.error(msg);
      return;
    }

    setRegenPhase("processing");
    try {
      const final = await waitForGenerationJob(supabase, jobId, {
        intervalMs: 2000,
        timeoutMs: 120_000,
      });
      if (final.status === "failed") {
        setRegenPhase("error");
        setRegenError(final.error ?? "Generation failed.");
        toast.error(final.error ?? "Generation failed.");
        return;
      }
    } catch (err) {
      const msg =
        err instanceof FormsApiError
          ? err.message
          : "Generation polling failed.";
      setRegenPhase("error");
      setRegenError(msg);
      toast.error(msg);
      return;
    }

    setRegenPhase("idle");
    toast.success("Form regenerated");
    onRegenerated();
  }

  const regenBusy =
    regenPhase === "uploading" ||
    regenPhase === "queued" ||
    regenPhase === "processing";

  const regenLabel: Record<RegenPhase, string> = {
    idle: "Regenerate from new sketch",
    uploading: "Uploading sketch…",
    queued: "Queued for analysis…",
    processing: "Reading fields…",
    error: regenError ?? "Try again",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-4 p-4 md:p-5 md:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
          {sketchUrl ? (
            <a
              href={sketchUrl}
              target="_blank"
              rel="noreferrer"
              className="group relative h-16 w-20 shrink-0 overflow-hidden rounded-md border bg-muted"
              title="Open original sketch"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sketchUrl}
                alt="Source sketch"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </a>
          ) : (
            <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
              <Upload className="size-5" />
            </div>
          )}

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              {publishedAt && isPublished && (
                <span className="font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground">
                  Live since{" "}
                  {new Date(publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
            {isPublished && shareUrl ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1">
                  <Globe2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    readOnly
                    value={shareUrl}
                    className="h-auto !px-0 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyShareUrl}
                    className="font-mono-tech uppercase tracking-[0.15em] text-[10px]"
                  >
                    <Copy />
                    Copy
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    render={
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open share URL"
                      />
                    }
                  >
                    <ExternalLink />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {sketchPath
                  ? "Draft. Publish to get a shareable link."
                  : "Manual form (no source sketch). Publish to share."}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {sketchPath && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_SKETCH_MIME.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (file) void runRegen(file);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={openRegenPicker}
                disabled={regenBusy}
                className="font-mono-tech uppercase tracking-[0.15em] text-[10px]"
              >
                {regenBusy ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCcw />
                )}
                {regenLabel[regenPhase]}
              </Button>
            </>
          )}
          <Separator orientation="vertical" className="hidden sm:block h-6" />
          {isPublished ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUnpublish}
              disabled={unpublishing}
              className="font-mono-tech uppercase tracking-[0.15em] text-[10px]"
            >
              {unpublishing ? <Loader2 className="animate-spin" /> : <Undo2 />}
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing || !validationOk}
              className="font-mono-tech uppercase tracking-[0.15em] text-[10px]"
            >
              {publishing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              Publish
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: FormStatus }) {
  if (status === "published") {
    return (
      <Badge variant="success" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Published
      </Badge>
    );
  }
  if (status === "archived") {
    return (
      <Badge variant="muted" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Archived
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Draft
    </Badge>
  );
}
