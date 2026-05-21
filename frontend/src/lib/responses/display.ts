import { coerceDefinition, type Definition, type FormField } from "@/lib/schema/definition";
import { isUploadedFileAnswer } from "@/lib/storage/response-uploads";

export type LabeledAnswer = {
  fieldId: string;
  label: string;
  value: string;
};

/** Map stored answer keys (field ids) to human-readable label + value rows. */
export function labeledAnswers(
  definition: Definition,
  answers: Record<string, unknown>,
): LabeledAnswer[] {
  const rows: LabeledAnswer[] = [];
  for (const field of definition.fields) {
    if (!Object.prototype.hasOwnProperty.call(answers, field.id)) continue;
    rows.push({
      fieldId: field.id,
      label: field.label,
      value: formatAnswerValue(field, answers[field.id]),
    });
  }
  return rows;
}

export function formatAnswerValue(field: FormField, raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "—";

  if (field.type === "multi_choice" && Array.isArray(raw)) {
    return raw.map(String).join(", ");
  }

  if (field.type === "yes_no") {
    if (raw === true || raw === "true" || raw === "yes") return "Yes";
    if (raw === false || raw === "false" || raw === "no") return "No";
  }

  if (field.type === "file_upload") {
    return isUploadedFileAnswer(raw) ? raw.name : "—";
  }

  return String(raw);
}

/** One-line preview for the inbox table. */
export function responsePreview(
  definition: Definition,
  answers: Record<string, unknown>,
): string {
  const rows = labeledAnswers(definition, answers);
  if (rows.length === 0) return "No answers";
  const first = rows[0];
  const extra = rows.length > 1 ? ` · +${rows.length - 1} more` : "";
  const snippet =
    first.value.length > 48 ? `${first.value.slice(0, 48)}…` : first.value;
  return `${first.label}: ${snippet}${extra}`;
}

export function parseAnswersJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function definitionFromJoined(value: unknown): Definition {
  const { definition } = coerceDefinition(value);
  return definition;
}
