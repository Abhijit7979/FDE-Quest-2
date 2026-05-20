import { cn } from "@/lib/utils";
import type { FormStatus } from "@/lib/data/forms";

const STATUS_STYLES: Record<
  FormStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  published: {
    label: "Published",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  draft: {
    label: "Draft",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  archived: {
    label: "Archived",
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/50",
  },
};

export function FormStatusPill({ status }: { status: FormStatus | string | null }) {
  const s = STATUS_STYLES[(status as FormStatus) ?? "draft"] ?? STATUS_STYLES.draft;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono-tech uppercase tracking-[0.16em] text-[10px]",
        s.bg,
        s.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
