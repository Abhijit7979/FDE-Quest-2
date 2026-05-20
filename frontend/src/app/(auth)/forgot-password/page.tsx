import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono-tech uppercase tracking-[0.25em] text-[11px] text-muted-foreground">
          Recovery
        </p>
        <h1 className="font-display text-4xl tracking-tight leading-[1.05]">
          Reset your <em className="text-brand">key</em>.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&apos;ll email a one-time link. Click it, and set a fresh password —
          no questions asked.
        </p>
      </div>
      <ForgotPasswordForm />
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline underline-offset-4"
      >
        ← Back to log in
      </Link>
    </div>
  );
}
