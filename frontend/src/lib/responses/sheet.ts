import type { Definition, FormField } from "@/lib/schema/definition";
import { formatAnswerValue } from "@/lib/responses/display";

export type SheetColumn =
  | { key: "row"; label: "#"; letter: "" }
  | { key: "submitted"; label: "Submitted"; letter: "A" }
  | { key: "field"; field: FormField; letter: string };

/** Excel-style column letters: 0 → A, 1 → B, … */
export function columnLetterFromIndex(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function buildSheetColumns(definition: Definition): SheetColumn[] {
  const cols: SheetColumn[] = [
    { key: "row", label: "#", letter: "" },
    { key: "submitted", label: "Submitted", letter: "A" },
  ];
  definition.fields.forEach((field, i) => {
    cols.push({
      key: "field",
      field,
      letter: columnLetterFromIndex(i + 1),
    });
  });
  return cols;
}

export function sheetCellValue(
  field: FormField,
  answers: Record<string, unknown>,
): string {
  if (!Object.prototype.hasOwnProperty.call(answers, field.id)) return "";
  return formatAnswerValue(field, answers[field.id]);
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildResponsesCsv(
  formTitle: string,
  definition: Definition,
  rows: Array<{
    submittedAt: string;
    answers: Record<string, unknown>;
  }>,
): string {
  const cols = buildSheetColumns(definition);
  const header = cols
    .map((c) => {
      if (c.key === "row") return "#";
      if (c.key === "submitted") return "Submitted";
      return c.field.label;
    })
    .map(escapeCsv)
    .join(",");

  const body = rows.map((row, i) =>
    cols
      .map((c) => {
        if (c.key === "row") return String(i + 1);
        if (c.key === "submitted") {
          return new Date(row.submittedAt).toISOString();
        }
        return sheetCellValue(c.field, row.answers);
      })
      .map(escapeCsv)
      .join(","),
  );

  return [header, ...body].join("\n");
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
