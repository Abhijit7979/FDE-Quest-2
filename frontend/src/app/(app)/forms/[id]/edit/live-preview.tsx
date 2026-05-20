"use client";

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

export function LivePreview({
  title,
  description,
  fields,
  selectedFieldId = null,
}: {
  title: string;
  description: string;
  fields: FormField[];
  selectedFieldId?: string | null;
}) {
  return (
    <div className="space-y-5 rounded-lg border bg-background p-4 md:p-5">
      <header className="space-y-1.5">
        <h2 className="font-display text-2xl tracking-tight leading-tight">
          {title || "Untitled form"}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </header>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Add a field to see the respondent view.
        </p>
      ) : (
        <ul className="space-y-4">
          {fields.map((field) => {
            const selected = field.id === selectedFieldId;
            const needsReview = field.needs_review;
            return (
              <li
                key={field.id}
                className={cn(
                  "space-y-1.5 rounded-md p-2 -mx-2 transition-all duration-200",
                  selected &&
                    "ring-2 ring-brand/50 bg-brand-tint/30 scale-[1.01]",
                  needsReview &&
                    "border border-dashed border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20",
                )}
              >
                <Label className="flex flex-wrap items-center gap-1.5">
                  {field.label || "Untitled field"}
                  {field.required && (
                    <span aria-label="required" className="text-destructive">
                      *
                    </span>
                  )}
                  {needsReview && (
                    <span className="font-mono-tech uppercase tracking-[0.16em] text-[9px] text-amber-700 dark:text-amber-400">
                      Unverified
                    </span>
                  )}
                </Label>
                <PreviewControl field={field} />
              </li>
            );
          })}
          <li>
            <button
              type="button"
              disabled
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground opacity-70"
              aria-label="Preview only"
            >
              Submit
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function PreviewControl({ field }: { field: FormField }) {
  switch (field.type) {
    case "short_text":
    case "email":
    case "number":
    case "phone":
    case "date":
      return (
        <Input
          type={inputTypeFor(field.type)}
          placeholder={field.placeholder ?? undefined}
          aria-label={field.label}
          defaultValue=""
        />
      );
    case "long_text":
      return (
        <Textarea
          placeholder={field.placeholder ?? undefined}
          aria-label={field.label}
          rows={3}
        />
      );
    case "yes_no":
      return (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name={field.id} value="yes" className="size-4" />
            Yes
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={field.id} value="no" className="size-4" />
            No
          </label>
        </div>
      );
    case "single_choice":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.id}
                value={opt}
                className="size-4"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "multi_choice":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <Checkbox /> {opt}
            </label>
          ))}
        </div>
      );
    case "dropdown":
      return (
        <Select<string>>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt, i) => (
              <SelectItem key={i} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return null;
  }
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
