"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FormsApiError,
  generateForm,
  waitForGenerationJob,
  type JobStatusResponse,
} from "@/lib/api/forms";
import {
  ALLOWED_SKETCH_MIME,
  MAX_SKETCHS_PER_FORM,
  SketchUploadError,
  uploadSketch,
  validateSketchFile,
} from "@/lib/storage/sketches";
import { CameraCaptureDialog } from "./camera-capture-dialog";

type Step = "compose" | "confirm" | "generating";
type GenPhase = "uploading" | "queued" | "processing" | "done" | "error";

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const GEN_COPY: Record<GenPhase, string> = {
  uploading: "Uploading sketches…",
  queued: "Queued for analysis…",
  processing: "Reading fields off the page…",
  done: "Done. Opening editor…",
  error: "Something went wrong",
};

function revokePreviews(images: PendingImage[]) {
  for (const img of images) URL.revokeObjectURL(img.previewUrl);
}

export function SketchUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>("compose");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [description, setDescription] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [genPhase, setGenPhase] = useState<GenPhase>("uploading");
  const [genDetail, setGenDetail] = useState<string | null>(null);

  const trimmedDescription = description.trim();
  const canContinue =
    images.length > 0 || trimmedDescription.length > 0;
  const atImageLimit = images.length >= MAX_SKETCHS_PER_FORM;

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;

      const room = MAX_SKETCHS_PER_FORM - images.length;
      if (room <= 0) {
        toast.error(`You can add up to ${MAX_SKETCHS_PER_FORM} images.`);
        return;
      }

      const next: PendingImage[] = [];
      for (const file of list.slice(0, room)) {
        try {
          validateSketchFile(file);
        } catch (err) {
          const msg =
            err instanceof SketchUploadError
              ? err.message
              : "Invalid image.";
          toast.error(msg);
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (list.length > room) {
        toast.error(`Only ${MAX_SKETCHS_PER_FORM} images allowed.`);
      }

      if (next.length) setImages((prev) => [...prev, ...next]);
    },
    [images.length],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const resetAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    revokePreviews(images);
    setImages([]);
    setDescription("");
    setStep("compose");
    setGenPhase("uploading");
    setGenDetail(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [images]);

  const runGeneration = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: userResult, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userResult.user) {
      setGenPhase("error");
      setGenDetail("Not authenticated. Please log in again.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setGenPhase("uploading");
    setGenDetail(null);

    const storagePaths: string[] = [];
    try {
      for (const img of images) {
        if (controller.signal.aborted) return;
        const result = await uploadSketch(
          supabase,
          userResult.user.id,
          img.file,
        );
        storagePaths.push(result.storagePath);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg =
        err instanceof Error ? err.message : "Failed to upload sketch.";
      setGenPhase("error");
      setGenDetail(msg);
      toast.error(msg);
      return;
    }

    if (controller.signal.aborted) return;

    setGenPhase("queued");
    let jobId: string;
    let formId: string;
    try {
      const queued = await generateForm(supabase, {
        storage_paths: storagePaths,
        description: trimmedDescription || undefined,
      });
      jobId = queued.job_id;
      formId = queued.form_id;
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg =
        err instanceof FormsApiError
          ? err.message
          : "Could not start generation.";
      setGenPhase("error");
      setGenDetail(msg);
      toast.error(msg);
      return;
    }

    setGenPhase("processing");
    let final: JobStatusResponse;
    try {
      final = await waitForGenerationJob(supabase, jobId, {
        intervalMs: 2000,
        timeoutMs: 120_000,
        signal: controller.signal,
        onTick: (snap) => {
          if (snap.status === "processing") setGenPhase("processing");
        },
      });
    } catch (err) {
      if (controller.signal.aborted) {
        toast.message("Generation cancelled");
        setStep("confirm");
        setGenPhase("uploading");
        return;
      }
      const msg =
        err instanceof FormsApiError
          ? err.message
          : "Generation polling failed.";
      setGenPhase("error");
      setGenDetail(msg);
      toast.error(msg);
      return;
    }

    if (final.status === "failed") {
      setGenPhase("error");
      setGenDetail(final.error ?? "Generation failed.");
      toast.error(final.error ?? "Generation failed.");
      return;
    }

    setGenPhase("done");
    toast.success("Form ready");
    router.push(`/forms/${formId}/edit`);
  }, [images, trimmedDescription, router]);

  const onPick = useCallback(() => fileInputRef.current?.click(), []);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("confirm");
    setGenPhase("uploading");
    setGenDetail(null);
  }, []);

  if (step === "confirm") {
    return (
      <div className="relative flex flex-col gap-6 py-12 px-6">
        <div className="space-y-2 text-center">
          <h2 className="font-display text-3xl tracking-tight">
            Ready to <em className="text-brand">generate?</em>
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Check your inputs below. Nothing is sent to the AI until you
            confirm.
          </p>
        </div>

        {images.length > 0 ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto w-full">
            {images.map((img) => (
              <li
                key={img.id}
                className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted"
              >
                <Image
                  src={img.previewUrl}
                  alt="Sketch preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </li>
            ))}
          </ul>
        ) : null}

        {trimmedDescription ? (
          <div className="mx-auto max-w-lg w-full rounded-lg border bg-muted/30 p-4 text-left">
            <p className="font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground mb-2">
              Description
            </p>
            <p className="text-sm whitespace-pre-wrap">{trimmedDescription}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => setStep("compose")}>
            Back
          </Button>
          <Button
            size="lg"
            className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
            onClick={() => {
              setStep("generating");
              void runGeneration();
            }}
          >
            <Sparkles className="size-4" />
            Generate form
          </Button>
        </div>
      </div>
    );
  }

  if (step === "generating") {
    return (
      <div className="relative flex flex-col items-center justify-center gap-5 py-16 px-6 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/30">
          {genPhase === "error" ? (
            <X className="size-7" />
          ) : (
            <Loader2 className="size-7 animate-spin" />
          )}
        </div>
        <p
          className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground/80"
          aria-live="polite"
        >
          {GEN_COPY[genPhase]}
        </p>
        {genDetail && genPhase === "error" ? (
          <div className="text-sm text-destructive max-w-md">
            {genDetail}
            <div className="mt-3 flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setStep("confirm")}>
                Back
              </Button>
              <Button variant="outline" size="sm" onClick={resetAll}>
                Start over
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={genPhase === "done"}
            onClick={cancelGeneration}
          >
            Cancel
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center gap-6 py-12 px-6"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_SKETCH_MIME.join(",")}
          multiple
          className="sr-only"
          onChange={onFile}
        />

        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-brand/30 rounded-full" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/30">
            <Upload className="size-7" />
          </div>
        </div>

        <div className="space-y-2 max-w-md text-center">
          <h2 className="font-display text-3xl tracking-tight">
            Sketches, camera, or <em className="text-brand">words</em>
          </h2>
          <p className="text-sm text-muted-foreground">
            Add up to {MAX_SKETCHS_PER_FORM} images (JPG, PNG, WebP · 10 MB
            each), capture with your camera, and/or describe the form. You
            confirm before anything is analyzed.
          </p>
        </div>

        {images.length > 0 ? (
          <ul className="grid w-full max-w-xl grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <li
                key={img.id}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted"
              >
                <Image
                  src={img.previewUrl}
                  alt="Selected sketch"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute top-2 right-2 opacity-90"
                  onClick={() => removeImage(img.id)}
                  aria-label="Remove image"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
            disabled={atImageLimit}
            onClick={onPick}
          >
            <Upload className="size-4" />
            Choose files
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
            disabled={atImageLimit}
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="size-4" />
            Use camera
          </Button>
        </div>

        <div className="w-full max-w-xl space-y-2">
          <label
            htmlFor="form-description"
            className="flex items-center gap-2 font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground"
          >
            <FileText className="size-3.5" />
            Describe the form (optional)
          </label>
          <Textarea
            id="form-description"
            placeholder="e.g. Registration form with name, email, department dropdown (Sales, Engineering, HR), and a yes/no for dietary restrictions."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="resize-y"
          />
        </div>

        <Button
          size="lg"
          disabled={!canContinue}
          className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          onClick={() => setStep("confirm")}
        >
          Review & continue →
        </Button>
      </div>

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => addFiles([file])}
      />
    </>
  );
}
