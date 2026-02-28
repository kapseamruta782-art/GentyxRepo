"use client"

import useSWR from "swr"
import { fetchDocuments } from "@/lib/api"
import { DataTable, type Column } from "@/components/data-table"
import { StatusPill } from "@/components/widgets/status-pill"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/store/ui-store"

export default function DocumentsPage() {
  const { data } = useSWR(["docs"], () => fetchDocuments())
  const openDrawer = useUIStore((s) => s.openDrawer)

  const cols: Column<any>[] = [
    { key: "clientId", header: "Client" },
    { key: "name", header: "Name" },
    { key: "type", header: "Type" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status || "Uploaded"} /> },
  ]

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Button variant="secondary" onClick={() => openDrawer("uploadDoc", {})}>
          Upload
        </Button>
      </div>
      <DataTable
        columns={cols}
        rows={data || []}
        onRowAction={(r: any) => (
          <Button size="sm" variant="outline">
            Notes
          </Button>
        )}
      />
    </div>
  )
}
