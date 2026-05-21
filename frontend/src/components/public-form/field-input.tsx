"use client";

import { useState } from "react";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FormField } from "@/lib/schema/definition";
import {
  ALLOWED_RESPONSE_MIME,
  formatFileSize,
  isUploadedFileAnswer,
  uploadResponseFile,
} from "@/lib/storage/response-uploads";

export function PublicFieldInput({
  field,
  value,
  onChange,
  error,
  formId,
  supabase,
}: {
  field: FormField;
  value: unknown;
  onChange: (next: unknown) => void;
  error?: string;
  formId: string;
  supabase: SupabaseClient;
}) {
  const errorId = error ? `${field.id}-error` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="text-sm font-medium leading-snug">
        {field.label}
        {field.required && (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        )}
      </Label>
      <FieldControl
        field={field}
        value={value}
        onChange={onChange}
        errorId={errorId}
        invalid={Boolean(error)}
        formId={formId}
        supabase={supabase}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  errorId,
  invalid,
  formId,
  supabase,
}: {
  field: FormField;
  value: unknown;
  onChange: (next: unknown) => void;
  errorId?: string;
  invalid: boolean;
  formId: string;
  supabase: SupabaseClient;
}) {
  const aria = {
    id: field.id,
    "aria-invalid": invalid,
    "aria-describedby": errorId,
  };

  switch (field.type) {
    case "short_text":
    case "email":
    case "number":
    case "phone":
    case "date":
      return (
        <Input
          {...aria}
          type={inputTypeFor(field.type)}
          placeholder={field.placeholder ?? undefined}
          value={stringValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalid && "border-destructive")}
        />
      );
    case "long_text":
      return (
        <Textarea
          {...aria}
          placeholder={field.placeholder ?? undefined}
          rows={4}
          value={stringValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalid && "border-destructive")}
        />
      );
    case "yes_no": {
      const selected = stringValue(value);
      return (
        <div className="flex flex-wrap gap-4" role="radiogroup" aria-labelledby={field.id}>
          {(["yes", "no"] as const).map((opt) => (
            <label
              key={opt}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm capitalize"
            >
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={selected === opt}
                onChange={() => onChange(opt)}
                className="size-4 accent-primary"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case "single_choice":
      return (
        <div className="space-y-2" role="radiogroup" aria-labelledby={field.id}>
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm"
            >
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={stringValue(value) === opt}
                onChange={() => onChange(opt)}
                className="size-4 accent-primary"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "multi_choice": {
      const selected = new Set(
        Array.isArray(value) ? value.map(String) : [],
      );
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm"
            >
              <Checkbox
                checked={selected.has(opt)}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked) next.add(opt);
                  else next.delete(opt);
                  onChange([...next]);
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case "dropdown":
      return (
        <Select<string>
          value={stringValue(value) || null}
          onValueChange={(v) => onChange(v ?? "")}
        >
          <SelectTrigger
            id={field.id}
            aria-invalid={invalid}
            aria-describedby={errorId}
            className={cn("min-h-11 w-full", invalid && "border-destructive")}
          >
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "file_upload":
      return (
        <FileUploadControl
          field={field}
          value={value}
          onChange={onChange}
          errorId={errorId}
          invalid={invalid}
          formId={formId}
          supabase={supabase}
        />
      );
    default:
      return null;
  }
}

function FileUploadControl({
  field,
  value,
  onChange,
  errorId,
  invalid,
  formId,
  supabase,
}: {
  field: FormField;
  value: unknown;
  onChange: (next: unknown) => void;
  errorId?: string;
  invalid: boolean;
  formId: string;
  supabase: SupabaseClient;
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const current = isUploadedFileAnswer(value) ? value : null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    setBusy(true);
    try {
      const uploaded = await uploadResponseFile(supabase, formId, file);
      onChange(uploaded);
    } catch (err) {
      onChange(undefined);
      setLocalError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (current) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{current.name}</span>
        {current.size > 0 && (
          <span className="shrink-0 font-mono-tech text-[10px] text-muted-foreground">
            {formatFileSize(current.size)}
          </span>
        )}
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
          aria-label="Remove file"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40",
          invalid && "border-destructive",
          busy && "cursor-progress opacity-70",
        )}
      >
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : (
          <FileUp className="size-4 shrink-0" />
        )}
        <span>{busy ? "Uploading…" : "Choose an image or PDF"}</span>
        <input
          id={field.id}
          type="file"
          accept={ALLOWED_RESPONSE_MIME.join(",")}
          className="sr-only"
          aria-invalid={invalid}
          aria-describedby={errorId}
          disabled={busy}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {localError && (
        <p className="text-xs text-destructive">{localError}</p>
      )}
    </div>
  );
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function inputTypeFor(t: FormField["type"]): string {
  switch (t) {
    case "email":
      return "email";
    case "number":
      return "number";
    case "phone":
      return "tel";
    case "date":
      return "date";
    default:
      return "text";
  }
}
