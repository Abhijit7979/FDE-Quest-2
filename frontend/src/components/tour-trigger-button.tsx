"use client";

import { Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function TourTriggerButton() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Take product tour"
      title="Take a tour"
      data-tour-id="header-tour-button"
      onClick={() => {
        const target = "/home?tour=1";
        if (pathname === "/home") {
          // Force the searchParam effect to re-fire when already on /home.
          router.replace(target, { scroll: false });
        } else {
          router.push(target);
        }
      }}
    >
      <Sparkles className="size-4" />
    </Button>
  );
}
