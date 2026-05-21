"use client";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { buildShareUrl } from "@/lib/data/forms";
import { Button } from "@/components/ui/button";

export function ShareLinkActions({ slug }: { slug: string }) {
  const shareUrl = buildShareUrl(slug);

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={copyShareUrl}
        className="h-8 font-mono-tech uppercase tracking-[0.12em] text-[10px]"
      >
        <Copy className="size-3.5" />
        Copy
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        render={
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open public form"
          />
        }
      >
        <ExternalLink className="size-4" />
      </Button>
    </div>
  );
}
