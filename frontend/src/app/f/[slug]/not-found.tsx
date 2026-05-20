import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function PublicFormNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono-tech uppercase tracking-[0.2em] text-[10px] text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 font-display text-2xl tracking-tight">
        Form not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This link may be wrong, or the form is no longer published.
      </p>
      <Button
        className="mt-6"
        variant="outline"
        render={<Link href="/login">Sign in</Link>}
      />
    </div>
  );
}
