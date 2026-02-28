"use client"

import { useUIStore } from "@/store/ui-store"
import { Button } from "@/components/ui/button"
import { Wrench, Bug, Inbox } from "lucide-react"

export function DevToolbar() {
  const dev = useUIStore((s) => s.dev)
  const openDrawer = useUIStore((s) => s.openDrawer)

  if (!dev.showDevToolbar) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <div className="rounded-md border bg-background p-2 shadow">
        <div className="flex items-center gap-2">
          <Button
            variant={dev.simulateError ? "destructive" : "outline"}
            size="sm"
            onClick={() => dev.toggleSimulateError()}
          >
            <Bug className="mr-1 size-4" /> Error
          </Button>
          <Button
            variant={dev.simulateEmpty ? "secondary" : "outline"}
            size="sm"
            onClick={() => dev.toggleSimulateEmpty()}
          >
            Empty
          </Button>
          <Button variant="outline" size="sm" onClick={() => openDrawer("assignTask", {})}>
            <Inbox className="mr-1 size-4" /> Quick Action
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full border bg-background"
        onClick={() => dev.toggleDevToolbar()}
      >
        <Wrench className="size-5" />
      </Button>
    </div>
  )
}
