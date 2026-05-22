"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowUpRight, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteDraft } from "@/app/(app)/forms/actions";
import { FormStatusPill } from "@/components/form-status-pill";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

export type DraftListRowProps = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  fieldCount: number;
  reviewCount: number;
  sketchUrl: string | null;
  index: number;
  showSeparator: boolean;
};

export function DraftListRow({
  id,
  title,
  status,
  updated_at,
  fieldCount,
  reviewCount,
  sketchUrl,
  index,
  showSeparator,
}: DraftListRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onMoveToTrash() {
    const name = title?.trim() || "Untitled form";
    if (
      !window.confirm(
        `Move "${name}" to trash? You can restore it within 24 hours.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDraft(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Moved to trash", {
        description: "Restore from Trash within 24 hours.",
      });
      router.refresh();
    });
  }

  return (
    <li className="anim-rise" style={{ animationDelay: `${index * 50}ms` }}>
      {showSeparator && <Separator />}
      <div className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/40 sm:px-5">
        <Link
          href={`/forms/${id}/edit`}
          className="flex min-w-0 flex-1 items-center gap-4"
        >
          <DraftThumb sketchUrl={sketchUrl} index={index} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-display text-lg leading-tight truncate">
              {title || "Untitled form"}
            </p>
            <p className="font-mono-tech uppercase tracking-[0.16em] text-[11px] text-muted-foreground">
              Updated{" "}
              {new Date(updated_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              <span className="mx-2 text-border">·</span>
              {fieldCount} {fieldCount === 1 ? "field" : "fields"}
              {reviewCount > 0 && (
                <>
                  <span className="mx-2 text-border">·</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {reviewCount} to review
                  </span>
                </>
              )}
            </p>
          </div>
          <FormStatusPill status={status} />
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                aria-label={`Actions for ${title || "Untitled form"}`}
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onClick={onMoveToTrash}
            >
              <Trash2 />
              Move to trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function DraftThumb({
  sketchUrl,
  index,
}: {
  sketchUrl: string | null;
  index: number;
}) {
  if (sketchUrl) {
    return (
      <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sketchUrl}
          alt=""
          width={64}
          height={48}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/50 font-mono-tech text-[11px] tracking-[0.18em] text-muted-foreground">
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}
