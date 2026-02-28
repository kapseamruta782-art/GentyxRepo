"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { fetchAllTasks, fetchMessages } from "@/lib/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusPill } from "@/components/widgets/status-pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { useUIStore } from "@/store/ui-store"
import {
  Search,
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  Building2,
  Calendar,
  User,
  Clock,
  ArrowRight,
  RefreshCw
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

interface Task {
  id: number;
  stageId: number;
  clientId: number;
  client_id?: number;
  clientName: string;
  client_name?: string;
  title: string;
  assigneeRole: string;
  status: string;
  dueDate: string | null;
  created_at: string;
}

interface Message {
  message_id: number;
  client_id: number;
  client_name: string;
  sender_role: string;
  receiver_role: string;
  body: string;
  parent_message_id: number | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function formatDateTime(dateString: string): { date: string; time: string; relative: string } {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = "";
  if (diffMins < 1) relative = "Just now";
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else relative = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: diffDays > 365 ? "numeric" : undefined
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }),
    relative
  };
}

function formatDueDate(dateString: string | null): string {
  if (!dateString) return "No due date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// Main Inbox Page Component
// ─────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const role = useUIStore((s) => s.role)
  const currentClientId = useUIStore((s) => s.currentClientId)
  const currentServiceCenterId = useUIStore((s) => s.currentServiceCenterId)
  const currentCpaId = useUIStore((s) => s.currentCpaId)

  // Determine if we should fetch based on role
  const shouldFetch = role === "ADMIN" ||
    (role === "CLIENT" && currentClientId) ||
    (role === "SERVICE_CENTER" && currentServiceCenterId) ||
    (role === "CPA" && currentCpaId);

  // Fetch assigned client IDs for SERVICE_CENTER
  const { data: scClientsData } = useSWR(
    role === "SERVICE_CENTER" && currentServiceCenterId
      ? ["sc-clients-inbox", currentServiceCenterId]
      : null,
    async () => {
      const res = await fetch(`/api/clients/get-by-service-center?serviceCenterId=${currentServiceCenterId}`)
      const json = await res.json()
      return json.data || []
    }
  )

  const scClientIds = (scClientsData || []).map((c: any) => c.client_id)

  // Fetch assigned client IDs for CPA
  const { data: cpaClientsData } = useSWR(
    role === "CPA" && currentCpaId
      ? ["cpa-clients-inbox", currentCpaId]
      : null,
    async () => {
      const res = await fetch(`/api/clients/get-by-cpa?cpaId=${currentCpaId}`)
      const json = await res.json()
      return json.data || []
    }
  )

  const cpaClientIds = (cpaClientsData || []).map((c: any) => c.client_id)

  // Fetch tasks
  const { data: tasksResponse, isLoading: tasksLoading, mutate: refreshTasks } = useSWR(
    shouldFetch ? ["inbox-tasks", role, currentClientId, currentServiceCenterId, currentCpaId] : null,
    async () => {
      if (role === "SERVICE_CENTER") {
        // Fetch tasks assigned to SERVICE_CENTER role
        const res = await fetch(`/api/tasks/get?assignedRole=SERVICE_CENTER`)
        const json = await res.json()
        // Filter to only tasks for clients assigned to this SC
        const allTasks = json.data || []
        return {
          data: allTasks.filter((t: any) =>
            scClientIds.includes(t.clientId) || scClientIds.includes(t.client_id)
          )
        }
      }
      if (role === "CPA") {
        // Fetch tasks assigned to CPA role
        const res = await fetch(`/api/tasks/get?assignedRole=CPA`)
        const json = await res.json()
        // Filter to only tasks for clients assigned to this CPA
        const allTasks = json.data || []
        return {
          data: allTasks.filter((t: any) =>
            cpaClientIds.includes(t.clientId) || cpaClientIds.includes(t.client_id)
          )
        }
      }
      return fetchAllTasks({
        page: 1,
        pageSize: 100,
        clientId: role === "CLIENT" ? currentClientId : undefined
      })
    },
    { refreshInterval: 30000 } // Auto-refresh every 30 seconds
  )

  // Fetch messages
  const { data: msgsResponse, isLoading: msgsLoading, mutate: refreshMsgs } = useSWR(
    shouldFetch ? ["inbox-msgs", role, currentClientId, currentServiceCenterId, currentCpaId] : null,
    async () => {
      if (role === "SERVICE_CENTER") {
        // Fetch messages for clients assigned to this SC
        const allMessages: Message[] = []
        for (const clientId of scClientIds.slice(0, 10)) { // Limit to first 10 clients
          const res = await fetch(`/api/messages/get?clientId=${clientId}&conversationBetween=SERVICE_CENTER,CLIENT`)
          const json = await res.json()
          allMessages.push(...(json.data || []))
        }
        // Also fetch admin-level messages
        const adminRes = await fetch(`/api/messages/get?clientId=0&conversationBetween=SERVICE_CENTER,ADMIN`)
        const adminJson = await adminRes.json()
        allMessages.push(...(adminJson.data || []))

        // Sort by date descending
        allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return { data: allMessages }
      }
      if (role === "CPA") {
        // Fetch messages for clients assigned to this CPA
        const allMessages: Message[] = []
        for (const clientId of cpaClientIds.slice(0, 10)) { // Limit to first 10 clients
          const res = await fetch(`/api/messages/get?clientId=${clientId}&conversationBetween=CPA,CLIENT`)
          const json = await res.json()
          allMessages.push(...(json.data || []))
        }
        // Also fetch admin-level messages
        const adminRes = await fetch(`/api/messages/get?clientId=0&conversationBetween=CPA,ADMIN`)
        const adminJson = await adminRes.json()
        allMessages.push(...(adminJson.data || []))

        // Sort by date descending
        allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return { data: allMessages }
      }
      // For CLIENT and ADMIN, fetch messages and return them
      const response = await fetchMessages({
        clientId: role === "CLIENT" ? currentClientId : undefined
      })
      // Sort messages by date descending (newest first)
      const sortedData = [...(response?.data || [])].sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      return { data: sortedData }
    },
    { refreshInterval: 15000 } // Auto-refresh every 15 seconds
  )

  const tasks = ((tasksResponse?.data || []) as Task[]).filter(
    (t) => t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.clientName || t.client_name || "")?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const messages = ((msgsResponse?.data || []) as Message[]).filter(
    (m) => m.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle Reply - navigate to appropriate messages section
  const handleReply = (clientId: number | null) => {
    if (role === "CLIENT") {
      router.push(`/client/messages`);
    } else if (role === "SERVICE_CENTER") {
      if (clientId) {
        router.push(`/service-center/clients/${clientId}?tab=messages`);
      } else {
        router.push(`/service-center/messages`);
      }
    } else if (role === "CPA") {
      if (clientId) {
        router.push(`/cpa/clients/${clientId}?tab=messages`);
      } else {
        router.push(`/cpa/messages`);
      }
    } else {
      router.push(`/admin/clients/${clientId}?tab=messages`);
    }
  };

  // Handle Open Task - navigate to appropriate tasks section
  const handleOpenTask = (task: Task) => {
    const clientId = task.clientId || task.client_id;
    if (role === "CLIENT") {
      router.push(`/client/tasks`);
    } else if (role === "SERVICE_CENTER") {
      router.push(`/service-center/clients/${clientId}?tab=tasks`);
    } else if (role === "CPA") {
      router.push(`/cpa/clients/${clientId}?tab=tasks`);
    } else {
      router.push(`/admin/clients/${clientId}?tab=tasks`);
    }
  };

  const handleRefresh = () => {
    refreshTasks();
    refreshMsgs();
  };

  // Get title based on role
  const getTitle = () => {
    switch (role) {
      case "SERVICE_CENTER":
        return "Work Queue";
      case "CPA":
        return "CPA Work Queue";
      default:
        return "Inbox";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{getTitle()}</h1>
          <p className="text-muted-foreground">
            {(role === "SERVICE_CENTER" || role === "CPA")
              ? "Manage tasks and messages for your assigned clients"
              : "Manage your tasks, messages, and approvals"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats for Service Center and CPA */}
      {(role === "SERVICE_CENTER" || role === "CPA") && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700">{tasks.length}</div>
              <div className="text-sm text-blue-600">Total Tasks</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-700">
                {tasks.filter(t => t.status === "Not Started" || t.status === "Pending").length}
              </div>
              <div className="text-sm text-amber-600">Pending</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-700">
                {tasks.filter(t => t.status === "In Progress").length}
              </div>
              <div className="text-sm text-purple-600">In Progress</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-700">{messages.length}</div>
              <div className="text-sm text-emerald-600">Messages</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search tasks and messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="w-fit">
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
            {messages.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {messages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approvals
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {(role === "SERVICE_CENTER" || role === "CPA") ? "Tasks Assigned to You" : "Assigned Tasks"}
              </CardTitle>
              {role === "SERVICE_CENTER" && (
                <Button variant="outline" size="sm" onClick={() => router.push("/service-center/tasks")}>
                  View All
                </Button>
              )}
              {role === "CPA" && (
                <Button variant="outline" size="sm" onClick={() => router.push("/cpa/tasks")}>
                  View All
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {tasksLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                // Empty state
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>{searchQuery ? "No tasks match your search" : "No tasks assigned yet"}</p>
                </div>
              ) : (
                // Task list
                tasks.slice(0, 20).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate">{task.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {task.clientName || task.client_name || `Client #${task.clientId || task.client_id}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDueDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <StatusPill status={task.status} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleOpenTask(task)}
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Messages</CardTitle>
              {role === "SERVICE_CENTER" && (
                <Button variant="outline" size="sm" onClick={() => router.push("/service-center/messages")}>
                  Open Messages
                </Button>
              )}
              {role === "CPA" && (
                <Button variant="outline" size="sm" onClick={() => router.push("/cpa/messages")}>
                  Open Messages
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {msgsLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                // Empty state
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>{searchQuery ? "No messages match your search" : "No messages yet"}</p>
                </div>
              ) : (
                // Message list
                messages.slice(0, 20).map((msg) => {
                  const dateTime = formatDateTime(msg.created_at);
                  const isFromMe = msg.sender_role === role;
                  return (
                    <div
                      key={msg.message_id}
                      className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-medium text-sm ${msg.sender_role === "CLIENT" ? "bg-blue-100 text-blue-700" :
                          msg.sender_role === "ADMIN" ? "bg-violet-100 text-violet-700" :
                            msg.sender_role === "SERVICE_CENTER" ? "bg-emerald-100 text-emerald-700" :
                              "bg-amber-100 text-amber-700"
                          }`}>
                          {msg.sender_role?.substring(0, 2) || "??"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium">
                              {isFromMe ? "You" : msg.sender_role}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {isFromMe ? msg.receiver_role : (msg.client_name || "Client")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {msg.body}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {dateTime.relative}
                            </span>
                            {msg.client_name && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {msg.client_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 ml-4"
                        onClick={() => handleReply(msg.client_id)}
                      >
                        Reply
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No approvals pending. Great job!</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
