"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FormsApiError,
  generateForm,
  waitForGenerationJob,
  type JobStatusResponse,
} from "@/lib/api/forms";
import {
  ALLOWED_SKETCH_MIME,
  SketchUploadError,
  uploadSketch,
  validateSketchFile,
} from "@/lib/storage/sketches";

type Phase = "idle" | "uploading" | "queued" | "processing" | "done" | "error";

const PHASE_COPY: Record<Phase, string> = {
  idle: "Drop or pick a sketch to start",
  uploading: "Uploading sketch…",
  queued: "Queued for analysis…",
  processing: "Reading fields off the page…",
  done: "Done. Opening editor…",
  error: "Something went wrong",
};

export function SketchUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setDetail(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const runPipeline = useCallback(
    async (file: File) => {
      try {
        validateSketchFile(file);
      } catch (err) {
        if (err instanceof SketchUploadError) {
          setPhase("error");
          setDetail(err.message);
          toast.error(err.message);
        }
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: userResult, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userResult.user) {
        setPhase("error");
        setDetail("Not authenticated. Please log in again.");
        return;
      }

      setPhase("uploading");
      setDetail(null);
      let storagePath: string;
      try {
        const result = await uploadSketch(supabase, userResult.user.id, file);
        storagePath = result.storagePath;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to upload sketch.";
        setPhase("error");
        setDetail(msg);
        toast.error(msg);
        return;
      }

      setPhase("queued");
      let jobId: string;
      let formId: string;
      try {
        const queued = await generateForm(supabase, { storage_path: storagePath });
        jobId = queued.job_id;
        formId = queued.form_id;
      } catch (err) {
        const msg =
          err instanceof FormsApiError
            ? err.message
            : "Could not start generation.";
        setPhase("error");
        setDetail(msg);
        toast.error(msg);
        return;
      }

      setPhase("processing");
      let final: JobStatusResponse;
      try {
        final = await waitForGenerationJob(supabase, jobId, {
          intervalMs: 2000,
          timeoutMs: 120_000,
          onTick: (snap) => {
            if (snap.status === "processing") setPhase("processing");
          },
        });
      } catch (err) {
        const msg =
          err instanceof FormsApiError
            ? err.message
            : "Generation polling failed.";
        setPhase("error");
        setDetail(msg);
        toast.error(msg);
        return;
      }

      if (final.status === "failed") {
        setPhase("error");
        setDetail(final.error ?? "Generation failed.");
        toast.error(final.error ?? "Generation failed.");
        return;
      }

      setPhase("done");
      toast.success("Form ready");
      router.push(`/forms/${formId}/edit`);
    },
    [router],
  );

  const onPick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void runPipeline(file);
    },
    [runPipeline],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) void runPipeline(file);
    },
    [runPipeline],
  );

  const busy = phase !== "idle" && phase !== "error" && phase !== "done";

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="relative flex flex-col items-center justify-center gap-5 py-16 px-6 text-center"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_SKETCH_MIME.join(",")}
        className="sr-only"
        onChange={onFile}
        disabled={busy}
      />

      <div className="relative">
        <div className="absolute inset-0 blur-2xl bg-brand/30 rounded-full" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/30">
          {busy ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <Upload className="size-7" />
          )}
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="font-display text-3xl tracking-tight">
          Drop a sketch <em className="text-brand">here</em>
        </h2>
        <p className="text-sm text-muted-foreground">
          JPG, PNG or WebP · up to 10 MB · stored privately in your workspace
          bucket.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          disabled={busy}
          onClick={onPick}
        >
          <Upload className="size-4" />
          {busy ? "Working…" : "Choose file"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          disabled
          title="Camera capture lands in a follow-up"
        >
          <Camera className="size-4" />
          Use camera
        </Button>
      </div>

      <p
        className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground/80 mt-2"
        aria-live="polite"
      >
        {PHASE_COPY[phase]}
      </p>

      {detail && phase === "error" ? (
        <div className="text-sm text-destructive max-w-md">
          {detail}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={reset}>
              Try again
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
