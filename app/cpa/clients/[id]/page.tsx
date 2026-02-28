"use client"

import { useParams, useSearchParams } from "next/navigation"
import useSWR, { mutate } from "swr"
import { fetchClient, fetchTasks } from "@/lib/api"
import type { ClientProfile } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { FlexibleChat } from "@/components/widgets/flexible-chat"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  ClipboardList,
  FolderOpen,
  MessageSquare,
  Clock,
  CheckCircle2,
  TrendingUp,
  Calendar
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ClientDocumentsViewer } from "@/components/widgets/client-documents-viewer"



export default function CPAClientWorkspace() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") || "overview"
  const router = useRouter()
  const { toast } = useToast()

  const { data: client } = useSWR<ClientProfile>(
    id ? `cpa-client-${id}` : null,
    () => fetchClient(id!)
  )
  const { data: tasksData, mutate: refreshTasks } = useSWR(
    id ? `cpa-tasks-${id}` : null,
    () => fetchTasks({ clientId: id! })
  )


  // Filter to only CPA tasks
  const cpaTasks = (tasksData?.data || []).filter((t: any) => t.assigneeRole === "CPA")

  // Update task status
  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: newStatus }),
      })

      if (res.ok) {
        toast({ title: "Status Updated", description: `Task status changed to ${newStatus}` })
        refreshTasks()
        mutate(["cpa-all-tasks"])
      } else {
        throw new Error("Failed to update")
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200"
      case "In Progress":
        return "bg-violet-100 text-violet-700 border-violet-200"
      case "Not Started":
        return "bg-gray-100 text-gray-700 border-gray-200"
      default:
        return "bg-amber-100 text-amber-700 border-amber-200"
    }
  }



  const chatRecipients = [
    { role: "CLIENT", label: client?.client_name || "Client", color: "bg-blue-500" },
    { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
  ]

  if (!client) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading client...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/cpa/clients-list")}
            className="mt-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-lg font-semibold text-amber-700">
                {client.client_name?.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{client.client_name}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span className="font-mono">{client.code}</span>
                  <StatusPill status={client.client_status || "Active"} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Contact Name</p>
                <p className="text-sm font-medium">{client.primary_contact_name || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{client.primary_contact_email || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{client.primary_contact_phone || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Your Tasks</p>
                <p className="text-sm font-medium">{cpaTasks.length} task{cpaTasks.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Building2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks ({cpaTasks.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span className="text-sm text-amber-700">Pending</span>
                </div>
                <div className="text-3xl font-bold text-amber-700">
                  {cpaTasks.filter((t: any) => t.status === "Not Started" || t.status === "Pending").length}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-violet-600" />
                  <span className="text-sm text-violet-700">In Progress</span>
                </div>
                <div className="text-3xl font-bold text-violet-700">
                  {cpaTasks.filter((t: any) => t.status === "In Progress").length}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm text-emerald-700">Completed</span>
                </div>
                <div className="text-3xl font-bold text-emerald-700">
                  {cpaTasks.filter((t: any) => t.status === "Completed").length}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TASKS TAB */}
        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Tasks Assigned to You
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cpaTasks.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No tasks assigned to you for this client</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Task</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Due Date</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {cpaTasks.map((task: any) => (
                        <tr key={task.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-4 pr-4">
                            <span className="font-medium">{task.title}</span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
                            </span>
                          </td>
                          <td className="py-4">
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger className={cn(
                                "w-[140px] h-8 text-sm border",
                                getStatusColor(task.status)
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Not Started">Not Started</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="mt-4">
          <ClientDocumentsViewer
            clientId={id}
            clientName={client.client_name}
            baseFolderPath="Assigned Task Completion Documents - CPA"
            height="500px"
          />
        </TabsContent>

        {/* MESSAGES TAB */}
        <TabsContent value="messages" className="mt-4">
          <FlexibleChat
            clientId={id}
            clientName={client.client_name}
            currentUserRole="CPA"
            recipients={chatRecipients}
            height="500px"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
