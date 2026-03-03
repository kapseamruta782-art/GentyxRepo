// components/shell/app-shell.tsx
"use client";

import type React from "react";
import { useEffect } from "react";
import Link from "next/link";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { RightDrawer } from "./right-drawer";
import { RoleBadge } from "@/components/widgets/role-badge";
import { useUIStore } from "@/store/ui-store";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Logo } from "@/components/ui/logo";

/* -------------------------------------------------------
   Helper: read cookie on client
------------------------------------------------------- */
function getCookie(name: string) {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp("(^| )" + name + "=([^;]+)")
  );

  return match ? decodeURIComponent(match[2]) : null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  // ✅ ALL HOOKS MUST BE INSIDE COMPONENT
  const hasHydrated = useUIStore((s) => s._hasHydrated);
  const role = useUIStore((s) => s.role);
  const setRole = useUIStore((s) => s.setRole);
  const setCurrentClientId = useUIStore((s) => s.setCurrentClientId);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  /* -------------------------------------------------------
     Hydrate Zustand from cookies (runs once on mount)
  ------------------------------------------------------- */
  useEffect(() => {
    if (!hasHydrated) return;

    const cookieRole = getCookie("clienthub_role");
    const clientId = getCookie("clienthub_clientId");

    if (cookieRole) {
      setRole(cookieRole as any);
    }

    if (clientId) {
      setCurrentClientId(clientId);
    }
  }, [hasHydrated, setRole, setCurrentClientId]);

  /* -------------------------------------------------------
     Get dashboard URL based on user role
  ------------------------------------------------------- */
  const getDashboardUrl = () => {
    switch (role) {
      case "ADMIN":
        return "/admin";
      case "CLIENT":
        return "/client";
      case "SERVICE_CENTER":
        return "/service-center";
      case "CPA":
        return "/cpa";
      default:
        return "/";
    }
  };

  /* -------------------------------------------------------
     Prevent render until Zustand rehydrates
  ------------------------------------------------------- */
  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* ---------- FIXED SIDEBAR WITH CLIENTHUB LOGO ---------- */}
      <aside
        className={cn(
          "hidden md:flex fixed left-0 top-0 bottom-0 border-r bg-sidebar z-30 flex-col overflow-hidden transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* LOGO SECTION - Clickable to navigate to dashboard */}
        <Link
          href={getDashboardUrl()}
          className="h-20 flex items-center px-6 bg-white border-b border-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
          title="Go to Dashboard"
        >
          {sidebarCollapsed ? (
            <span style={{ color: "#8CC63F" }} className="text-2xl font-bold ml-1">&gt;</span>
          ) : (
            <Logo />
          )}
        </Link>

        {/* SIDEBAR MENU */}
        <div className="flex-1 overflow-hidden">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>

        {/* TOGGLE BUTTON */}
        <div className="p-2 border-t bg-sidebar">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* ---------- MAIN CONTENT ---------- */}
      <div
        className={cn(
          "flex flex-col flex-1 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64"
        )}
      >
        {/* TOP NAV */}
        <div
          className={cn(
            "fixed top-0 right-0 z-40 transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "left-0 md:left-16" : "left-0 md:left-64"
          )}
        >
          <TopNav />
        </div>

        {/* SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto mt-14 p-4 bg-muted/40">
          <div className="min-h-[calc(100vh-56px)]">
            {children}

            {/* FOOTER */}
            <footer className="mt-10 border-t pt-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>
                  © 2014–{new Date().getFullYear()} HubOne Systems Inc.  All Rights Reserved
                </span>
                <RoleBadge />
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* RIGHT DRAWER */}
      <RightDrawer />
    </div>
  );
}
