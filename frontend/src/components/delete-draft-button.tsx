"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteDraft,
  deleteDraftAndRedirect,
} from "@/app/(app)/forms/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeleteDraftButtonProps = {
  formId: string;
  formTitle?: string;
  redirectToTrash?: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "destructive";
  className?: string;
  label?: string;
  onDeleted?: () => void;
};

export function DeleteDraftButton({
  formId,
  formTitle,
  redirectToTrash = false,
  size = "sm",
  variant = "outline",
  className,
  label = "Move to trash",
  onDeleted,
}: DeleteDraftButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const name = formTitle?.trim() || "Untitled form";
    if (
      !window.confirm(
        `Move "${name}" to trash? You can restore it within 24 hours.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = redirectToTrash
        ? await deleteDraftAndRedirect(formId)
        : await deleteDraft(formId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (!redirectToTrash) {
        toast.success("Moved to trash", {
          description: "Restore from Trash within 24 hours.",
        });
        onDeleted?.();
        router.refresh();
      }
    });
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={pending}
      onClick={onClick}
      className={cn(
        "font-mono-tech uppercase tracking-[0.15em] text-[10px]",
        variant === "outline" &&
          "text-destructive hover:text-destructive hover:bg-destructive/10",
        className,
      )}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      {label}
    </Button>
  );
}
