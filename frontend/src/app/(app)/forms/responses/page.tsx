import Link from "next/link";
import { FilePlus2, Table2 } from "lucide-react";

import {
  fetchFormResponseSheet,
  fetchResponseFormSummaries,
} from "@/lib/data/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ResponsesWorkspace } from "@/app/(app)/forms/responses/responses-workspace";

export const metadata = { title: "Responses" };

type PageProps = {
  searchParams: Promise<{ page?: string; form?: string }>;
};

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function ResponsesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const formId = params.form?.trim() || null;

  const supabase = await createSupabaseServerClient();

  const summaries = await fetchResponseFormSummaries(supabase);
  const totalResponses = summaries.reduce((n, s) => n + s.responseCount, 0);

  const sheet = formId
    ? await fetchFormResponseSheet(supabase, formId, page)
    : null;

  const inSheet = Boolean(formId && sheet);

  return (
    <div
      className={
        inSheet
          ? "mx-auto max-w-[min(100%,1600px)] space-y-8 anim-rise"
          : "mx-auto max-w-6xl space-y-10 anim-rise"
      }
    >
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
            / 05 · Responses
          </p>
          <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1]">
            {inSheet ? (
              <>
                Response <em className="text-brand">sheet</em>
              </>
            ) : (
              <>
                Form <em className="text-brand">workbooks</em>
              </>
            )}
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            {inSheet
              ? "Rows are submissions; columns are your form fields — scroll like a spreadsheet."
              : "Pick a form to open its answer grid. Each published form gets its own sheet."}
          </p>
        </div>
        {!inSheet && totalResponses > 0 && (
          <div className="flex shrink-0 items-center gap-4">
            <div className="text-right">
              <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
                Total rows
              </p>
              <p className="font-display text-4xl tracking-tight tabular-nums">
                {totalResponses.toLocaleString()}
              </p>
            </div>
            <div className="flex size-14 items-center justify-center rounded-xl border border-brand/30 bg-brand-tint text-brand">
              <Table2 className="size-6" />
            </div>
          </div>
        )}
      </header>

      <ResponsesWorkspace
        summaries={summaries}
        totalResponses={totalResponses}
        sheet={sheet}
        selectedFormId={formId}
      />

      {!inSheet && totalResponses === 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
            render={<Link href="/forms/create" />}
          >
            <FilePlus2 className="size-4" />
            New from sketch
          </Button>
        </div>
      )}
    </div>
  );
}
