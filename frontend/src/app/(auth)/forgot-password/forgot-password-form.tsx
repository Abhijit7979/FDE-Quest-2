"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset, type AuthState } from "../actions";
import { AuthField } from "../field";
import { Button } from "@/components/ui/button";

const initialState: AuthState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full h-11 text-[13px] font-medium tracking-wide uppercase font-mono-tech"
      disabled={pending}
    >
      {pending ? "Sending…" : "Send reset link →"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <AuthField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
      />
      {state.error ? (
        <p
          className="text-sm text-destructive border-l-2 border-destructive pl-3"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p
          className="text-sm text-emerald-700 border-l-2 border-emerald-500 pl-3"
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
