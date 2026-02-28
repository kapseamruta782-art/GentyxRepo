"use client"

import { cn } from "@/lib/utils"

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200",
    "In Review": "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200",
    Approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200",
    Rejected: "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-200",
    "Not Started": "bg-muted text-foreground",
    "In Progress": "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200",
    Completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200",
    "Needs Fix": "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-200",
    Uploaded: "bg-muted text-foreground",
    Reviewed: "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200",
  }
  return <span className={cn("rounded-full px-2 py-0.5 text-xs", map[status] || "bg-muted")}>{status}</span>
}
