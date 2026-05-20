"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FormField } from "@/lib/schema/definition";

const DISMISS_KEY = "rsi-draft-orientation-dismissed";

const STEPS = [
  { num: "01", label: "Edit fields" },
  { num: "02", label: "Review AI flags" },
  { num: "03", label: "Publish" },
] as const;

export function DraftOrientation({
  fields,
  validationOk,
}: {
  fields: FormField[];
  validationOk: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  const reviewCount = useMemo(
    () => fields.filter((f) => f.needs_review).length,
    [fields],
  );

  const activeStep = useMemo(() => {
    if (fields.length > 0 && validationOk && reviewCount === 0) {
      return 2;
    }
    if (reviewCount > 0) return 1;
    return 0;
  }, [fields.length, validationOk, reviewCount]);

  const subtitle = useMemo(() => {
    if (reviewCount > 0) {
      return reviewCount === 1
        ? "One field still needs your eye before you publish."
        : `${reviewCount} fields still need your eye before you publish.`;
    }
    if (fields.length === 0) {
      return "Add at least one field, then publish when you're ready.";
    }
    if (!validationOk) {
      return "Fix validation issues in the field list before publishing.";
    }
    return "Looking good — publish when you're ready to share.";
  }, [reviewCount, fields.length, validationOk]);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <Card className="relative overflow-hidden noise-overlay anim-rise">
      <div
        aria-hidden
        className="absolute inset-0 blueprint-grid-fine opacity-50 pointer-events-none"
      />
      <CardContent className="relative flex flex-col gap-4 p-4 md:p-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3 min-w-0 flex-1">
          <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
            Draft workflow
          </p>
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((step, i) => (
              <li
                key={step.num}
                className={cn(
                  "relative flex items-center gap-2 rounded-md border px-3 py-2 transition-colors",
                  i === activeStep
                    ? "border-brand bg-brand-tint pl-4"
                    : "border-border bg-card/80 text-muted-foreground",
                  i === activeStep &&
                    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-md before:bg-brand before:rsi-stripes",
                )}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span
                  className={cn(
                    "font-mono-tech text-[10px] tracking-[0.18em]",
                    i === activeStep ? "text-brand" : "text-muted-foreground/70",
                  )}
                >
                  {step.num}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    i === activeStep && "text-foreground",
                  )}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="font-display italic text-lg leading-snug text-balance">
            {subtitle}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label="Dismiss workflow guide"
          className="shrink-0 self-start md:self-center"
        >
          <X className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
