"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stripes } from "@/components/brand-mark";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background">
        <div className="flex min-h-svh flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-md space-y-8 text-center anim-rise">
            <div
              aria-hidden
              className="absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-48 rsi-stripes opacity-20"
            />

            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
              <AlertTriangle className="size-8 text-destructive" />
            </div>

            <div className="space-y-3">
              <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
                Unexpected error
              </p>
              <h1 className="font-display text-4xl tracking-tight">
                Something <em className="text-destructive">broke</em>.
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                The RSI pipeline hit an unexpected snag. Try refreshing, or head
                back to base.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                className="h-10 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
                onClick={() => reset()}
              >
                <RefreshCw className="size-4" />
                Try again
              </Button>
              <Button
                className="h-10 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
                render={<Link href="/home" />}
              >
                <Home className="size-4" />
                Back to home
              </Button>
            </div>

            {error.digest && (
              <p className="font-mono-tech text-[10px] tracking-[0.14em] text-muted-foreground/50">
                Ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
