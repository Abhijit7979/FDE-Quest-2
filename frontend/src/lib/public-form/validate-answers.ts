import type { FormField } from "@/lib/schema/definition";

export type FieldErrors = Record<string, string>;

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateAnswers(
  fields: FormField[],
  answers: Record<string, unknown>,
): FieldErrors {
  const errors: FieldErrors = {};

  for (const field of fields) {
    const raw = answers[field.id];

    if (field.required && isBlank(raw)) {
      errors[field.id] = "This field is required.";
      continue;
    }

    if (isBlank(raw)) continue;

    switch (field.type) {
      case "email": {
        const v = String(raw).trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          errors[field.id] = "Enter a valid email address.";
        }
        break;
      }
      case "number": {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          errors[field.id] = "Enter a valid number.";
        }
        break;
      }
      case "single_choice":
      case "dropdown": {
        const v = String(raw);
        if (!(field.options ?? []).includes(v)) {
          errors[field.id] = "Select a valid option.";
        }
        break;
      }
      case "multi_choice": {
        if (!Array.isArray(raw) || raw.length === 0) {
          if (field.required) errors[field.id] = "Select at least one option.";
          break;
        }
        const opts = new Set(field.options ?? []);
        if (!raw.every((x) => typeof x === "string" && opts.has(x))) {
          errors[field.id] = "Invalid selection.";
        }
        break;
      }
      case "yes_no": {
        const v = String(raw);
        if (v !== "yes" && v !== "no") {
          errors[field.id] = "Choose Yes or No.";
        }
        break;
      }
      default:
        break;
    }
  }

  return errors;
}

export function normalizeAnswers(
  fields: FormField[],
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = answers[field.id];
    if (isBlank(raw)) continue;

    switch (field.type) {
      case "short_text":
      case "long_text":
      case "email":
      case "phone":
      case "date":
      case "single_choice":
      case "dropdown":
      case "yes_no":
        out[field.id] = String(raw).trim();
        break;
      case "number":
        out[field.id] = Number(raw);
        break;
      case "multi_choice":
        out[field.id] = Array.isArray(raw)
          ? raw.map((v) => String(v))
          : [];
        break;
      default:
        out[field.id] = raw;
    }
  }
  return out;
}
