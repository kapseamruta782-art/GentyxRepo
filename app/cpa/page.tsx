"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/store/ui-store"
import {
  Settings,
  Users,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Building2,
  RefreshCw,
  Landmark
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function CPADashboard() {
  const router = useRouter()
  const currentCpaId = useUIStore((s) => s.currentCpaId)

  // Fetch CPA Details
  const { data: cpaDetails } = useSWR(
    currentCpaId ? ["cpa-details", currentCpaId] : null,
    async () => {
      const res = await fetch(`/api/cpas/${currentCpaId}/get`)
      const json = await res.json()
      return json.data
    }
  )

  // Fetch only clients assigned to this CPA
  const { data: clientsData, mutate: refreshClients } = useSWR(
    currentCpaId ? ["cpa-clients", currentCpaId] : null,
    async () => {
      const res = await fetch(`/api/clients/get-by-cpa?cpaId=${currentCpaId}`)
      const json = await res.json()
      return { data: json.data || [], total: json.data?.length || 0 }
    },
    { refreshInterval: 60000 }
  )

  // Get client IDs for fetching tasks
  const clientIds = (clientsData?.data || []).map((c: any) => c.client_id)

  // Fetch tasks assigned to CPA role
  const { data: tasksData, mutate: refreshTasks } = useSWR(
    currentCpaId ? ["cpa-all-tasks", currentCpaId] : null,
    async () => {
      const res = await fetch(`/api/tasks/get?assignedRole=CPA`)
      const json = await res.json()
      const allTasks = json.data || []
      // Filter tasks to only show tasks for assigned clients
      const filteredTasks = allTasks.filter((t: any) =>
        clientIds.includes(t.clientId) || clientIds.includes(Number(t.client_id))
      )
      return { data: filteredTasks }
    },
    { refreshInterval: 30000 }
  )

  // Fetch recent messages for assigned clients
  const { data: messagesData } = useSWR(
    currentCpaId && clientIds.length > 0 ? ["cpa-messages", clientIds.slice(0, 5).join(",")] : null,
    async () => {
      const allMessages: any[] = []
      for (const clientId of clientIds.slice(0, 5)) {
        const res = await fetch(`/api/messages/get?clientId=${clientId}&conversationBetween=CPA,CLIENT`)
        const json = await res.json()
        allMessages.push(...(json.data || []))
      }
      allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return { data: allMessages.slice(0, 5) }
    }
  )

  const clients = clientsData?.data || []
  const tasks = tasksData?.data || []
  const recentMessages = messagesData?.data || []

  const pendingTasks = tasks.filter((t: any) => t.status === "Not Started" || t.status === "Pending")
  const inProgressTasks = tasks.filter((t: any) => t.status === "In Progress")
  const completedTasks = tasks.filter((t: any) => t.status === "Completed")

  // Loading state
  if (!currentCpaId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading...</span>
      </div>
    )
  }

  const handleRefresh = () => {
    refreshClients()
    refreshTasks()
  }

  return (
    <div className="space-y-6">
      {/* Header with Settings */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{cpaDetails?.cpa_name ? `, ${cpaDetails.cpa_name}` : ""}!
          </h1>
          <p className="text-muted-foreground">Here's an overview of your work.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/cpa/settings")}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards - Matching Service Center Style */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200"
          onClick={() => router.push("/cpa/clients-list")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <ArrowRight className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-700">{clients.length}</div>
            <p className="text-sm text-blue-600 mt-1">Assigned Clients</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200"
          onClick={() => router.push("/cpa/tasks")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <ArrowRight className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-700">{pendingTasks.length}</div>
            <p className="text-sm text-amber-600 mt-1">Pending Tasks</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200"
          onClick={() => router.push("/cpa/tasks")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <ArrowRight className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-purple-700">{inProgressTasks.length}</div>
            <p className="text-sm text-purple-600 mt-1">In Progress</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200"
          onClick={() => router.push("/cpa/tasks")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <ArrowRight className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-700">{completedTasks.length}</div>
            <p className="text-sm text-emerald-600 mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Recent Tasks</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/cpa/tasks")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No tasks assigned yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/cpa/clients/${task.clientId || task.client_id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        task.status === "Completed" ? "bg-emerald-100 text-emerald-600" :
                          task.status === "In Progress" ? "bg-violet-100 text-violet-600" :
                            "bg-amber-100 text-amber-600"
                      )}>
                        {task.status === "Completed" ? <CheckCircle2 className="h-4 w-4" /> :
                          task.status === "In Progress" ? <TrendingUp className="h-4 w-4" /> :
                            <Clock className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.clientName || task.client_name}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={task.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Recent Messages</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/cpa/messages")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No messages yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMessages.map((msg: any) => (
                  <div
                    key={msg.message_id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/cpa/clients/${msg.client_id}?tab=messages`)}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
                      msg.sender_role === "CLIENT" ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                    )}>
                      {msg.sender_role === "CLIENT" ? "CL" : "PR"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {msg.client_name || `Client #${msg.client_id}`}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(msg.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric"
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{msg.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Assigned Clients</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/cpa/clients-list")}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No clients assigned yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Client</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Code</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.slice(0, 5).map((client: any) => (
                    <tr key={client.client_id} className="group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-semibold text-amber-700">
                            {client.client_name?.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium">{client.client_name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">{client.code || "—"}</td>
                      <td className="py-4">
                        <StatusPill status={client.status || client.client_status || "Active"} />
                      </td>
                      <td className="py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => router.push(`/cpa/clients/${client.client_id}`)}
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
