"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  FilePlus2,
  Layers,
  PanelLeft,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markTourCompleted } from "@/app/(app)/tour-actions";

/* --------------------------------------------------------------------------
 * Product tour — a fresh, dependency-free implementation.
 *
 * A single client component that renders both the header "Take a tour" button
 * and (via a portal) the spotlight overlay. It anchors each step to a real DOM
 * element via a `[data-tour-id]` selector; if that element can't be found or
 * isn't visible (e.g. the sidebar is collapsed on mobile) the step gracefully
 * falls back to a centered card with no spotlight.
 *
 * Layout is recomputed every animation frame while open, so the spotlight
 * tracks the target through sidebar animations, scrolling and viewport resizes.
 * Nothing here touches `window`/`document` during render, so it is safe under
 * SSR / Vercel — the overlay only mounts after `useEffect` confirms the client.
 * ------------------------------------------------------------------------ */

type Placement = "center" | "top" | "bottom" | "left" | "right";

type TourStep = {
  id: string;
  /** CSS selector for the element to spotlight, or null for a centered card. */
  target: string | null;
  placement: Placement;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    placement: "center",
    icon: Sparkles,
    title: "Welcome to Sketch-to-Form",
    body: "Turn a photo of a hand-drawn form into a live, shareable digital form in seconds. Here is a quick tour of your workspace.",
  },
  {
    id: "sidebar",
    target: '[data-tour-id="sidebar-nav"]',
    placement: "right",
    icon: PanelLeft,
    title: "Your workspace",
    body: "Everything lives in this sidebar — Home for an overview, Drafts and Published for your forms, Trash for recently deleted, and Responses for submissions.",
  },
  {
    id: "create",
    target: '[data-tour-id="nav-create"]',
    placement: "right",
    icon: FilePlus2,
    title: "Create a form",
    body: "Upload a photo of your sketch and the AI extracts the fields for you — or pick “Start blank” to build one by hand.",
  },
  {
    id: "editor",
    target: '[data-tour-id="nav-drafts"]',
    placement: "right",
    icon: Layers,
    title: "Edit, then publish",
    body: "Generated forms land in Drafts. Open the editor to refine fields and clear anything flagged for review, then publish to get a shareable link that collects responses.",
  },
  {
    id: "replay",
    target: '[data-tour-id="tour-button"]',
    placement: "bottom",
    icon: Compass,
    title: "Replay anytime",
    body: "Need a refresher? Use this button in the header to take the tour again whenever you like.",
  },
];

const PAD = 8; // breathing room around the spotlighted element
const GAP = 14; // distance between spotlight and tooltip
const MARGIN = 16; // min distance from the viewport edge

type Spotlight = { top: number; left: number; width: number; height: number };
type Layout = { spotlight: Spotlight | null; tip: { top: number; left: number } };

