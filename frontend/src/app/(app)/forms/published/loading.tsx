import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

export default function PublishedLoading() {
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
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-36 rounded-lg" />
              ))}
            </div>
            <Card className="overflow-hidden p-0">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                  <Skeleton className="h-12 w-16 rounded-md shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="size-4" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              ))}
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
