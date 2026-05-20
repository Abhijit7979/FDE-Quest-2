import { z } from "zod";

// Mirror of backend/app/schemas/definition.py — the contract written into
// forms.definition. Keep these in sync: when one side changes, change the other.

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "number",
  "phone",
  "single_choice",
  "multi_choice",
  "dropdown",
  "date",
  "yes_no",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const OPTION_FIELD_TYPES: ReadonlySet<FieldType> = new Set([
  "single_choice",
  "multi_choice",
  "dropdown",
]);

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  number: "Number",
  phone: "Phone",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  dropdown: "Dropdown",
  date: "Date",
  yes_no: "Yes / No",
};

export const FormFieldSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: z.enum(FIELD_TYPES),
    label: z.string().min(1).max(240),
    required: z.boolean().default(false),
    placeholder: z.string().nullish(),
    options: z.array(z.string().min(1)).nullish(),
    needs_review: z.boolean().default(false),
  })
  .superRefine((field, ctx) => {
    const needsOptions = OPTION_FIELD_TYPES.has(field.type);
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;
    if (needsOptions && !hasOptions) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `${field.type} requires at least one option`,
      });
    }
    if (!needsOptions && Array.isArray(field.options) && field.options.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `${field.type} must not include options`,
      });
    }
  });

export type FormField = z.infer<typeof FormFieldSchema>;

export const DefinitionSchema = z
  .object({
    version: z.literal(1).default(1),
    fields: z.array(FormFieldSchema).default([]),
  })
  .superRefine((def, ctx) => {
    const seen = new Set<string>();
    for (const f of def.fields) {
      if (seen.has(f.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields"],
          message: `duplicate field id: ${f.id}`,
        });
      }
      seen.add(f.id);
    }
  });

export type Definition = z.infer<typeof DefinitionSchema>;

export const EMPTY_DEFINITION: Definition = { version: 1, fields: [] };

export function nextFieldId(existing: ReadonlyArray<{ id: string }>): string {
  let max = 0;
  for (const f of existing) {
    const match = /^f_(\d+)$/.exec(f.id);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `f_${max + 1}`;
}

export function defaultFieldForType(
  type: FieldType,
  existing: ReadonlyArray<{ id: string }>,
): FormField {
  const id = nextFieldId(existing);
  const base = {
    id,
    type,
    label: FIELD_TYPE_LABEL[type],
    required: false,
    placeholder: null,
    needs_review: false,
  } as FormField;
  if (OPTION_FIELD_TYPES.has(type)) {
    return { ...base, options: ["Option 1"] };
  }
  return base;
}

/**
 * Coerce an unknown JSON value (e.g. straight off the database) into a usable
 * Definition. If it parses cleanly we return it; if it doesn't, we return the
 * empty definition + the Zod error so the caller can surface it.
 */
export function coerceDefinition(value: unknown): {
  definition: Definition;
  error: z.ZodError | null;
} {
  const parsed = DefinitionSchema.safeParse(value);
  if (parsed.success) return { definition: parsed.data, error: null };
  return { definition: EMPTY_DEFINITION, error: parsed.error };
}
