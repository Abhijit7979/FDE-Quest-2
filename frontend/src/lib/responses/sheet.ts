import type { Definition, FormField } from "@/lib/schema/definition";
import { formatAnswerValue } from "@/lib/responses/display";
import { isUploadedFileAnswer } from "@/lib/storage/response-uploads";

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

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, csv: string): void {
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

/** A respondent-uploaded file referenced by an exported CSV row. */
export type ResponseUploadRef = {
  /** Path in the `response-uploads` Storage bucket. */
  storagePath: string;
  /** Path the file occupies inside the export ZIP — matches its CSV cell. */
  zipPath: string;
  /** Original file name as submitted. */
  name: string;
};

/** Replace path separators so a respondent's file name can't nest folders in the ZIP. */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/]/g, "_").trim();
  return cleaned || "file";
}

/**
 * Build the responses CSV and the list of uploaded files it references.
 *
 * For `file_upload` fields the CSV cell holds the file's path inside the
 * export ZIP (`files/row-N/<fieldId>-<name>`) rather than just its name, so
 * the spreadsheet points directly at the bundled file. `uploads` is empty when
 * no rows carry an uploaded file — callers can then ship a plain `.csv`.
 */
export function buildResponsesExport(
  definition: Definition,
  rows: Array<{
    submittedAt: string;
    answers: Record<string, unknown>;
  }>,
): { csv: string; uploads: ResponseUploadRef[] } {
  const cols = buildSheetColumns(definition);
  const uploads: ResponseUploadRef[] = [];

  const header = cols
    .map((c) => {
      if (c.key === "row") return "#";
      if (c.key === "submitted") return "Submitted";
      return c.field.label;
    })
    .map(escapeCsv)
    .join(",");

  const body = rows.map((row, i) => {
    const rowNum = i + 1;
    return cols
      .map((c) => {
        if (c.key === "row") return String(rowNum);
        if (c.key === "submitted") {
          return new Date(row.submittedAt).toISOString();
        }
        if (c.field.type === "file_upload") {
          const raw = row.answers[c.field.id];
          if (!isUploadedFileAnswer(raw)) return "";
          const zipPath = `files/row-${rowNum}/${c.field.id}-${sanitizeFileName(raw.name)}`;
          uploads.push({ storagePath: raw.path, zipPath, name: raw.name });
          return zipPath;
        }
        return sheetCellValue(c.field, row.answers);
      })
      .map(escapeCsv)
      .join(",");
  });

  return { csv: [header, ...body].join("\n"), uploads };
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
