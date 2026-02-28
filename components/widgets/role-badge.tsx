"use client";

import { useUIStore } from "@/store/ui-store";

export function RoleBadge() {
  const role = useUIStore((s) => s.role);
  const hasHydrated = useUIStore((s) => s._hasHydrated);

  if (!hasHydrated) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
      {/* <span className="text-xs text-muted-foreground">Role:</span> */}
      <span className="text-xs font-medium">{role === "CPA" ? "PREPARER" : role}</span>
    </div>
  );
}
