// shell/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Users,
  FileText,
  ListChecks,
  Library,
  Building2,
  Landmark,
  BarChart2,
  Mail,
  Settings,
  Handshake,
  LogOut,
  BookOpen,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const rawRole = useUIStore((s) => s.role);
  const role = rawRole?.toUpperCase();
  const hasHydrated = useUIStore((s) => s._hasHydrated);
  const pathname = usePathname();
  const router = useRouter();

  // ⛔ Prevent sidebar flicker
  if (!hasHydrated || !role) return null;

  const adminLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutGrid },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/tasks", label: "Tasks", icon: ListChecks },
    { href: "/admin/stages", label: "Onboarding Stages", icon: Library },
    { href: "/admin/service-centers", label: "Service Centers", icon: Building2 },
    { href: "/admin/cpas", label: "Preparers", icon: Landmark },
    { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
    { href: "/admin/messages", label: "Portal Messages", icon: Mail },
    { href: "/admin/email-activity", label: "Portal Emails", icon: Activity },
    // { href: "/admin/documents", label: "Documents", icon: FileText },
    { href: "/admin/reports", label: "Reports", icon: BarChart2 },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help Center", icon: Handshake },
  ];

  const clientLinks = [
    { href: "/client", label: "Home", icon: LayoutGrid },
    { href: "/client/documents", label: "Documents", icon: FileText },
    { href: "/client/tasks", label: "My Tasks", icon: ListChecks },
    { href: "/client/messages", label: "Messages", icon: Mail },
    { href: "/client/reports", label: "Reports", icon: BarChart2 },
    { href: "/client/profile", label: "Profile", icon: Users },
    { href: "/client/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help Center", icon: Handshake },
  ];

  const scLinks = [
    { href: "/service-center", label: "Dashboard", icon: LayoutGrid },
    { href: "/service-center/clients-list", label: "Clients", icon: Users },
    { href: "/service-center/tasks", label: "Tasks", icon: ListChecks },
    { href: "/service-center/messages", label: "Messages", icon: Mail },
    { href: "/inbox", label: "Work Queue", icon: ListChecks },
    { href: "/service-center/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help Center", icon: Handshake },
  ];

  const cpaLinks = [
    { href: "/cpa", label: "Dashboard", icon: LayoutGrid },
    { href: "/cpa/clients-list", label: "Clients", icon: Users },
    { href: "/cpa/tasks", label: "Tasks", icon: ListChecks },
    { href: "/cpa/messages", label: "Messages", icon: Mail },
    { href: "/inbox", label: "Work Queue", icon: ListChecks },
    { href: "/cpa/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help Center", icon: Handshake },
  ];

  // Admin and other roles use common links, clients have settings built-in
  // Note: ADMIN now has Settings and FAQ in adminLinks, so skip commonLinks for ADMIN too
  const commonLinks = role === "ADMIN" || role === "CLIENT" || role === "SERVICE_CENTER" || role === "CPA" ? [] : [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help Center", icon: Handshake },
  ];

  const roleLinks =
    role === "ADMIN" ? adminLinks :
      role === "CLIENT" ? clientLinks :
        role === "SERVICE_CENTER" ? scLinks :
          cpaLinks;

  function handleLogout() {
    router.push("/login");
  }

  // Function to determine if a link is active
  function isLinkActive(href: string): boolean {
    // Exact match
    if (pathname === href) return true;

    // For dashboard links (exact role root), only match exactly
    const dashboardPaths = ["/admin", "/client", "/service-center", "/cpa"];
    if (dashboardPaths.includes(href)) {
      return pathname === href;
    }

    // For "Clients" link, also match /clients/{id} paths
    if (href === "/service-center/clients-list" && pathname.startsWith("/service-center/clients/")) {
      return true;
    }

    // For other links, check if path starts with href
    if (pathname.startsWith(href + "/")) {
      return true;
    }

    return false;
  }

  return (
    <div className="flex flex-col h-full w-full p-2">
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
        {[...roleLinks, ...commonLinks].map(({ href, label, icon: Icon }) => {
          const active = isLinkActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all duration-200 font-medium",
                collapsed && "justify-center px-2",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="pt-2 mt-auto shrink-0">
        <Button
          variant="ghost"
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center px-2" : "justify-start"
          )}
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className={cn("size-4", !collapsed && "mr-2")} />
          {!collapsed && "Logout"}
        </Button>
      </div>
    </div>
  );
}
