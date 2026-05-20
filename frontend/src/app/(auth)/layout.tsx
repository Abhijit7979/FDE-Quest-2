import { BrandMark, Stripes } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh w-full grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand text-brand-foreground p-12 noise-overlay">
        <div
          aria-hidden
          className="absolute inset-0 blueprint-grid opacity-[0.18] [--brand:white]"
        />
        {/* big decorative stripes block, top-right */}
        <div
          aria-hidden
          className="absolute -top-10 -right-16 h-[420px] w-[420px] rotate-[8deg] rsi-stripes-thick opacity-30 [--stripe:white]"
        />
        {/* small stripes block, bottom-left */}
        <div
          aria-hidden
          className="absolute bottom-24 -left-10 h-44 w-72 -rotate-[6deg] rsi-stripes opacity-25 [--stripe:white]"
        />

        <div className="relative z-10 flex items-center gap-3">
          <Stripes className="h-10 w-10 text-white" />
          <div className="flex flex-col leading-none">
            <span className="font-display italic text-2xl tracking-tight">
              sketch·to·form
            </span>
            <span className="mt-1.5 font-mono-tech uppercase tracking-[0.22em] text-[10px] text-white/70">
              RSI · Engineering build
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <p className="font-mono-tech uppercase tracking-[0.25em] text-[11px] text-white/70">
            01 — paper · 02 — vision · 03 — schema · 04 — live
          </p>
          <h2 className="font-display text-[44px] leading-[1.02] tracking-tight text-balance">
            Sketch a form on paper.
            <br />
            <em className="text-white/90">Ship it</em> by the time the kettle boils.
          </h2>
          <p className="text-sm text-white/75 leading-relaxed max-w-sm">
            Photograph a hand-drawn form, and our vision pipeline rebuilds it as
            a typed, validated, shareable artifact — no markup, no clicks.
          </p>
        </div>

        <div className="relative z-10 flex items-end justify-between gap-6 text-xs text-white/60 font-mono-tech uppercase tracking-[0.18em]">
          <span>© RSI · 2026</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
            Pipeline · operational
          </span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 blueprint-grid-fine opacity-50"
        />
        <div className="relative w-full max-w-sm anim-rise">
          {/* mobile-only brand */}
          <div className="lg:hidden mb-10 flex justify-center">
            <BrandMark />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
