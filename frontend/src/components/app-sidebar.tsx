"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FilePlus2,
  Inbox,
  Layers,
  LogOut,
  Radio,
  Trash2,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const items = [
  { title: "Home", href: "/home", icon: Home, idx: "01" },
  { title: "Drafts", href: "/forms/drafts", icon: Layers, idx: "02" },
  { title: "Trash", href: "/forms/trash", icon: Trash2, idx: "03" },
  { title: "Published", href: "/forms/published", icon: Radio, idx: "04" },
  { title: "Create form", href: "/forms/create", icon: FilePlus2, idx: "05" },
  { title: "Responses", href: "/forms/responses", icon: Inbox, idx: "06" },
];

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <BrandMark size="sm" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className="group/item relative h-9 data-[active=true]:bg-brand data-[active=true]:text-brand-foreground data-[active=true]:hover:bg-brand-ink"
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="size-4" />
                      <span className="text-[13px] font-medium">{item.title}</span>
                      <span
                        className={`ml-auto font-mono-tech text-[10px] tracking-[0.15em] ${
                          active
                            ? "text-brand-foreground/70"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {item.idx}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 overflow-hidden relative">
          <div
            aria-hidden
            className="absolute -top-3 -right-6 h-20 w-24 rsi-stripes opacity-20"
          />
          <p className="relative font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground">
            Pipeline
          </p>
          <p className="relative mt-1 font-display italic text-base leading-tight">
            Ready when you are.
          </p>
          <p className="relative mt-1 text-[11px] text-muted-foreground">
            Sketch → live in seconds.
          </p>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="h-7 w-7 rounded-md bg-brand text-brand-foreground">
                  <AvatarFallback className="rounded-md bg-brand text-brand-foreground text-[11px] font-semibold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col leading-tight overflow-hidden">
                  <span className="truncate text-[13px] font-medium">
                    {email}
                  </span>
                  <span className="font-mono-tech uppercase tracking-[0.18em] text-[11px] text-muted-foreground">
                    Signed in
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col">
                      <span className="font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground">
                        Signed in as
                      </span>
                      <span className="text-sm font-medium truncate">{email}</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <form action={signOut}>
                  <DropdownMenuItem
                    nativeButton
                    render={<button type="submit" />}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
