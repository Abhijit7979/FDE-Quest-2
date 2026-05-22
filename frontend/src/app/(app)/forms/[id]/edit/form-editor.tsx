"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FormsDataError,
  saveFormDraft,
  type FormStatus,
} from "@/lib/data/forms";
import {
  DefinitionSchema,
  type Definition,
  type FormField,
} from "@/lib/schema/definition";

import { DraftOrientation } from "./draft-orientation";
import { FieldList } from "./field-list";
import { FieldPropertiesSheet } from "./field-property-sheet";
import { LivePreview } from "./live-preview";
import { PublishBar } from "./publish-bar";
import { ReviewQueueBanner } from "./review-queue-banner";
import { SketchReferencePanel } from "./sketch-reference-panel";

type FormSummary = {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  public_slug: string | null;
  sketch_path: string | null;
  updated_at: string;
  published_at: string | null;
};

type SavePhase = "idle" | "saving" | "saved" | "error";

type Snapshot = {
  title: string;
  description: string;
  fields: FormField[];
  updatedAt: string;
};

type WorkspaceTab = "fields" | "preview";

const AUTOSAVE_MS = 5000;

export function FormEditor({
  form,
  initialDefinition,
  definitionError,
  sketchUrl,
}: {
  form: FormSummary;
  initialDefinition: Definition;
  definitionError: string | null;
  sketchUrl: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");
  const [fields, setFields] = useState<FormField[]>(initialDefinition.fields);

  const [status, setStatus] = useState<FormStatus>(form.status);
  const [publicSlug, setPublicSlug] = useState<string | null>(form.public_slug);
  const [publishedAt, setPublishedAt] = useState<string | null>(
    form.published_at,
  );

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("fields");

  const [savePhase, setSavePhase] = useState<SavePhase>(
    definitionError ? "error" : "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(definitionError);

  const [saved, setSaved] = useState<Snapshot>({
    title: form.title,
    description: form.description ?? "",
    fields: initialDefinition.fields,
    updatedAt: form.updated_at,
  });

  const isDraft = status === "draft";

  const validation = useMemo(() => {
    const result = DefinitionSchema.safeParse({ version: 1, fields });
    if (result.success) return { ok: true as const, error: null };
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "definition"}: ${i.message}`)
      .join("; ");
    return { ok: false as const, error: message };
  }, [fields]);

  const isDirty = useMemo(() => {
    if (title !== saved.title) return true;
    if (description !== saved.description) return true;
    if (JSON.stringify(fields) !== JSON.stringify(saved.fields)) return true;
    return false;
  }, [title, description, fields, saved]);

  const doSave = useCallback(async (): Promise<boolean> => {
    if (!validation.ok) {
      setSaveError(validation.error);
      setSavePhase("error");
      return false;
    }

    setSavePhase("saving");
    setSaveError(null);
    try {
      const res = await saveFormDraft(supabase, form.id, {
        title,
        description: description.length > 0 ? description : null,
        definition: { version: 1, fields },
      });
      setSaved({ title, description, fields, updatedAt: res.updated_at });
      setSavePhase("saved");
      window.setTimeout(() => {
        setSavePhase((s) => (s === "saved" ? "idle" : s));
      }, 1500);
      return true;
    } catch (err) {
      const msg =
        err instanceof FormsDataError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed.";
      setSaveError(msg);
      setSavePhase("error");
      toast.error(msg);
      return false;
    }
  }, [supabase, form.id, title, description, fields, validation]);

  useEffect(() => {
    if (!isDirty || !validation.ok) return;
    const handle = window.setTimeout(() => {
      void doSave();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(handle);
  }, [isDirty, validation.ok, doSave]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && validation.ok && savePhase !== "saving") {
          void doSave();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, validation.ok, savePhase, doSave]);

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedFieldId) ?? null,
    [fields, selectedFieldId],
  );

  const handleFieldsChange = useCallback((next: FormField[]) => {
    setFields(next);
  }, []);

  const handleFieldPatch = useCallback(
    (id: string, patch: Partial<FormField>) => {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? ({ ...f, ...patch } as FormField) : f)),
      );
    },
    [],
  );

  const handleMarkReviewed = useCallback(
    (id: string) => {
      handleFieldPatch(id, { needs_review: false });
    },
    [handleFieldPatch],
  );

  const onPublishedChange = useCallback(
    (next: {
      status: FormStatus;
      public_slug: string | null;
      published_at: string | null;
    }) => {
      setStatus(next.status);
      setPublicSlug(next.public_slug);
      setPublishedAt(next.published_at);
    },
    [],
  );

  const showSavePulse = isDirty && validation.ok && savePhase !== "saving";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="sticky top-14 z-30 -mx-6 md:-mx-8 px-6 md:px-8 py-3 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 anim-rise">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              render={<Link href="/home" aria-label="Back to home" />}
            >
              <ArrowLeft />
            </Button>
            <SaveIndicator
              phase={savePhase}
              isDirty={isDirty}
              error={saveError}
              lastSavedAt={saved.updatedAt}
              prominent
            />
          </div>
          <Button
            size="sm"
            variant={isDirty ? "default" : "outline"}
            disabled={!isDirty || savePhase === "saving" || !validation.ok}
            onClick={() => void doSave()}
            className="relative font-mono-tech uppercase tracking-[0.15em] text-[11px] self-end sm:self-auto"
          >
            {showSavePulse && (
              <span
                className="absolute -left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-500 anim-save-pulse"
                aria-hidden
              />
            )}
            {savePhase === "saving" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save />
            )}
            Save
          </Button>
        </div>
      </div>

      <header className="space-y-2 min-w-0 anim-rise" style={{ animationDelay: "40ms" }}>
        <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
          / 03 · Edit form
        </p>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled form"
          className="h-auto !px-0 border-0 bg-transparent font-display text-3xl md:text-4xl tracking-tight leading-[1.05] shadow-none focus-visible:ring-0 focus-visible:border-0"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a short description respondents will see."
          className="resize-none border-0 bg-transparent !px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:border-0"
          rows={2}
        />
      </header>

      {isDraft && (
        <DraftOrientation fields={fields} validationOk={validation.ok} />
      )}

      {isDraft && (
        <ReviewQueueBanner
          fields={fields}
          selectedFieldId={selectedFieldId}
          onSelectField={setSelectedFieldId}
          onMarkReviewed={handleMarkReviewed}
        />
      )}

      <PublishBar
        formId={form.id}
        formTitle={title}
        status={status}
        publicSlug={publicSlug}
        publishedAt={publishedAt}
        sketchUrl={sketchUrl}
        sketchPath={form.sketch_path}
        isDirty={isDirty}
        validationOk={validation.ok}
        fields={fields}
        savePhase={savePhase}
        onBeforePublish={async () => {
          if (isDirty) return doSave();
          return true;
        }}
        onPublishedChange={onPublishedChange}
        onRegenerated={() => router.refresh()}
      />

      {!validation.ok && (
        <Card className="border-destructive/40 bg-destructive/5 anim-rise">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Form has validation errors.</p>
              <p className="text-destructive/80 text-xs">
                {validation.error}. Fix highlighted fields before saving or
                publishing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isDraft && sketchUrl && <SketchReferencePanel sketchUrl={sketchUrl} />}

      <div className="lg:hidden anim-rise" style={{ animationDelay: "120ms" }}>
        <div
          className="grid grid-cols-2 gap-1 rounded-lg border p-1 bg-muted/30"
          role="tablist"
          aria-label="Editor workspace"
        >
          {(["fields", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={workspaceTab === tab}
              onClick={() => setWorkspaceTab(tab)}
              className={cn(
                "rounded-md py-2 font-mono-tech uppercase tracking-[0.15em] text-[11px] transition-colors",
                workspaceTab === tab
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "fields" ? "Fields" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] anim-rise"
        style={{ animationDelay: "160ms" }}
      >
        <Card
          className={cn(
            "lg:block",
            workspaceTab !== "fields" && "hidden lg:block",
          )}
        >
          <CardContent className="p-4 md:p-5">
            <div className="mb-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
                  Fields
                </p>
                <p className="font-mono-tech text-[10px] text-muted-foreground">
                  {fields.length} item{fields.length === 1 ? "" : "s"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Click a field to edit type, options, and validation.
              </p>
            </div>
            <FieldList
              fields={fields}
              onFieldsChange={handleFieldsChange}
              onSelectField={setSelectedFieldId}
              selectedFieldId={selectedFieldId}
            />
          </CardContent>
        </Card>

        <Card
          className={cn(
            "lg:block",
            workspaceTab !== "preview" && "hidden lg:block",
          )}
        >
          <CardContent className="p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
                Preview
              </p>
              <p className="font-mono-tech text-[10px] text-muted-foreground">
                Respondent view
              </p>
            </div>
            <LivePreview
              title={title}
              description={description}
              fields={fields}
              selectedFieldId={selectedFieldId}
            />
          </CardContent>
        </Card>
      </div>

      <FieldPropertiesSheet
        field={selectedField}
        allFields={fields}
        onOpenChange={(open) => {
          if (!open) setSelectedFieldId(null);
        }}
        onPatch={handleFieldPatch}
      />
    </div>
  );
}

function SaveIndicator({
  phase,
  isDirty,
  error,
  lastSavedAt,
  prominent = false,
}: {
  phase: SavePhase;
  isDirty: boolean;
  error: string | null;
  lastSavedAt: string;
  prominent?: boolean;
}) {
  let label: string;
  let tone: string;
  if (phase === "saving") {
    label = "Saving…";
    tone = "text-muted-foreground";
  } else if (phase === "error") {
    label = error ?? "Save failed";
    tone = "text-destructive";
  } else if (phase === "saved") {
    label = "Saved";
    tone = "text-emerald-600";
  } else if (isDirty) {
    label = "Unsaved changes";
    tone = "text-amber-600";
  } else {
    label = `Saved ${formatRelative(lastSavedAt)}`;
    tone = "text-muted-foreground";
  }
  return (
    <span
      className={cn(
        "font-mono-tech uppercase tracking-[0.18em] text-[10px]",
        tone,
        prominent && "text-[11px]",
      )}
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}
