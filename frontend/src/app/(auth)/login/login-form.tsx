"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type AuthState } from "../actions";
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
      {pending ? "Authenticating…" : "Log in →"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <AuthField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        placeholder="you@example.com"
      />
      <AuthField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        rightSlot={
          <Link
            href="/forgot-password"
            className="font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground hover:text-brand transition-colors"
          >
            Forgot?
          </Link>
        }
      />
      {state.error ? (
        <p
          className="text-sm text-destructive border-l-2 border-destructive pl-3"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
