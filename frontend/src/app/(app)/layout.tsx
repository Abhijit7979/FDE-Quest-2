import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
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

  return (
    <SidebarProvider>
      <AppSidebar email={user.email ?? ""} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-1 h-4 shrink-0" />
          <AppBreadcrumb />
          <div className="ml-auto flex shrink-0 items-center gap-1">
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
