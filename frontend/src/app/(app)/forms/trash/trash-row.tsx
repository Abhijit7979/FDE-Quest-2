"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { restoreDraft } from "@/app/(app)/forms/actions";
import { isTrashRestorable, trashExpiresAt } from "@/lib/data/forms";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function TrashRow({
  id,
  title,
  deleted_at,
  fieldCount,
  showSeparator,
}: {
  id: string;
  title: string;
  deleted_at: string;
  fieldCount: number;
  showSeparator: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const restorable = isTrashRestorable(deleted_at);
  const expiresAt = trashExpiresAt(deleted_at);

  function onRestore() {
    startTransition(async () => {
      const result = await restoreDraft(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Draft restored");
      router.refresh();
    });
  }

  return (
    <li>
      {showSeparator && <Separator />}
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-lg leading-tight truncate">
            {title || "Untitled form"}
          </p>
          <p className="font-mono-tech uppercase tracking-[0.16em] text-[11px] text-muted-foreground">
            Deleted{" "}
            {new Date(deleted_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            <span className="mx-2 text-border">·</span>
            {fieldCount} {fieldCount === 1 ? "field" : "fields"}
          </p>
          <p
            className={
              restorable
                ? "text-xs text-muted-foreground"
                : "text-xs text-destructive"
            }
          >
            {restorable
              ? `Permanent deletion after ${expiresAt.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}`
              : "Retention expired — will be removed on the next purge"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !restorable}
          onClick={onRestore}
          className="shrink-0 font-mono-tech uppercase tracking-[0.15em] text-[10px]"
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RotateCcw />
          )}
          Restore
        </Button>
      </div>
    </li>
  );
}
