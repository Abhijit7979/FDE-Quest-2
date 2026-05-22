import type { ReactNode } from "react";

export function EmptyState({
  label,
  headline,
  description,
  action,
  decoration = "default",
}: {
  label: string;
  headline: ReactNode;
  description: string;
  action?: ReactNode;
  decoration?: "default" | "minimal" | "none";
}) {
  return (
    <div
      className={
        decoration === "none"
          ? "p-10 text-center"
          : "relative overflow-hidden p-10 text-center"
      }
    >
      {decoration !== "none" && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 blueprint-grid-fine opacity-40"
          />
          <div
            aria-hidden
            className="absolute -top-6 left-1/2 -translate-x-1/2 h-24 w-48 brand-stripes opacity-30"
          />
          {/* Side accent stripes */}
          <div
            aria-hidden
            className="absolute top-1/3 -left-4 h-16 w-2 brand-stripes opacity-20 rotate-90"
          />
          <div
            aria-hidden
            className="absolute top-1/2 -right-4 h-12 w-2 brand-stripes opacity-15 rotate-90"
          />
        </>
      )}
      {decoration === "minimal" && (
        <div
          aria-hidden
          className="absolute top-8 -left-4 h-12 w-2 brand-stripes opacity-20 rotate-90"
        />
      )}
      <div className="relative space-y-3">
        <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
          {label}
        </p>
        <p className="font-display italic text-2xl">{headline}</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
