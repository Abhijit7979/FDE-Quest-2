"use client";

import { useCallback, useMemo } from "react";
import type { FormField } from "@/lib/schema/definition";

export function useReviewQueue(fields: FormField[]) {
  const reviewIds = useMemo(
    () => fields.filter((f) => f.needs_review).map((f) => f.id),
    [fields],
  );

  const resolveIndex = useCallback(
    (selectedFieldId: string | null) => {
      if (reviewIds.length === 0) return 0;
      if (!selectedFieldId) return 0;
      const idx = reviewIds.indexOf(selectedFieldId);
      return idx >= 0 ? idx : 0;
    },
    [reviewIds],
  );

  const goNext = useCallback(
    (selectedFieldId: string | null): string | null => {
      if (reviewIds.length === 0) return null;
      const idx = resolveIndex(selectedFieldId);
      return reviewIds[(idx + 1) % reviewIds.length] ?? null;
    },
    [reviewIds, resolveIndex],
  );

  const goPrev = useCallback(
    (selectedFieldId: string | null): string | null => {
      if (reviewIds.length === 0) return null;
      const idx = resolveIndex(selectedFieldId);
      return reviewIds[(idx - 1 + reviewIds.length) % reviewIds.length] ?? null;
    },
    [reviewIds, resolveIndex],
  );

  return {
    reviewIds,
    reviewCount: reviewIds.length,
    resolveIndex,
    goNext,
    goPrev,
  };
}

export function scrollFieldRowIntoView(fieldId: string) {
  const el = document.getElementById(`field-row-${fieldId}`);
  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
