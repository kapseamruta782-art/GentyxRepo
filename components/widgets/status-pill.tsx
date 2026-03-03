"use client"

import { cn } from "@/lib/utils"

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    "In Review": "bg-[#0B1F3B]/10 text-[#0B1F3B] dark:bg-[#0B1F3B]/20 dark:text-slate-200",
    Approved: "bg-[#8DC63F]/20 text-[#0B1F3B] dark:bg-[#8DC63F]/30 dark:text-slate-200",
    Rejected: "bg-destructive/10 text-destructive dark:bg-destructive/20",
    "Not Started": "bg-muted text-muted-foreground",
    "In Progress": "bg-[#0B1F3B]/10 text-[#0B1F3B] dark:bg-[#0B1F3B]/20 dark:text-slate-200",
    Completed: "bg-[#8DC63F]/20 text-[#0B1F3B] dark:bg-[#8DC63F]/30 dark:text-slate-200",
    "Needs Fix": "bg-destructive/10 text-destructive dark:bg-destructive/20",
    Uploaded: "bg-muted text-muted-foreground",
    Reviewed: "bg-[#0B1F3B]/10 text-[#0B1F3B] dark:bg-[#0B1F3B]/20 dark:text-slate-200",
  }
  return <span className={cn("rounded-full px-2 py-0.5 text-xs", map[status] || "bg-muted")}>{status}</span>
}
