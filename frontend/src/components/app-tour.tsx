"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

import { markTourCompleted } from "@/app/(app)/tour-actions";

const TOUR_HOME_PATH = "/home";

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to Sketch-to-Form",
      description:
        "A quick 60-second tour so you know what this workspace can do. You can replay it anytime from the help button in the header.",
    },
  },
  {
    element: '[data-tour-id="sidebar-nav"]',
    popover: {
      title: "Your workspace, one rail",
      description:
        "Everything lives in this sidebar — Home, your forms, responses, and the trash. The active page is always highlighted in cobalt.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour-id="home-cta-sketch"]',
    popover: {
      title: "Snap a sketch → live form",
      description:
        "The headline trick: upload a photo of a paper sketch and our vision pipeline reconstructs it as a typed, validated form in under a minute.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour-id="sidebar-create"]',
    popover: {
      title: "Or start from scratch",
      description:
        "Don't have a sketch? Click <strong>Create form</strong> and choose <em>Start blank</em> to build field-by-field in the editor.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour-id="sidebar-drafts"]',
    popover: {
      title: "Drafts — your in-progress forms",
      description:
        "Every new form lands here as a draft. Iterate freely; nothing is public until you hit publish.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour-id="sidebar-published"]',
    popover: {
      title: "Publish & share",
      description:
        "Publishing mints an unguessable URL like <code>/f/abc123</code>. Share it anywhere — respondents fill it without signing in.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour-id="sidebar-responses"]',
    popover: {
      title: "Responses, organized per form",
      description:
        "Every submission flows here, keyed by stable field IDs so renaming a label never breaks past responses.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour-id="header-tour-button"]',
    popover: {
      title: "Replay this tour anytime",
      description:
        "Click this sparkle in the header whenever you want a refresher. That's it — let's build something.",
      side: "bottom",
      align: "end",
    },
  },
];

export function AppTour({ autoStart }: { autoStart: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const driverRef = useRef<Driver | null>(null);
  const runningRef = useRef(false);

  const buildDriver = useCallback(() => {
    return driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      disableActiveInteraction: true,
      stagePadding: 6,
      stageRadius: 10,
      overlayOpacity: 0.55,
      popoverClass: "rsi-tour",
      progressText: "{{current}} / {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Got it",
      steps: STEPS,
      onDestroyed: () => {
        runningRef.current = false;
        driverRef.current = null;
        void markTourCompleted();
      },
    });
  }, []);

  const startTour = useCallback(() => {
    if (runningRef.current) return;
    if (pathname !== TOUR_HOME_PATH) {
      router.push(`${TOUR_HOME_PATH}?tour=1`);
      return;
    }
    runningRef.current = true;
    // Wait one frame so data-tour-id anchors are mounted, then kick off.
    requestAnimationFrame(() => {
      driverRef.current = buildDriver();
      driverRef.current.drive();
    });
  }, [pathname, router, buildDriver]);

  // 1) Auto-start for new users (tour_completed_at IS NULL)
  useEffect(() => {
    if (!autoStart) return;
    if (pathname !== TOUR_HOME_PATH) return;
    // Tiny grace period so hero animations finish settling.
    const t = setTimeout(startTour, 350);
    return () => clearTimeout(t);
  }, [autoStart, pathname, startTour]);

  // 2) Manual trigger via ?tour=1 (set by the header button)
  useEffect(() => {
    if (searchParams.get("tour") !== "1") return;
    if (pathname !== TOUR_HOME_PATH) return;
    startTour();
    router.replace(TOUR_HOME_PATH, { scroll: false });
  }, [searchParams, pathname, startTour, router]);

  // Cleanup if the layout unmounts mid-tour (route change, logout, etc.)
  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
      runningRef.current = false;
    };
  }, []);

  return null;
}
