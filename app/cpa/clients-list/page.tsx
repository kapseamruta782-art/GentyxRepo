"use client"

import useSWR from "swr"
import { DataTable, type Column, TableToolbar, useServerTableState } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/store/ui-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ArrowRight } from "lucide-react"

export default function CPAClientsPage() {
  const { q, setQ } = useServerTableState()
  const router = useRouter()
  const currentCpaId = useUIStore((s) => s.currentCpaId)

  // Fetch only clients assigned to this CPA
  const { data, isLoading } = useSWR(
    currentCpaId ? ["cpa-clients-list", currentCpaId] : null,
    async () => {
      const res = await fetch(`/api/clients/get-by-cpa?cpaId=${currentCpaId}`)
      const json = await res.json()
      return json.data || []
    }
  )

  const clients = data || []

  // Only search filter
  const filteredClients = clients.filter((client: any) => {
    const matchesSearch = !q ||
      client.client_name?.toLowerCase().includes(q.toLowerCase()) ||
      client.code?.toLowerCase().includes(q.toLowerCase())
    return matchesSearch
  })

  const cols: Column<any>[] = [
    {
      key: "client_name",
      header: "Client Name",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-semibold text-amber-700">
            {r.client_name?.substring(0, 2).toUpperCase()}
          </div>
          <span className="font-medium">{r.client_name}</span>
        </div>
      )
    },
    { key: "code", header: "Code" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status || r.client_status || "Active"} /> },
  ]

  if (!currentCpaId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assigned Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your {clients.length} assigned client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">All Clients ({filteredClients.length})</CardTitle>
            </div>
          </div>
          <TableToolbar q={q} setQ={setQ} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Loading clients...</span>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>{q ? "No clients match your search" : "No clients assigned to you"}</p>
            </div>
          ) : (
            <DataTable
              columns={cols}
              rows={filteredClients}
              onRowAction={(r: any) => (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => router.push(`/cpa/clients/${r.client_id}`)}
                >
                  Open <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
