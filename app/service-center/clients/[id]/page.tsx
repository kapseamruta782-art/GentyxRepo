"use client"

import { useParams } from "next/navigation"
import useSWR, { mutate } from "swr"
import { fetchClient, fetchTasks } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Building2, Mail, Phone, Calendar, User, FolderOpen } from "lucide-react"
import { FlexibleChat } from "@/components/widgets/flexible-chat"
import { ClientDocumentsViewer } from "@/components/widgets/client-documents-viewer"

export default function ServiceCenterClientWorkspace() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const { data: client } = useSWR(["client", id], () => fetchClient(id))
  const { data: allTasks, mutate: refreshTasks } = useSWR(["tasks", id], () => fetchTasks({ clientId: id }))

  // Filter tasks to only show those assigned to SERVICE_CENTER
  const serviceCenterTasks = (allTasks?.data || []).filter(
    (task: any) => task.assigneeRole === "SERVICE_CENTER"
  )

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
        mutate(["sc-all-tasks"])
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    }
  }

  // Chat recipients for Service Center - only chat with the Client
  const chatRecipients = [
    { role: "CLIENT", label: client?.client_name || "Client", color: "bg-blue-500" },
  ]

  return (
    <div className="space-y-6">
      {/* Client Header */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{client?.client_name || "Loading..."}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                {client?.primary_contact_name && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {client.primary_contact_name}
                  </span>
                )}
                {client?.primary_contact_email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {client.primary_contact_email}
                  </span>
                )}
                {client?.primary_contact_phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    {client.primary_contact_phone}
                  </span>
                )}

              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="tasks" className="data-[state=active]:bg-background">
            My Tasks ({serviceCenterTasks.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-background">
            <FolderOpen className="h-4 w-4 mr-1" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages" className="data-[state=active]:bg-background">
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Tasks Assigned to You</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceCenterTasks.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No tasks assigned to you for this client
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Client</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Due Date</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {serviceCenterTasks.map((task: any) => (
                        <tr key={task.id} className="group">
                          <td className="py-4 pr-4">
                            <span className="text-sm font-medium">{task.title}</span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="text-sm text-muted-foreground">{client?.client_name}</span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                            </span>
                          </td>
                          <td className="py-4">
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Not Started">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                                    Not Started
                                  </span>
                                </SelectItem>
                                <SelectItem value="In Progress">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                                    In Progress
                                  </span>
                                </SelectItem>
                                <SelectItem value="Completed">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                    Completed
                                  </span>
                                </SelectItem>
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

        <TabsContent value="documents" className="mt-4">
          <ClientDocumentsViewer
            clientId={id}
            clientName={client?.client_name}
            baseFolderPath="Assigned Task Completion Documents - Service Center"
            height="500px"
          />
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <FlexibleChat
            clientId={id}
            clientName={client?.client_name}
            currentUserRole="SERVICE_CENTER"
            recipients={chatRecipients}
            height="500px"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
