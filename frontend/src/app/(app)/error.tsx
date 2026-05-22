"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <Card className="relative max-w-md w-full overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 blueprint-grid-fine opacity-40"
        />
        <div
          aria-hidden
          className="absolute -top-6 left-1/2 -translate-x-1/2 h-20 w-40 brand-stripes opacity-20"
        />
        <CardContent className="relative space-y-6 p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
            <AlertTriangle className="size-7 text-destructive" />
          </div>

          <div className="space-y-2">
            <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
              Route error
            </p>
            <h2 className="font-display text-3xl tracking-tight">
              Couldn&apos;t load <em className="text-destructive">this page</em>.
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Something went wrong fetching data. Give it another shot.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              className="h-10 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
              onClick={() => reset()}
            >
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>

          {error.digest && (
            <p className="font-mono-tech text-[10px] tracking-[0.14em] text-muted-foreground/50">
              Ref: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
