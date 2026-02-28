"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUIStore } from "@/store/ui-store"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
    ClipboardList,
    Search,
    ArrowRight,
    Calendar,
    Building2,
    Clock,
    CheckCircle2,
    TrendingUp,
    RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TaskCompleteModal } from "@/components/widgets/task-complete-modal"

interface Task {
    id: number
    task_id?: number
    title: string
    clientId: number
    client_id?: number
    clientName: string
    client_name?: string
    status: string
    dueDate: string | null
    due_date?: string | null
    assigneeRole: string
    documentRequired?: boolean | number
}

export default function CPATasksPage() {
    const router = useRouter()
    const { toast } = useToast()
    const currentCpaId = useUIStore((s) => s.currentCpaId)

    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [clientFilter, setClientFilter] = useState("all")

    // State for task completion modal (mandatory document upload)
    const [completeModalOpen, setCompleteModalOpen] = useState(false)
    const [pendingTask, setPendingTask] = useState<{
        id: number
        title: string
        clientId: number
        clientName: string
    } | null>(null)

    // Fetch clients for filter dropdown
    const { data: clientsData } = useSWR(
        currentCpaId ? ["cpa-clients-for-filter", currentCpaId] : null,
        async () => {
            const res = await fetch(`/api/clients/get-by-cpa?cpaId=${currentCpaId}`)
            const json = await res.json()
            return json.data || []
        }
    )

    const clients = clientsData || []

    // Fetch all tasks assigned to CPA
    const { data: allTasksData, isLoading, mutate: refreshTasks } = useSWR(
        ["cpa-all-tasks"],
        async () => {
            const res = await fetch("/api/tasks/list")
            const json = await res.json()
            return json.data || []
        },
        { refreshInterval: 30000 }
    )

    // Filter to only CPA tasks and map documentRequired properly
    const cpaTasks: Task[] = (allTasksData || [])
        .filter((task: any) => task.assigneeRole === "CPA")
        .map((task: any) => ({
            ...task,
            // SQL BIT returns 0/1, convert to proper boolean
            documentRequired: task.documentRequired === 0 || task.documentRequired === false ? false : true
        }))

    // Apply filters
    const filteredTasks = cpaTasks.filter((task) => {
        const matchesSearch = !searchQuery ||
            task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (task.clientName || task.client_name || "")?.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesStatus = statusFilter === "all" || task.status === statusFilter

        const taskClientId = task.clientId || task.client_id
        const matchesClient = clientFilter === "all" || String(taskClientId) === clientFilter

        return matchesSearch && matchesStatus && matchesClient
    })

    // Update task status - check if changing to Completed (requires document upload)
    const handleStatusChange = async (taskId: number, newStatus: string) => {
        // If changing to Completed, check if document is required
        if (newStatus === "Completed") {
            const task = cpaTasks.find((t) => (t.id || t.task_id) === taskId)
            if (task) {
                const isDocRequired = task.documentRequired === true

                console.log("CPA Task documentRequired check:", {
                    taskId,
                    documentRequired: task.documentRequired,
                    isDocRequired
                })

                if (isDocRequired) {
                    const clientId = task.clientId || task.client_id
                    const clientName = task.clientName || task.client_name || `Client-${clientId}`
                    setPendingTask({
                        id: taskId,
                        title: task.title,
                        clientId: clientId!,
                        clientName: clientName
                    })
                    setCompleteModalOpen(true)
                    return // Don't update status yet - wait for document upload
                }
                // If document not required, complete task directly
            }
        }

        // For non-Completed status changes or tasks not requiring documents, proceed normally
        await updateTaskStatus(taskId, newStatus)
    }

    // Actual task status update function (called after document upload or for non-Completed status)
    const updateTaskStatus = async (taskId: number, newStatus: string) => {
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

    // Handle task completion after document upload
    const handleTaskComplete = async () => {
        if (!pendingTask) return
        await updateTaskStatus(pendingTask.id, "Completed")
        setPendingTask(null)
    }

    const formatDueDate = (dateString: string | null, status?: string) => {
        if (!dateString) return { text: "No due date", isOverdue: false }
        const date = new Date(dateString)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const isOverdue = date < today && status !== "Completed"
        const text = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        return { text, isOverdue }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Completed":
                return <CheckCircle2 className="h-4 w-4" />
            case "In Progress":
                return <TrendingUp className="h-4 w-4" />
            default:
                return <Clock className="h-4 w-4" />
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
                    <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your {cpaTasks.length} assigned task{cpaTasks.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refreshTasks()} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Client Filter */}
                        <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="All Clients" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients.map((client: any) => (
                                    <SelectItem key={client.client_id} value={String(client.client_id)}>
                                        {client.client_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[160px]">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="Not Started">Not Started</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Tasks List */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-amber-600" />
                        <CardTitle className="text-lg">All Tasks ({filteredTasks.length})</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <span className="ml-2 text-muted-foreground">Loading tasks...</span>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p>{searchQuery || statusFilter !== "all" || clientFilter !== "all"
                                ? "No tasks match your filters"
                                : "No tasks assigned to you yet"}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Task</th>
                                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Client</th>
                                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Due Date</th>
                                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                        <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredTasks.map((task) => {
                                        const taskId = task.id || task.task_id
                                        const clientId = task.clientId || task.client_id
                                        const clientName = task.clientName || task.client_name
                                        const dueDate = task.dueDate ?? task.due_date ?? null

                                        return (
                                            <tr key={taskId} className="group hover:bg-muted/50 transition-colors">
                                                <td className="py-4 pr-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                                            task.status === "Completed" ? "bg-emerald-100 text-emerald-600" :
                                                                task.status === "In Progress" ? "bg-violet-100 text-violet-600" :
                                                                    "bg-amber-100 text-amber-600"
                                                        )}>
                                                            {getStatusIcon(task.status)}
                                                        </div>
                                                        <span className="font-medium">{task.title}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 pr-4">
                                                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                        <Building2 className="h-4 w-4" />
                                                        {clientName}
                                                    </span>
                                                </td>
                                                <td className="py-4 pr-4">
                                                    {(() => {
                                                        const { text, isOverdue } = formatDueDate(dueDate, task.status)
                                                        return (
                                                            <span className={cn(
                                                                "flex items-center gap-1.5 text-sm",
                                                                isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                                                            )}>
                                                                <Calendar className="h-4 w-4" />
                                                                {text}
                                                                {isOverdue && <span className="text-xs">(Overdue)</span>}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="py-4 pr-4">
                                                    <Select
                                                        value={task.status}
                                                        onValueChange={(value) => handleStatusChange(taskId!, value)}
                                                    >
                                                        <SelectTrigger className={cn(
                                                            "w-[140px] h-8 text-sm border",
                                                            getStatusColor(task.status)
                                                        )}>
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
                                                                    <span className="h-2 w-2 rounded-full bg-violet-500"></span>
                                                                    In Progress
                                                                </span>
                                                            </SelectItem>
                                                            <SelectItem value="Completed">
                                                                <span className="flex items-center gap-2">
                                                                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                                                    Completed
                                                                </span>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => router.push(`/cpa/clients/${clientId}`)}
                                                    >
                                                        View Client <ArrowRight className="h-3 w-3" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Task Complete Modal for Document Upload */}
            {pendingTask && (
                <TaskCompleteModal
                    open={completeModalOpen}
                    onClose={() => {
                        setCompleteModalOpen(false)
                        setPendingTask(null)
                    }}
                    onComplete={handleTaskComplete}
                    taskTitle={pendingTask.title}
                    taskId={pendingTask.id}
                    clientId={String(pendingTask.clientId)}
                    clientName={pendingTask.clientName}
                    uploaderRole="CPA"
                    taskType="assigned"
                />
            )}
        </div>
    )
}
