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

export function PublicFieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: unknown;
  onChange: (next: unknown) => void;
  error?: string;
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
}: {
  field: FormField;
  value: unknown;
  onChange: (next: unknown) => void;
  errorId?: string;
  invalid: boolean;
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
    default:
      return null;
  }
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