export function ProductTour({ autoStart = false }: { autoStart?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [layout, setLayout] = useState<Layout>({
    spotlight: null,
    tip: { top: 0, left: 0 },
  });

  const tipRef = useRef<HTMLDivElement>(null);
  const layoutKey = useRef("");

  useEffect(() => setMounted(true), []);

  const startTour = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const finishTour = useCallback(() => {
    setOpen(false);
    setStep(0);
    // Skipping counts as "seen" so it does not auto-trigger again; the header
    // button still replays it on demand. Fire-and-forget — a failed write just
    // means the tour may greet the user once more, which is harmless.
    void markTourCompleted().catch(() => {});
  }, []);

  // Auto-trigger once for users who have not completed the tour. The short
  // delay lets the layout settle so the first spotlight lands accurately.
  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(startTour, 650);
    return () => window.clearTimeout(t);
  }, [autoStart, startTour]);

  // Lock body scroll while the tour is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Bring the current target into view when the step changes.
  useEffect(() => {
    if (!open) return;
    const target = STEPS[step]?.target;
    if (!target) return;
    document
      .querySelector(target)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [open, step]);

  // Track the target element every frame so the spotlight follows layout
  // changes (sidebar open/close, scroll, resize) without stale positions.
  useEffect(() => {
    if (!open) return;
    let raf = 0;

    const compute = () => {
      const current = STEPS[step];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tw = tipRef.current?.offsetWidth ?? 360;
      const th = tipRef.current?.offsetHeight ?? 220;

      let spotlight: Spotlight | null = null;
      if (current?.target) {
        const el = document.querySelector(current.target);
        if (el) {
          const r = el.getBoundingClientRect();
          const visible =
            r.width > 0 &&
            r.height > 0 &&
            r.bottom > 0 &&
            r.right > 0 &&
            r.top < vh &&
            r.left < vw;
          if (visible) {
            spotlight = {
              top: r.top - PAD,
              left: r.left - PAD,
              width: r.width + PAD * 2,
              height: r.height + PAD * 2,
            };
          }
        }
      }

      let tip: { top: number; left: number };
      if (!spotlight) {
        tip = { top: (vh - th) / 2, left: (vw - tw) / 2 };
      } else {
        const placement = current?.placement ?? "bottom";
        if (placement === "right") {
          tip = { top: spotlight.top, left: spotlight.left + spotlight.width + GAP };
        } else if (placement === "left") {
          tip = { top: spotlight.top, left: spotlight.left - tw - GAP };
        } else if (placement === "top") {
          tip = { top: spotlight.top - th - GAP, left: spotlight.left };
        } else {
          tip = {
            top: spotlight.top + spotlight.height + GAP,
            left: spotlight.left,
          };
        }
        tip.left = clamp(tip.left, MARGIN, vw - tw - MARGIN);
        tip.top = clamp(tip.top, MARGIN, vh - th - MARGIN);
      }

      const next: Layout = { spotlight, tip };
      const key = JSON.stringify(next);
      if (key !== layoutKey.current) {
        layoutKey.current = key;
        setLayout(next);
      }
      raf = window.requestAnimationFrame(compute);
    };

    raf = window.requestAnimationFrame(compute);
    return () => window.cancelAnimationFrame(raf);
  }, [open, step]);

  // Keyboard controls.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishTour();
      else if (e.key === "ArrowRight")
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finishTour]);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const StepIcon = current?.icon ?? Compass;

  return (
    <>
      <Button
        data-tour-id="tour-button"
        variant="ghost"
        size="sm"
        onClick={startTour}
        aria-label="Take a tour of the app"
        className="gap-1.5"
      >
        <Compass className="size-4" />
        <span className="hidden sm:inline">Tour</span>
      </Button>

      {mounted && open && current
        ? createPortal(
            <div
              className="fixed inset-0 z-[200]"
              role="dialog"
              aria-modal="true"
              aria-label="Product tour"
            >
              {/* Dim layer + spotlight. The huge box-shadow darkens everything
                  outside the cut-out; when there is no target we dim fully. */}
              {layout.spotlight ? (
                <div
                  className="pointer-events-none fixed rounded-xl ring-2 ring-brand/90 transition-all duration-300 ease-out"
                  style={{
                    top: layout.spotlight.top,
                    left: layout.spotlight.left,
                    width: layout.spotlight.width,
                    height: layout.spotlight.height,
                    boxShadow: "0 0 0 9999px rgba(2,6,23,0.72)",
                  }}
                />
              ) : (
                <div className="fixed inset-0 bg-[rgba(2,6,23,0.72)]" />
              )}

              {/* Tooltip card. */}
              <div
                key={step}
                ref={tipRef}
                className="fixed z-[201] w-[min(92vw,360px)] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
                style={{ top: layout.tip.top, left: layout.tip.left }}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                    <StepIcon className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Step {step + 1} of {STEPS.length}
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold leading-snug">
                      {current.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={finishTour}
                    aria-label="Close tour"
                    className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <p className="px-4 text-[13px] leading-relaxed text-muted-foreground">
                  {current.body}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-border px-4 py-3">
                  <div className="flex flex-1 items-center gap-1.5">
                    {STEPS.map((s, i) => (
                      <span
                        key={s.id}
                        aria-hidden
                        className={`h-1.5 rounded-full transition-all ${
                          i === step
                            ? "w-5 bg-brand"
                            : "w-1.5 bg-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>

                  {!isFirst && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep((s) => Math.max(s - 1, 0))}
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                  )}
                  {isLast ? (
                    <Button size="sm" onClick={finishTour}>
                      Done
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        setStep((s) => Math.min(s + 1, STEPS.length - 1))
                      }
                    >
                      Next
                      <ArrowRight className="size-4" />
                    </Button>
                  )}
                </div>

                {!isLast && (
                  <button
                    type="button"
                    onClick={finishTour}
                    className="w-full rounded-b-xl border-t border-border py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Skip tour
                  </button>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
