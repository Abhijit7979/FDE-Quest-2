"use client";

import Link from "next/link";
import { ArrowUpRight, FileSpreadsheet, Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { ResponseFormSummary } from "@/lib/data/responses";
import { FormStatusPill } from "@/components/form-status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
function formSheetHref(formId: string): string {
  return `/forms/responses?form=${formId}`;
}

export function FormResponsePicker({
  summaries,
  totalResponses,
}: {
  summaries: ResponseFormSummary[];
  totalResponses: number;
}) {
  const [search, setSearch] = useState("");

  const withData = summaries.filter((s) => s.responseCount > 0);

  const filteredWithData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withData;
    return withData.filter((s) => s.title.toLowerCase().includes(q));
  }, [withData, search]);

  if (totalResponses === 0) {
    return <EmptyResponses />;
  }

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden border-brand/25 p-0">
        <div
          aria-hidden
          className="absolute inset-0 blueprint-grid-fine opacity-50"
        />
        <CardContent className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Find a form workbook…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 border-brand/20 bg-background/80 pl-10"
            />
          </div>
          <p className="shrink-0 font-mono-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {withData.length} workbook{withData.length === 1 ? "" : "s"} ·{" "}
            {totalResponses} row{totalResponses === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      {filteredWithData.length > 0 ? (
        <section className="space-y-4">
          <SectionLabel tag="A" title="Open a response sheet" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredWithData.map((form, i) => (
              <li key={form.id} className="anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Link
                  href={formSheetHref(form.id)}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-brand/50 hover:shadow-[0_8px_30px_-12px] hover:shadow-brand/25"
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-brand/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand-tint text-brand">
                        <FileSpreadsheet className="size-5" />
                      </div>
                      <FormStatusPill status={form.status} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-display text-2xl leading-tight tracking-tight truncate">
                        {form.title}
                      </h3>
                      <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {form.fieldCount} column
                        {form.fieldCount === 1 ? "" : "s"} ·{" "}
                        {form.responseCount} row
                        {form.responseCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    {form.lastSubmittedAt && (
                      <p className="text-xs text-muted-foreground">
                        Last entry{" "}
                        <span className="text-foreground">
                          {new Date(form.lastSubmittedAt).toLocaleString(
                            undefined,
                            { dateStyle: "medium", timeStyle: "short" },
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-5 py-3 font-mono-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground group-hover:bg-brand-tint/40 group-hover:text-brand">
                    <span>Open sheet</span>
                    <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No workbooks match &ldquo;{search}&rdquo;.
        </p>
      )}
    </div>
  );
}

function SectionLabel({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-6 items-center justify-center rounded border border-brand/30 bg-brand-tint font-mono-tech text-[10px] font-medium text-brand">
        {tag}
      </span>
      <h2 className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </h2>
    </div>
  );
}

function EmptyResponses() {
  return (
    <Card className="relative overflow-hidden p-0">
      <div aria-hidden className="absolute inset-0 blueprint-grid-fine opacity-60" />
      <div
        aria-hidden
        className="absolute -top-10 left-1/2 h-32 w-72 -translate-x-1/2 rsi-stripes opacity-30"
      />
      <CardContent className="relative flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-brand/20 blur-xl" />
          <div className="relative flex size-14 items-center justify-center rounded-2xl border border-brand/30 bg-card text-brand">
            <Inbox className="size-6" />
          </div>
        </div>
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          No workbooks yet
        </p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">
          Zero <em className="text-brand">rows</em> to chart.
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Publish a form and collect answers — each form becomes its own
          spreadsheet-style sheet here.
        </p>
        <Button
          className="mt-6 font-mono-tech text-[12px] uppercase tracking-[0.15em]"
          render={<Link href="/forms/create" />}
        >
          Build a form
        </Button>
      </CardContent>
    </Card>
  );
}
