"use client";

import { useMemo } from "react";
import { Check, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FormField } from "@/lib/schema/definition";

export type ReadinessCheck = {
  id: string;
  label: string;
  pass: boolean;
  failMessage: string;
};

export function buildReadinessChecks({
  fields,
  validationOk,
  isDirty,
  savePhase,
}: {
  fields: FormField[];
  validationOk: boolean;
  isDirty: boolean;
  savePhase: "idle" | "saving" | "saved" | "error";
}): ReadinessCheck[] {
  const reviewCount = fields.filter((f) => f.needs_review).length;

  const savedPass =
    !isDirty || savePhase === "saving" || savePhase === "saved";

  return [
    {
      id: "fields",
      label: "At least one field",
      pass: fields.length > 0,
      failMessage: "Add a field to your form.",
    },
    {
      id: "valid",
      label: "Schema valid",
      pass: validationOk,
      failMessage: "Fix validation errors in the field list.",
    },
    {
      id: "review",
      label: "AI review complete",
      pass: reviewCount === 0,
      failMessage:
        reviewCount === 1
          ? "1 field still flagged for review."
          : `${reviewCount} fields still flagged for review.`,
    },
    {
      id: "saved",
      label: "Changes saved",
      pass: savedPass,
      failMessage: isDirty
        ? "Unsaved edits — will save automatically before publish."
        : "Save pending.",
    },
  ];
}

const BLOCKING_CHECK_IDS = new Set(["fields", "valid", "review"]);

export function getPublishBlockReason(checks: ReadinessCheck[]): string | null {
  const failing = checks.filter(
    (c) => !c.pass && BLOCKING_CHECK_IDS.has(c.id),
  );
  if (failing.length === 0) return null;
  return failing.map((c) => c.failMessage).join(" ");
}

export function canPublish(checks: ReadinessCheck[]): boolean {
  return checks
    .filter((c) => BLOCKING_CHECK_IDS.has(c.id))
    .every((c) => c.pass);
}

export function PublishReadiness({
  checks,
  className,
}: {
  checks: ReadinessCheck[];
  className?: string;
}) {
  const allPass = useMemo(() => checks.every((c) => c.pass), [checks]);

  return (
    <div
      className={cn(
        "space-y-2 border-t border-border pt-4",
        allPass && "border-emerald-500/30",
        className,
      )}
      aria-label="Publish readiness"
    >
      <p className="font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground">
        Ready to publish
      </p>
      <ul className="space-y-1.5">
        {checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              "flex items-start gap-2 text-xs",
              check.pass ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {check.pass ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            )}
            <span className={cn(check.pass && "line-through opacity-70")}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function usePublishReady(checks: ReadinessCheck[]) {
  return useMemo(() => canPublish(checks), [checks]);
}
