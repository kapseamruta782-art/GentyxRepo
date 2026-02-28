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
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="mx-auto flex h-14 items-center px-4">

        {/* ✅ LEFT SIDE — DATE & TIME */}
        <div className="flex-1">
          <DateTimeDisplay />
        </div>

        {/* ✅ RIGHT SIDE ICONS */}
        <div className="flex items-center gap-2">
          <Button
            className="rounded-full bg-[#470D1B] text-white hover:bg-[#C5A059] hover:text-white border border-[#5a1f2d] shadow-sm px-4"
            size="sm"
            onClick={() => window.open("https://www.prolegacy.com/", "_blank")}
            title="Prolegacy.com"
          >
            <Globe className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide">PROLEGACY.COM</span>
          </Button>

          <Button
            className="rounded-full bg-[#470D1B] text-white hover:bg-[#C5A059] hover:text-white border border-[#5a1f2d] shadow-sm ml-1 px-4"
            size="sm"
            onClick={() => router.push("/inbox")}
            title="Inbox"
          >
            <Inbox className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide">INBOX</span>
          </Button>

          <Button
            className="rounded-full bg-[#470D1B] text-white hover:bg-[#C5A059] hover:text-white border border-[#5a1f2d] shadow-sm ml-1 px-4"
            size="sm"
            onClick={() => router.push("/help")}
            title="Help"
          >
            <Handshake className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide">HELP</span>
          </Button>

          <Button
            className="rounded-full bg-[#470D1B] text-white hover:bg-[#C5A059] hover:text-white border border-[#5a1f2d] shadow-sm ml-1 px-4"
            size="sm"
            onClick={() => router.push(getSettingsPath())}
            title="Profile & Settings"
          >
            <Settings className="size-4 mr-2" />
            <span className="text-xs font-semibold tracking-wide">SETTINGS</span>
          </Button>

          <div className="ml-4 text-xs font-bold tracking-widest uppercase text-muted-foreground cursor-default select-none">
            {role}
          </div>
        </div>

      </div>
    </header>
  );
}
