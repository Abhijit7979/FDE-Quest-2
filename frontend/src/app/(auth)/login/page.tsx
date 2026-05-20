import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono-tech uppercase tracking-[0.25em] text-[11px] text-muted-foreground">
          01 / Authenticate
        </p>
        <h1 className="font-display text-4xl tracking-tight leading-[1.05]">
          Welcome <em className="text-brand">back</em>.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Pick up where you left off — your sketches and forms are waiting.
        </p>
      </div>
      <LoginForm />
      <div className="text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Create one →
        </Link>
      </div>
    </div>
  );
}
