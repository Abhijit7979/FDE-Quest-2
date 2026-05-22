import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProductTour } from "@/components/product-tour";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  // The product tour auto-triggers for any user whose `tour_completed_at` is
  // still NULL (genuinely new sign-ups — existing accounts were backfilled in
  // migration 20260522130000). Finishing or skipping stamps the column.
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tour_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  const tourPending = !profile?.tour_completed_at;

  return (
    <SidebarProvider>
      <AppSidebar email={user.email ?? ""} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-1 h-4 shrink-0" />
          <AppBreadcrumb />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ProductTour autoStart={tourPending} />
            <ThemeToggle />
          </div>
        </header>
        <main id="main-content" className="relative flex-1 p-6 md:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
