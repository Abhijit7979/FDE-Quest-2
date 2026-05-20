import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono-tech uppercase tracking-[0.25em] text-[11px] text-muted-foreground">
          00 / Onboard
        </p>
        <h1 className="font-display text-4xl tracking-tight leading-[1.05]">
          Make paper <em className="text-brand">talk</em>.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          One account. Unlimited sketches turned into living, breathing forms.
        </p>
      </div>
      <SignupForm />
      <div className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Log in →
        </Link>
      </div>
    </div>
  );
}
