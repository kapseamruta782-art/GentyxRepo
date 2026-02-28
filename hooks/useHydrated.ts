"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/store/ui-store";

export function useHydrated() {
  const hydrated = useUIStore((s) => s._hasHydrated);
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    if (hydrated) setReady(true);
  }, [hydrated]);

  return isReady;
}
