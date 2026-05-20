import { coerceDefinition } from "@/lib/schema/definition";

export type FormListMeta = {
  fieldCount: number;
  reviewCount: number;
};

/** Derive display stats from a form's definition JSON. */
export function formListMeta(definition: unknown): FormListMeta {
  const { definition: def } = coerceDefinition(definition);
  let reviewCount = 0;
  for (const f of def.fields) {
    if (f.needs_review) reviewCount += 1;
  }
  return { fieldCount: def.fields.length, reviewCount };
}
