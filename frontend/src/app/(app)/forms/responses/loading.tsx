import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

export default function ResponsesLoading() {
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
              <Skeleton className="h-4 w-80" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="size-4" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="size-3.5" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="size-3.5" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
