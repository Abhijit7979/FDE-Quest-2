"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FormField } from "@/lib/schema/definition";

import { scrollFieldRowIntoView, useReviewQueue } from "./use-review-queue";

export function ReviewQueueBanner({
  fields,
  selectedFieldId,
  onSelectField,
  onMarkReviewed,
}: {
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onMarkReviewed: (id: string) => void;
}) {
  const { reviewIds, reviewCount, resolveIndex, goNext, goPrev } =
    useReviewQueue(fields);
  const [completionFlash, setCompletionFlash] = useState(false);
  const hadReviewRef = useRef(reviewCount > 0);

  const currentIndex = resolveIndex(selectedFieldId);
  const displayIndex = reviewCount > 0 ? currentIndex + 1 : 0;

  useEffect(() => {
    if (hadReviewRef.current && reviewCount === 0) {
      setCompletionFlash(true);
      const t = window.setTimeout(() => setCompletionFlash(false), 2800);
      return () => window.clearTimeout(t);
    }
    if (reviewCount > 0) hadReviewRef.current = true;
  }, [reviewCount]);

  useEffect(() => {
    if (selectedFieldId && reviewIds.includes(selectedFieldId)) {
      scrollFieldRowIntoView(selectedFieldId);
    }
  }, [selectedFieldId, reviewIds]);

  const currentId = reviewIds[currentIndex] ?? null;

  const label = useMemo(() => {
    if (!currentId) return null;
    const f = fields.find((x) => x.id === currentId);
    return f?.label || "Untitled field";
  }, [currentId, fields]);

  if (completionFlash) {
    return (
      <div
        className="sticky top-14 z-20 rounded-lg border border-emerald-500/40 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30 anim-rise"
        role="status"
      >
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <p className="font-display italic text-lg">All fields reviewed.</p>
        </div>
      </div>
    );
  }

  if (reviewCount === 0) return null;

  function handleNext() {
    const nextId = goNext(selectedFieldId);
    if (nextId) onSelectField(nextId);
  }

  function handlePrev() {
    const prevId = goPrev(selectedFieldId);
    if (prevId) onSelectField(prevId);
  }

  function handleMarkReviewed() {
    if (!currentId) return;
    onMarkReviewed(currentId);
    const remaining = reviewIds.filter((id) => id !== currentId);
    if (remaining.length > 0) {
      const nextIdx = Math.min(currentIndex, remaining.length - 1);
      onSelectField(remaining[nextIdx] ?? remaining[0]);
    }
  }

  function handleReviewAll() {
    const first = reviewIds[0];
    if (first) onSelectField(first);
  }

  return (
    <div
      className={cn(
        "sticky top-14 z-20 overflow-hidden rounded-lg border border-amber-500/30",
        "bg-amber-50 dark:bg-amber-950/25 anim-rise",
      )}
      style={{ animationDelay: "80ms" }}
      role="region"
      aria-label="Fields to verify"
    >
      <div className="h-0.5 w-full review-rail-stripes opacity-80" aria-hidden />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Sparkles className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none tracking-tight text-amber-900 dark:text-amber-100 tabular-nums">
              {String(displayIndex).padStart(2, "0")}
            </span>
            <span className="font-mono-tech text-sm text-amber-800/60 dark:text-amber-200/50">
              / {String(reviewCount).padStart(2, "0")}
            </span>
          </div>
          <div className="min-w-0 border-l border-amber-500/25 pl-4">
            <p className="font-mono-tech uppercase tracking-[0.18em] text-[10px] text-amber-800/70 dark:text-amber-200/70">
              Fields to verify
            </p>
            {label && (
              <p className="truncate text-sm font-medium text-amber-950 dark:text-amber-50">
                {label}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrev}
            className="font-mono-tech uppercase tracking-[0.12em] text-[10px] border-amber-500/30 bg-background/60"
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleNext}
            className="font-mono-tech uppercase tracking-[0.12em] text-[10px] border-amber-500/30 bg-background/60"
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={handleMarkReviewed}
            className="font-mono-tech uppercase tracking-[0.12em] text-[10px]"
          >
            Mark reviewed
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReviewAll}
            className="font-mono-tech uppercase tracking-[0.12em] text-[10px] text-amber-900/80 dark:text-amber-100/80"
          >
            Jump to first
          </Button>
        </div>
      </div>
    </div>
  );
}
