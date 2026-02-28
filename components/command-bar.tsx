"use client"

import * as React from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useRouter } from "next/navigation"
import { mockClients, mockTasks, mockDocuments, mockEmailTemplates } from "@/lib/mock"

export function CommandBar() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = typeof e.key === "string" ? e.key.toLowerCase() : ""
      if (!key) return

      if ((e.ctrlKey || e.metaKey) && key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }

      if (key === "escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey, { passive: false })
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search clients, tasks, documents, templates..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Clients">
          {mockClients.slice(0, 8).map((c) => (
            <CommandItem key={c.id} onSelect={() => router.push(`/admin/clients/${c.id}`)}>
              {c.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Tasks">
          {mockTasks.slice(0, 8).map((t) => (
            <CommandItem key={t.id} onSelect={() => router.push(`/inbox`)}>
              {t.title} — {t.clientId}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Documents">
          {mockDocuments.slice(0, 8).map((d) => (
            <CommandItem key={d.id} onSelect={() => router.push(`/documents`)}>
              {d.name} — {d.clientId}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Templates">
          {mockEmailTemplates.map((t) => (
            <CommandItem key={t.id} onSelect={() => router.push(`/admin/email-templates`)}>
              {t.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
