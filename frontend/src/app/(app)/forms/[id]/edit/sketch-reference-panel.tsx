"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
export function SketchReferencePanel({ sketchUrl }: { sketchUrl: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="anim-rise noise-overlay rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        {!open && (
          <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sketchUrl}
              alt=""
              width={56}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </span>
        )}
        <span className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
          Source sketch
        </span>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      <div className="sketch-panel-grid" data-open={open ? "true" : "false"}>
        <div>
          <div className="proofing-frame border-t-0 p-4">
            <a
              href={sketchUrl}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border bg-muted/50 shadow-inner"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sketchUrl}
                alt="Source sketch for this form"
                loading="lazy"
                decoding="async"
                className="mx-auto max-h-52 w-full object-contain"
              />
            </a>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="font-mono-tech uppercase tracking-[0.15em] text-[10px]"
                render={
                  <a href={sketchUrl} target="_blank" rel="noreferrer" />
                }
              >
                <ExternalLink className="size-3.5" />
                Open full size
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
