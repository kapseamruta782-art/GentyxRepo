// app/client/tasks/page.tsx
"use client";

import useSWR, { mutate } from "swr";
import { fetchClientTasksByClientId } from "@/lib/api";
import {
  DataTable,
  type Column,
  TableToolbar,
  useServerTableState,
  TablePagination,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUIStore } from "@/store/ui-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo } from "react";
import {
  ListChecks,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
} from "lucide-react";
import { TaskCompleteModal } from "@/components/widgets/task-complete-modal";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"] as const;

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-amber-100 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
};

type TaskRow = {
  id: number;
  title: string;
  stage: string;
  status: string;
  dueDate: string | null;
  assignedRole: string;
  taskType: "ASSIGNED" | "ONBOARDING";
  stageName?: string;
  originalObject?: any;
  createdAt?: string | Date | null;
  documentRequired?: boolean;
};

type StageItem = {
  client_stage_id: number;
  stage_name: string;
  order_number: number;
  status: string;
};

type SubtaskItem = {
  subtask_id: number;
  client_stage_id: number;
  subtask_title: string;
  status: string;
  order_number: number;
  due_date?: string | null;
  created_at?: string;
  document_required?: number | boolean;
};

export default function ClientTasks() {
  const router = useRouter();
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);
  const setCurrentClientId = useUIStore((s) => s.setCurrentClientId);
  const { toast } = useToast();

  const [clientId, setClientId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "Not Started" | "In Progress" | "Completed"
  >("ALL");
  const [filterDue, setFilterDue] = useState<"ALL" | "OVERDUE" | "UPCOMING">(
    "ALL"
  );
  const [filterTaskType, setFilterTaskType] = useState<"ALL" | "ONBOARDING" | "ASSIGNED">("ALL");
  const [expandedStages, setExpandedStages] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<"assigned" | "onboarding">("assigned");

  // State for task completion modal (mandatory document upload)
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [pendingTask, setPendingTask] = useState<{
    id: number;
    title: string;
    type: "assigned" | "onboarding";
    stageName?: string; // Only for onboarding subtasks
  } | null>(null);

  const { page, setPage, pageSize, setPageSize, q, setQ } =
    useServerTableState();

  // Helper function to get cookie value
  function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)")
    );
    return match ? match[2] : null;
  }

  // Load clientId from Zustand OR cookies as fallback
  useEffect(() => {
    if (currentClientId) {
      setClientId(currentClientId);
      return;
    }

    const cookieClientId = getCookie("clienthub_clientId");
    if (cookieClientId) {
      setClientId(cookieClientId);
      setCurrentClientId(cookieClientId);
    }
  }, [role, currentClientId, setCurrentClientId]);

  // Fetch assigned tasks
  const {
    data,
    isLoading,
    mutate: refreshTasks,
  } = useSWR(
    clientId ? [`client-tasks`, clientId] : null,
    () => fetchClientTasksByClientId(clientId!),
    { revalidateOnFocus: false }
  );

  // Fetch onboarding stages and subtasks
  const { data: stageData, mutate: refreshStages } = useSWR(
    clientId ? ["client-stages-tasks", clientId] : null,
    async () => {
      const res = await fetch(`/api/stages/client/get?clientId=${clientId}`);
      if (!res.ok) return { data: [], subtasks: [] };
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  const stages: StageItem[] = stageData?.data || [];
  const subtasksFlat: SubtaskItem[] = stageData?.subtasks || [];

  // Map subtasks to stages
  const stagesWithSubtasks = useMemo(() => {
    return stages
      .sort((a, b) => a.order_number - b.order_number)
      .map((stage) => ({
        ...stage,
        subtasks: subtasksFlat
          .filter((s) => s.client_stage_id === stage.client_stage_id)
          .sort((a, b) => a.order_number - b.order_number),
      }));
  }, [stages, subtasksFlat]);

  // Expand all stages by default
  useEffect(() => {
    if (stages.length > 0 && expandedStages.length === 0) {
      setExpandedStages(stages.map((s) => s.client_stage_id));
    }
  }, [stages]);

  // Combine and sort both assigned tasks and onboarding subtasks
  const allTasks: TaskRow[] = useMemo(() => {
    // 1. Map assigned tasks
    const mappedAssigned: TaskRow[] = (data?.data || []).map((t: any) => {
      // Debug: Log what documentRequired looks like from the API
      console.log("Task from API:", t.id, t.title, "documentRequired:", t.documentRequired, "type:", typeof t.documentRequired);

      // documentRequired: SQL BIT returns 0/1, convert to proper boolean
      // If value is 0 or false = not required; otherwise = required (default true)
      const isDocRequired = t.documentRequired === 0 || t.documentRequired === false ? false : true;

      return {
        id: t.id,
        title: t.title,
        stage: t.stage || "-",
        status: t.status || "Not Started",
        dueDate: t.dueDate,
        assignedRole: t.assignedRole || "CLIENT",
        taskType: "ASSIGNED" as const,
        createdAt: t.createdAt,
        documentRequired: isDocRequired,
        originalObject: t,
      };
    });

    // 2. Map onboarding subtasks
    const mappedOnboarding: TaskRow[] = [];
    stagesWithSubtasks.forEach((stage) => {
      stage.subtasks.forEach((sub) => {
        mappedOnboarding.push({
          id: sub.subtask_id, // Note: ID collision possible if not handled by DB IDs properly. Assuming distinct for now or OK for display.
          title: sub.subtask_title,
          stage: stage.stage_name,
          status: sub.status || "Not Started",
          dueDate: sub.due_date || null, // ✅ Fix: Ensure undefined becomes null
          assignedRole: "CLIENT",
          taskType: "ONBOARDING",
          stageName: stage.stage_name, // For folder paths
          createdAt: sub.created_at, // ✅ Mapped from API
          documentRequired: sub.document_required === 1 || sub.document_required === true, // ✅ Map actual requirement
          originalObject: sub,
        });
      });
    });

    // 3. Merge and Sort by Due Date (Earliest first), then by Created Date
    const combined = [...mappedAssigned, ...mappedOnboarding];
    return combined.sort((a, b) => {
      // 1. Sort by Due Date (Latest/Furthest first)
      // Tasks with due dates come before tasks without
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      if (a.dueDate && b.dueDate) {
        const dueA = new Date(a.dueDate).getTime();
        const dueB = new Date(b.dueDate).getTime();
        if (dueA !== dueB) return dueB - dueA; // Descending
      }

      // 2. Secondary Sort: Most Recent Created first
      const createA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return createB - createA;
    });
  }, [data, stagesWithSubtasks]);

  // Combined Status Stats
  const combinedStats = useMemo(() => {
    return {
      total: allTasks.length,
      notStarted: allTasks.filter((t) => t.status === "Not Started").length,
      inProgress: allTasks.filter((t) => t.status === "In Progress").length,
      completed: allTasks.filter((t) => t.status === "Completed").length,
    };
  }, [allTasks]);

  // Update task status - check if changing to Completed (requires document upload)
  const handleStatusChange = async (taskId: number, newStatus: string) => {
    // If changing to Completed, check if document is required
    if (newStatus === "Completed") {
      const task = allTasks.find((t) => t.id === taskId);
      if (task) {
        // Only show document upload modal if document is required
        // documentRequired comes as 0/1 from SQL BIT type, or true/false
        const isDocRequired = task.documentRequired === true;

        console.log("Task documentRequired check:", {
          taskId,
          documentRequired: task.documentRequired,
          isDocRequired
        });

        if (isDocRequired) {
          setPendingTask({
            id: taskId,
            title: task.title,
            type: "assigned",
          });
          setCompleteModalOpen(true);
          return; // Don't update status yet - wait for document upload
        }
        // If document not required, complete task directly
      }
    }

    // For non-Completed status changes or tasks not requiring documents, proceed normally
    await updateTaskStatus(taskId, newStatus);
  };

  // Actual task status update function (called after document upload or for non-Completed status)
  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: taskId,
          status: newStatus,
        }),
      });

      const json = await res.json();

      // Check both HTTP status and response body for success
      if (res.ok && json.success !== false) {
        toast({
          title: "Status Updated",
          description: `Task status changed to "${newStatus}"`,
        });
        // Refresh to get the latest data
        refreshTasks();
      } else {
        const errorMsg = json.error || "Failed to update task status";
        console.error("Task update failed:", errorMsg);
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
        refreshTasks();
      }
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Error",
        description: "An error occurred while updating task status",
        variant: "destructive",
      });
      refreshTasks();
    }
  };

  // Update subtask status - check if changing to Completed (requires document upload)
  const handleSubtaskStatusChange = async (subtaskId: number, newStatus: string) => {
    // If changing to Completed, show the document upload modal
    if (newStatus === "Completed") {
      const subtask = subtasksFlat.find((s) => s.subtask_id === subtaskId);
      if (subtask) {
        // Find the stage that this subtask belongs to
        const stage = stages.find((s) => s.client_stage_id === subtask.client_stage_id);
        setPendingTask({
          id: subtaskId,
          title: subtask.subtask_title,
          type: "onboarding",
          stageName: stage?.stage_name, // Include stage name for folder structure
        });
        setCompleteModalOpen(true);
        return; // Don't update status yet - wait for document upload
      }
    }

    // For non-Completed status changes, proceed normally
    await updateSubtaskStatus(subtaskId, newStatus);
  };

  // Actual subtask status update function (called after document upload or for non-Completed status)
  const updateSubtaskStatus = async (subtaskId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/stages/subtask/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtaskId: subtaskId,
          status: newStatus,
        }),
      });

      const json = await res.json();

      // Check both HTTP status and response body for success
      if (res.ok && json.success !== false) {
        toast({
          title: "Status Updated",
          description: `Subtask status changed to "${newStatus}"`,
        });
        refreshStages();
      } else {
        const errorMsg = json.error || "Failed to update subtask status";
        console.error("Subtask update failed:", errorMsg);
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
        refreshStages();
      }
    } catch (error) {
      console.error("Subtask update error:", error);
      toast({
        title: "Error",
        description: "An error occurred while updating subtask status",
        variant: "destructive",
      });
      refreshStages();
    }
  };

  // Handle task completion after document upload
  const handleTaskComplete = async () => {
    if (!pendingTask) return;

    if (pendingTask.type === "assigned") {
      await updateTaskStatus(pendingTask.id, "Completed");
    } else {
      await updateSubtaskStatus(pendingTask.id, "Completed");
    }

    setPendingTask(null);
  };

  // Toggle stage expansion
  const toggleStage = (stageId: number) => {
    setExpandedStages((prev) =>
      prev.includes(stageId)
        ? prev.filter((id) => id !== stageId)
        : [...prev, stageId]
    );
  };

  // Apply filters
  const filteredTasks = allTasks.filter((task) => {
    if (q) {
      const search = q.toLowerCase();
      const match =
        task.title?.toLowerCase().includes(search) ||
        task.stage?.toLowerCase().includes(search) ||
        task.status?.toLowerCase().includes(search);
      if (!match) return false;
    }

    if (filterTaskType !== "ALL" && task.taskType !== filterTaskType) {
      return false;
    }

    if (filterStatus !== "ALL" && task.status !== filterStatus) {
      return false;
    }

    if (filterDue === "OVERDUE" && task.dueDate) {
      if (new Date(task.dueDate) >= new Date()) return false;
      if (task.status === "Completed") return false;
    }

    if (filterDue === "UPCOMING" && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const now = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      if (dueDate < now || dueDate > weekFromNow) return false;
    }

    return true;
  });

  // Calculate stats for assigned tasks
  const assignedStats = {
    total: allTasks.length,
    notStarted: allTasks.filter((t) => t.status === "Not Started").length,
    inProgress: allTasks.filter((t) => t.status === "In Progress").length,
    completed: allTasks.filter((t) => t.status === "Completed").length,
    overdue: allTasks.filter((t) => {
      if (!t.dueDate || t.status === "Completed") return false;
      return new Date(t.dueDate) < new Date();
    }).length,
  };

  // Calculate stats for onboarding subtasks
  const onboardingStats = useMemo(() => {
    const total = subtasksFlat.length;
    const completed = subtasksFlat.filter((s) => s.status === "Completed").length;
    const inProgress = subtasksFlat.filter((s) => s.status === "In Progress").length;
    const notStarted = subtasksFlat.filter(
      (s) => s.status === "Not Started" || !s.status
    ).length;
    return { total, completed, inProgress, notStarted };
  }, [subtasksFlat]);

  // Pagination
  const total = filteredTasks.length;
  const rows = filteredTasks.slice((page - 1) * pageSize, page * pageSize);
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  const cols: Column<TaskRow>[] = [
    {
      key: "title",
      header: "Task",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.title}</span>
          {row.documentRequired && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 w-fit">
              <FileText className="h-3 w-3" />
              Document Required
            </span>
          )}
        </div>
      )
    },
    {
      key: "taskType",
      header: "Type",
      render: (row) => {
        const isOnboarding = row.taskType === "ONBOARDING";
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold ${isOnboarding
              ? "bg-indigo-50 text-indigo-700"
              : "bg-slate-100 text-slate-700"
              }`}
          >
            {isOnboarding ? "Onboarding" : "Assigned"}
          </span>
        );
      },
    },
    {
      key: "stage",
      header: "Onboarding Stage",
      render: (row) => {
        if (row.taskType === "ONBOARDING" && row.stageName) {
          return (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-white text-gray-900 border border-gray-300 shadow-sm">
              {row.stageName}
            </span>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (row) => {
        if (!row.dueDate)
          return <span className="text-muted-foreground">-</span>;

        // Handle timezone issues: treat the server date as the intended calendar date
        // API sends ISO string (UTC). We want to treat "2026-01-08" as Jan 8th Local, not Jan 7th 7pm.
        const dateObj = new Date(row.dueDate);
        const normalizedDue = new Date(
          dateObj.getUTCFullYear(),
          dateObj.getUTCMonth(),
          dateObj.getUTCDate()
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today to start of day

        // Check if strictly before today and NOT completed
        const isOverdue = normalizedDue < today && row.status !== "Completed";

        return (
          <span className={isOverdue ? "text-red-600 font-medium" : ""}>
            {normalizedDue.toLocaleDateString()}
            {isOverdue && <span className="ml-1">(Overdue)</span>}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Select
          value={row.status || "Not Started"}
          onValueChange={(value) => {
            if (row.taskType === "ASSIGNED") {
              handleStatusChange(row.id, value);
            } else {
              handleSubtaskStatusChange(row.id, value);
            }
          }}
        >
          <SelectTrigger
            className={`h-8 px-3 rounded-full text-xs font-medium border ${STATUS_COLORS[row.status || "Not Started"]
              }`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "id", // using id as key property
      header: "Actions",
      render: (row) => {
        // Check if task is completed AND requires/has documents
        const isCompleted = row.status === "Completed";
        const hasDocRequirement = row.documentRequired === true;

        if (isCompleted && hasDocRequirement) {
          return (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-primary"
              onClick={() => {
                // Navigate to the specific folder for this task
                let folderPath = "";
                if (row.taskType === "ASSIGNED") {
                  folderPath = encodeURIComponent(`Assigned Task Completion Documents/${row.title}`);
                } else {
                  folderPath = encodeURIComponent(
                    `Onboarding Stage Completion Documents/${row.stageName}-${row.title}`
                  );
                }
                router.push(`/client/documents?folder=${folderPath}`);
              }}
              title="View completion documents"
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs">View Docs</span>
            </Button>
          );
        } else if (isCompleted) {
          // Completed but no doc required - show checkmark or nothing
          return <span className="text-green-600 text-xs">✓ Done</span>;
        } else {
          return <span className="text-muted-foreground text-xs">-</span>;
        }
      },
    },
  ];

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            My Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and update your tasks and onboarding progress
          </p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all ${filterStatus === "ALL" ? "ring-2 ring-primary" : ""}`}
          onClick={() => {
            setFilterStatus("ALL");
            setPage(1);
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Total Tasks
                </p>
                <p className="text-2xl font-bold">{combinedStats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${filterStatus === "Not Started" ? "ring-2 ring-amber-500" : ""}`}
          onClick={() => {
            setFilterStatus("Not Started");
            setPage(1);
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Not Started
                </p>
                <p className="text-2xl font-bold text-amber-600">
                  {combinedStats.notStarted}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${filterStatus === "In Progress" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => {
            setFilterStatus("In Progress");
            setPage(1);
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  In Progress
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {combinedStats.inProgress}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${filterStatus === "Completed" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => {
            setFilterStatus("Completed");
            setPage(1);
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Completed
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {combinedStats.completed}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-3">
        <TableToolbar q={q} setQ={setQ} />

        <Select
          value={filterTaskType}
          onValueChange={(v) => {
            setFilterTaskType(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Task Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setFilterStatus(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterDue}
          onValueChange={(v) => {
            setFilterDue(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Due Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Due Dates</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="UPCOMING">Due This Week</SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFilterStatus("ALL");
            setFilterDue("ALL");
            setFilterTaskType("ALL");
            setQ("");
            setPage(1);
          }}
        >
          Clear Filters
        </Button>
      </div>

      {/* TABLE */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">
            Loading tasks...
          </span>
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-muted/50 rounded-full p-4 mb-4">
              <ListChecks className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No tasks found.</p>
            {(filterStatus !== "ALL" || filterDue !== "ALL" || q) && (
              <Button
                variant="link"
                onClick={() => {
                  setFilterStatus("ALL");
                  setFilterDue("ALL");
                  setFilterTaskType("ALL");
                  setQ("");
                }}
              >
                Clear filters to see all tasks
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <DataTable columns={cols} rows={rows} />

          <div className="flex items-center justify-between text-sm text-muted-foreground py-3 px-1 border-t">
            <div className="flex items-center gap-2">
              <span>Items per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              {start}–{end} of {total} tasks
            </div>
          </div>

          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            setPage={setPage}
          />
        </>
      )}

      {/* Task Completion Modal - requires document upload */}
      {clientId && pendingTask && (
        <TaskCompleteModal
          open={completeModalOpen}
          onClose={() => {
            setCompleteModalOpen(false);
            setPendingTask(null);
          }}
          onComplete={handleTaskComplete}
          taskTitle={pendingTask.title}
          taskId={pendingTask.id}
          clientId={clientId}
          taskType={pendingTask.type}
          stageName={pendingTask.stageName}
        />
      )}
    </div>
  );
}
