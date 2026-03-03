// components/shell/top-nav.tsx
"use client";

import { useContext } from "react";
import { Button } from "@/components/ui/button";
import { Inbox, Handshake, LogOut, Settings, Globe } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { DateTimeDisplay } from "@/components/widgets/date-time-display";
import { useRouter } from "next/navigation";

export function TopNav() {
  // const { theme, setTheme } = useContext(ThemeContext);
  const role = useUIStore((s) => s.role);
  const hasHydrated = useUIStore((s) => s._hasHydrated);
  const router = useRouter();

  // ⛔ Hide until hydration to avoid "Role: null"
  if (!hasHydrated) return null;

  function handleLogout() {
    router.push("/login");
  }

  // Get settings path based on role
  function getSettingsPath() {
    switch (role) {
      case "CLIENT":
        return "/client/settings";
      case "SERVICE_CENTER":
        return "/service-center/settings";
      case "CPA":
        return "/cpa/settings";
      case "ADMIN":
        return "/admin/settings";
      default:
        return "/settings";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
      <div className="mx-auto flex h-16 items-center px-6">

        {/* ✅ LEFT SIDE — DATE & TIME */}
        <div className="flex-1">
          <DateTimeDisplay />
        </div>

        {/* ✅ RIGHT SIDE ICONS */}
        <div className="flex items-center gap-3">
          <Button
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 border-none shadow-sm px-5"
            size="sm"
            onClick={() => window.open("https://gentyx.com/", "_blank")}
            title="Gentyx.com"
          >
            <Globe className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide">Schedule a Call</span>
          </Button>

          <Button
            variant="ghost"
            className="rounded-full text-primary hover:text-accent hover:bg-transparent transition-all duration-200 px-4"
            size="sm"
            onClick={() => router.push("/inbox")}
            title="Inbox"
          >
            <Inbox className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide uppercase">INBOX</span>
          </Button>

          <Button
            variant="ghost"
            className="rounded-full text-primary hover:text-accent hover:bg-transparent transition-all duration-200 px-4"
            size="sm"
            onClick={() => router.push("/help")}
            title="Help"
          >
            <Handshake className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide uppercase">HELP</span>
          </Button>

          <Button
            variant="ghost"
            className="rounded-full text-primary hover:text-accent hover:bg-transparent transition-all duration-200 px-4"
            size="sm"
            onClick={() => router.push(getSettingsPath())}
            title="Profile & Settings"
          >
            <Settings className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide uppercase">SETTINGS</span>
          </Button>

          <div className="ml-4 h-8 w-px bg-border" />

          <div className="ml-4 text-xs font-bold tracking-widest uppercase text-muted-foreground cursor-default select-none bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
            {role}
          </div>
        </div>

      </div>
    </header>
  );
}
