"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PublicFieldInput } from "@/components/public-form/field-input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PublicFormError,
  submitFormResponse,
  type PublicFormRecord,
} from "@/lib/data/public-form";
import {
  normalizeAnswers,
  validateAnswers,
} from "@/lib/public-form/validate-answers";

export function PublicForm({ form }: { form: PublicFormRecord }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center anim-rise">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="font-display text-2xl tracking-tight">Thank you</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your response to &ldquo;{form.title}&rdquo; was submitted successfully.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const errors = validateAnswers(form.fields, answers);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = normalizeAnswers(form.fields, answers);
      await submitFormResponse(supabase, form.id, payload);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof PublicFormError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not submit. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 md:py-14 anim-rise">
      <header className="mb-8 space-y-2 text-center md:text-left">
        <p className="font-mono-tech uppercase tracking-[0.2em] text-[10px] text-muted-foreground">
          Sketch-to-Form
        </p>
        <h1 className="font-display text-3xl tracking-tight leading-tight">
          {form.title}
        </h1>
        {form.description && (
          <p className="text-sm text-muted-foreground">{form.description}</p>
        )}
      </header>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-6 rounded-xl border bg-card p-5 shadow-sm md:p-6"
        noValidate
      >
        {form.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This form has no fields yet.
          </p>
        ) : (
          <ul className="space-y-6">
            {form.fields.map((field) => (
              <li key={field.id}>
                <PublicFieldInput
                  field={field}
                  value={answers[field.id]}
                  onChange={(next) => {
                    setAnswers((prev) => ({ ...prev, [field.id]: next }));
                    setFieldErrors((prev) => {
                      if (!prev[field.id]) return prev;
                      const { [field.id]: _, ...rest } = prev;
                      return rest;
                    });
                  }}
                  error={fieldErrors[field.id]}
                />
              </li>
            ))}
          </ul>
        )}

        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting || form.fields.length === 0}
          className="min-h-11 w-full font-mono-tech uppercase tracking-[0.15em] text-[11px]"
        >
          {submitting ? (
            <Loader2 className="animate-spin" />
          ) : null}
          Submit
        </Button>
      </form>
    </div>
  );
}
