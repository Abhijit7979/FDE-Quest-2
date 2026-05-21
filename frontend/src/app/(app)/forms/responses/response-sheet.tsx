"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Paperclip,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteResponse } from "@/app/(app)/forms/responses/actions";
import type { FormResponseSheetResult } from "@/lib/data/responses";
import {
  buildResponsesExport,
  buildSheetColumns,
  downloadBlob,
  downloadCsv,
  sheetCellValue,
} from "@/lib/responses/sheet";
import { createZip, type ZipEntry } from "@/lib/responses/zip";
import { Button } from "@/components/ui/button";
import { FormStatusPill } from "@/components/form-status-pill";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createResponseFileSignedUrl,
  isUploadedFileAnswer,
  RESPONSE_UPLOADS_BUCKET,
} from "@/lib/storage/response-uploads";
import { cn } from "@/lib/utils";

function sheetHref(formId: string, page: number): string {
  const params = new URLSearchParams({ form: formId });
  if (page > 1) params.set("page", String(page));
  return `/forms/responses?${params}`;
}

export function ResponseSheet({
  sheet,
}: {
  sheet: FormResponseSheetResult;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const columns = useMemo(
    () => buildSheetColumns(sheet.form.definition),
    [sheet.form.definition],
  );

  async function onExport() {
    if (exporting) return;
    const { csv, uploads } = buildResponsesExport(
      sheet.form.definition,
      sheet.rows,
    );
    const slug =
      sheet.form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40) || "responses";

    // No uploaded files on this page — ship a plain CSV as before.
    if (uploads.length === 0) {
      downloadCsv(`${slug}-page-${sheet.page}.csv`, csv);
      toast.success("CSV downloaded");
      return;
    }

    // Bundle the CSV together with every referenced upload into one ZIP.
    setExporting(true);
    const toastId = toast.loading(
      `Bundling CSV + ${uploads.length} file${uploads.length === 1 ? "" : "s"}…`,
    );
    try {
      const supabase = createSupabaseBrowserClient();
      const fetched = await Promise.all(
        uploads.map(async (up) => {
          const { data, error } = await supabase.storage
            .from(RESPONSE_UPLOADS_BUCKET)
            .download(up.storagePath);
          if (error || !data) return null;
          return {
            name: up.zipPath,
            data: new Uint8Array(await data.arrayBuffer()),
          } satisfies ZipEntry;
        }),
      );

      const entries: ZipEntry[] = [
        { name: "responses.csv", data: new TextEncoder().encode(csv) },
      ];
      let failed = 0;
      for (const entry of fetched) {
        if (entry) entries.push(entry);
        else failed += 1;
      }

      downloadBlob(`${slug}-page-${sheet.page}.zip`, createZip(entries));

      if (failed > 0) {
        toast.warning(
          `Downloaded — ${failed} file${failed === 1 ? "" : "s"} could not be retrieved`,
          { id: toastId },
        );
      } else {
        toast.success(
          `CSV + ${uploads.length} file${uploads.length === 1 ? "" : "s"} downloaded`,
          { id: toastId },
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not build the export.",
        { id: toastId },
      );
    } finally {
      setExporting(false);
    }
  }

  function onExportAllHint() {
    if (sheet.totalPages > 1) {
      toast.message("Exporting current page", {
        description: `Page ${sheet.page} of ${sheet.totalPages}. Use pagination to export other pages.`,
      });
    }
    void onExport();
  }

  function onDeleteRow(responseId: string) {
    if (
      !window.confirm(
        "Delete this row permanently? This cannot be undone.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteResponse(responseId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Row deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 font-mono-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-brand"
            render={<Link href="/forms/responses" />}
          >
            <ArrowLeft className="size-4" />
            All workbooks
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">
              {sheet.form.title}
            </h2>
            <FormStatusPill status={sheet.form.status} />
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            Spreadsheet view — one row per submission, columns match your form
            fields. Scroll horizontally for wide schemas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10 font-mono-tech text-[11px] uppercase tracking-[0.14em]"
            onClick={onExportAllHint}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            className="h-10 font-mono-tech text-[11px] uppercase tracking-[0.14em]"
            render={<Link href={`/forms/${sheet.form.id}/edit`} />}
          >
            <ExternalLink className="size-4" />
            Edit form
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <StatPill label="Rows" value={sheet.total} accent />
        <StatPill label="Columns" value={columns.length - 1} />
        <StatPill
          label="Page"
          value={`${sheet.page} / ${sheet.totalPages}`}
        />
      </div>

      {sheet.rows.length > 0 ? (
        <div className="relative overflow-hidden rounded-xl border border-brand/20 bg-card shadow-[inset_0_1px_0_0] shadow-brand/10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 blueprint-grid-fine opacity-[0.35]"
          />
          <div className="relative overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-brand-tint/80">
                  {columns.map((col) => (
                    <th
                      key={
                        col.key === "field"
                          ? col.field.id
                          : col.key
                      }
                      className={cn(
                        "sticky top-0 z-10 border border-border/90 bg-brand-tint/95 px-3 py-2.5 backdrop-blur-sm",
                        col.key === "row" && "w-12 text-center",
                        col.key === "submitted" && "min-w-[168px]",
                        col.key === "field" && "min-w-[148px] max-w-[220px]",
                      )}
                    >
                      {col.letter ? (
                        <span className="mb-0.5 block font-mono-tech text-[9px] font-semibold uppercase tracking-[0.2em] text-brand">
                          {col.letter}
                        </span>
                      ) : null}
                      <span className="block truncate font-mono-tech text-[10px] uppercase tracking-[0.12em] text-foreground">
                        {col.key === "field" ? col.field.label : col.label}
                      </span>
                    </th>
                  ))}
                  <th className="sticky top-0 z-10 w-12 border border-border/90 bg-brand-tint/95" />
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, rowIndex) => {
                  const rowNum =
                    (sheet.page - 1) * sheet.pageSize + rowIndex + 1;
                  return (
                    <tr
                      key={row.id}
                      className="group transition-colors hover:bg-brand-tint/25"
                    >
                      {columns.map((col) => (
                        <td
                          key={
                            col.key === "field"
                              ? `${row.id}-${col.field.id}`
                              : `${row.id}-${col.key}`
                          }
                          className={cn(
                            "border border-border/70 px-3 py-2 align-top",
                            col.key === "row" &&
                              "bg-muted/30 text-center font-mono-tech text-[11px] text-muted-foreground",
                            col.key === "submitted" &&
                              "whitespace-nowrap font-mono-tech text-[11px] tabular-nums",
                            col.key === "field" &&
                              "max-w-[220px] text-[13px] leading-snug",
                          )}
                        >
                          {col.key === "row" && rowNum}
                          {col.key === "submitted" &&
                            new Date(row.submittedAt).toLocaleString(
                              undefined,
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )}
                          {col.key === "field" &&
                            (col.field.type === "file_upload" ? (
                              <ResponseFileCell
                                value={row.answers[col.field.id]}
                              />
                            ) : (
                              <span className="line-clamp-4 break-words">
                                {sheetCellValue(col.field, row.answers) || (
                                  <span className="text-muted-foreground/50">
                                    —
                                  </span>
                                )}
                              </span>
                            ))}
                        </td>
                      ))}
                      <td className="border border-border/70 px-1 py-1 align-middle">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label="Delete row"
                          className="opacity-0 transition-opacity group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={() => onDeleteRow(row.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-display text-2xl italic text-muted-foreground">
            Sheet is empty
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            No submissions for this form yet.
          </p>
        </div>
      )}

      {sheet.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Showing rows {(sheet.page - 1) * sheet.pageSize + 1}–
            {Math.min(sheet.page * sheet.pageSize, sheet.total)} of{" "}
            {sheet.total}
          </p>
          <div className="flex gap-2">
            {sheet.page > 1 ? (
              <Button
                variant="outline"
                size="sm"
                className="font-mono-tech text-[11px] uppercase tracking-[0.12em]"
                render={<Link href={sheetHref(sheet.form.id, sheet.page - 1)} />}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="font-mono-tech text-[11px] uppercase tracking-[0.12em]"
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
            )}
            {sheet.page < sheet.totalPages ? (
              <Button
                variant="outline"
                size="sm"
                className="font-mono-tech text-[11px] uppercase tracking-[0.12em]"
                render={<Link href={sheetHref(sheet.form.id, sheet.page + 1)} />}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="font-mono-tech text-[11px] uppercase tracking-[0.12em]"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResponseFileCell({ value }: { value: unknown }) {
  const [busy, setBusy] = useState(false);

  if (!isUploadedFileAnswer(value)) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  const file = value;

  async function openFile() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const url = await createResponseFileSignedUrl(supabase, file.path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open the file.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void openFile()}
      disabled={busy}
      className="inline-flex max-w-full items-center gap-1.5 text-brand hover:underline disabled:opacity-60"
      title={`Open ${file.name}`}
    >
      {busy ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <Paperclip className="size-3.5 shrink-0" />
      )}
      <span className="truncate">{file.name}</span>
    </button>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5",
        accent ? "border-brand/35 bg-brand-tint text-brand" : "border-border",
      )}
    >
      <span>{label}</span>
      <span className="font-display text-lg leading-none tabular-nums">
        {value}
      </span>
    </span>
  );
}
