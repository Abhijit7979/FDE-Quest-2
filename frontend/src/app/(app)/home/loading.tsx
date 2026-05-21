import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

export default function HomeLoading() {
  return (
    <SidebarProvider>
      <div className="w-[var(--sidebar-width)] shrink-0" />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Skeleton className="h-4 w-32" />
        </header>
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-6xl space-y-12">
            {/* Hero skeleton */}
            <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid md:grid-cols-[1.4fr_1fr] gap-10 p-8 md:p-10">
                <div className="space-y-6">
                  <Skeleton className="h-3 w-36" />
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-12 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-80" />
                  <div className="flex gap-3">
                    <Skeleton className="h-11 w-40 rounded-lg" />
                    <Skeleton className="h-11 w-40 rounded-lg" />
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Stats skeleton */}
            <section>
              <div className="space-y-1.5 mb-6">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="size-4" />
                      </div>
                      <Skeleton className="h-12 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Recent forms skeleton */}
            <section>
              <div className="space-y-1.5 mb-6">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Card className="overflow-hidden p-0">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-7 w-48 flex-1" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="size-4" />
                  </div>
                ))}
              </Card>
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
