"use client";

import type {
  FormResponseSheetResult,
  ResponseFormSummary,
} from "@/lib/data/responses";
import { FormResponsePicker } from "@/app/(app)/forms/responses/form-response-picker";
import { ResponseSheet } from "@/app/(app)/forms/responses/response-sheet";

type Props = {
  summaries: ResponseFormSummary[];
  totalResponses: number;
  sheet: FormResponseSheetResult | null;
  selectedFormId: string | null;
};

export function ResponsesWorkspace({
  summaries,
  totalResponses,
  sheet,
  selectedFormId,
}: Props) {
  if (selectedFormId && sheet) {
    return <ResponseSheet sheet={sheet} />;
  }

  if (selectedFormId && !sheet) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Form not found or you don&apos;t have access.
      </p>
    );
  }

  return (
    <FormResponsePicker
      summaries={summaries}
      totalResponses={totalResponses}
    />
  );
}
