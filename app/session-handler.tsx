// app/session-handler.tsx
"use client";

import { useEffect } from "react";

export default function SessionHandler() {
  useEffect(() => {
    const INACTIVITY_LIMIT = 2 * 60 * 60 * 1000; // 2 hours

    function updateActivity() {
      localStorage.setItem("lastActivity", Date.now().toString());
    }

    // On user actions → update timestamp
    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("click", updateActivity);
    window.addEventListener("scroll", updateActivity);

    // Check inactivity every minute
    const interval = setInterval(() => {
      const last = parseInt(localStorage.getItem("lastActivity") || "0", 10);
      const now = Date.now();

      if (last && now - last > INACTIVITY_LIMIT) {
        // Auto logout
        document.cookie =
          "clienthub_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie =
          "clienthub_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

        window.location.href = "/login";
      }
    }, 60_000); // check every 1 minute

    return () => clearInterval(interval);
  }, []);

  return null;
}
