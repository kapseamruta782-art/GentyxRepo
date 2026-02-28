// app/admin/tasks/page.tsx
"use client";

import useSWR from "swr";
import { fetchAllTasks, fetchClients } from "@/lib/api";
import {
  DataTable,
  type Column,
  TableToolbar,
  useServerTableState,
  TablePagination,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { StatusPill } from "@/components/widgets/status-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { mutate } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientTaskModal } from "@/components/widgets/client-task-modal";
import { TaskCompleteModal } from "@/components/widgets/task-complete-modal";
import { useState, useMemo, useEffect } from "react";
import { AlertCircle, Eye, FileText } from "lucide-react";


const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"] as const;

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-amber-100 text-amber-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Completed": "bg-green-100 text-green-700",
};


// type TaskRow = {
//   id: number;
//   clientId: number;
//   title: string;
//   assigneeRole: string;
//   status: string;
//   dueDate: string;
// };
type TaskRow = {
  id: number;
  clientId: number;
  title: string;
  assignedRole: string;   // ✅ correct field
  status: string;
  dueDate: string | null;
  taskType: string;
  documentRequired?: boolean | number; // ✅ Added for document requirement check
};


export default function AdminTasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openClientTasks, setOpenClientTasks] = useState(false);
  const [selectedClientTasks, setSelectedClientTasks] = useState<any[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [filterTaskType, setFilterTaskType] = useState<"ALL" | "ONBOARDING" | "ASSIGNED">("ALL");
  const [filterAssignedRole, setFilterAssignedRole] = useState<"ALL" | "CLIENT" | "SERVICE_CENTER" | "CPA">("ALL");
  const [filterDue, setFilterDue] = useState<"ALL" | "WITH_DUE" | "OVERDUE" | "CUSTOM">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED">("ALL");
  const [dueFrom, setDueFrom] = useState<string | null>(null);
  const [dueTo, setDueTo] = useState<string | null>(null);

  // State for task completion modal (mandatory document upload)
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [pendingTask, setPendingTask] = useState<{
    id: number;
    title: string;
    clientId: number;
    clientName: string;
    taskType: "ASSIGNED" | "ONBOARDING";
  } | null>(null);

  const { toast } = useToast();
  const { page, setPage, pageSize, setPageSize, q, setQ } = useServerTableState();

  // Initialize filters from URL on mount
  useEffect(() => {
    const urlFilter = searchParams.get("filter");
    const urlStatus = searchParams.get("status");

    if (urlFilter === "overdue") {
      setFilterDue("OVERDUE");
    }
    if (urlStatus === "in-progress") {
      setFilterStatus("IN_PROGRESS");
    }
  }, [searchParams]);

  // Load persisted page size on mount
  useEffect(() => {
    const savedSize = localStorage.getItem("adminTasksPageSize");
    if (savedSize) {
      setPageSize(Number(savedSize));
    }
  }, []);



  // Load ALL tasks so frontend pagination works
  const { data: tasksData } = useSWR(["tasks"], () =>
    fetchAllTasks({ page: 1, pageSize: 500 })
  );

  // Load clients for name mapping
  const { data: clientsData } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 500 })
  );

  const openDrawer = useUIStore((s) => s.openDrawer);

  const getClientName = (clientId: number) => {
    const list = clientsData?.data || [];
    const found = list.find((c: any) => c.client_id === clientId);
    return found?.client_name ?? `Client #${clientId}`;
  };
  const allTasks: TaskRow[] = tasksData?.data || [];

  const cols: Column<TaskRow>[] = [
    {
      key: "clientId",
      header: "Client Name",
      render: (row) => getClientName(row.clientId),
    },
    {
      key: "title",
      header: "Task",
      render: (row) => (
        <div className="flex flex-col max-w-[400px]">
          <span className="truncate" title={row.title}>{row.title}</span>
          {(row.documentRequired === 1 || row.documentRequired === true) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 w-fit">
              <FileText className="h-3 w-3" />
              Document Required
            </span>
          )}
        </div>
      ),
    },
    {
      key: "assignedRole",
      header: "Assigned User",
      render: (row) => row.assignedRole || "CLIENT",
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

    // ✅ DUE DATE COLUMN WITH OVERDUE STYLING
    {
      key: "dueDate",
      header: "Due",
      render: (row) => {
        if (!row.dueDate) return <span className="text-muted-foreground">-</span>;
        const dueDate = new Date(row.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today && row.status !== "Completed";
        return (
          <span className={isOverdue ? "text-red-600 font-medium" : ""}>
            {dueDate.toLocaleDateString()}
            {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
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
          onValueChange={async (value) => {
            // If changing to Completed, check if document is required
            if (value === "Completed") {
              // Check if document is required (0 or false = not required)
              const isDocRequired = row.documentRequired === 0 || row.documentRequired === false ? false : true;

              console.log("Admin task completion check:", {
                taskId: row.id,
                documentRequired: row.documentRequired,
                isDocRequired
              });

              if (isDocRequired) {
                setPendingTask({
                  id: row.id,
                  title: row.title,
                  clientId: row.clientId,
                  clientName: getClientName(row.clientId),
                  taskType: row.taskType as "ASSIGNED" | "ONBOARDING",
                });
                setCompleteModalOpen(true);
                return; // Don't update status yet - wait for document upload
              }
              // If document not required, fall through to update status directly
            }

            // For non-Completed status changes, proceed normally
            // For non-Completed status changes, proceed normally

            if (row.taskType === "ONBOARDING") {
              // Update Subtask Status
              await fetch("/api/stages/subtask/update-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subtaskId: row.id,
                  status: value,
                }),
              });
            } else {
              // Update Assigned Task Status
              await fetch("/api/tasks/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  taskId: row.id,
                  status: value,
                }),
              });
            }

            mutate(["tasks"]); // ✅ refresh table
          }}
        >
          <SelectTrigger
            className={`h-8 px-3 rounded-full text-xs font-medium border-0 ${STATUS_COLORS[row.status || "Not Started"]}`}
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


    // ✅ ACTIONS COLUMN (LAST + CENTERED)
    {
      key: "actions",
      header: "Actions",
      className: "text-center",
      render: (row) => (
        <div className="flex items-center justify-center gap-2 w-full">
          {/* ✅ VIEW DOCS (only for completed tasks WITH document requirement) - fixed width for alignment */}
          <div className="w-[85px]">
            {row.status === "Completed" && (row.documentRequired === 1 || row.documentRequired === true) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-primary"
                onClick={() => {
                  // Navigate to the specific folder for this task's completion docs
                  // New structure: Assigned Task Completion Documents/{clientName}/{taskTitle}
                  const clientName = getClientName(row.clientId);
                  const folderPath = encodeURIComponent(`Assigned Task Completion Documents/${clientName}/${row.title}`);
                  router.push(`/admin/documents?clientId=${row.clientId}&folder=${folderPath}`);
                }}
                title="View completion documents"
              >
                <Eye className="h-4 w-4" />
                <span className="text-xs">View Docs</span>
              </Button>
            )}
          </div>

          {/* ✅ VIEW CLIENT TASKS */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const tasksForClient = allTasks.filter(
                (t) => Number(t.clientId) === Number(row.clientId)
              );

              setSelectedClientTasks(tasksForClient);
              setSelectedClientName(getClientName(row.clientId));
              setSelectedClientId(row.clientId); // ✅ REQUIRED FOR VIEW CLIENT BUTTON
              setOpenClientTasks(true);
            }}

          >
            All Tasks
          </Button>

          {/* ✅ EDIT */}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openDrawer("assignTask", {
                taskId: row.id,
                taskType: row.taskType,
              })
            }
          >
            Edit
          </Button>

          {/* ✅ DELETE */}
          {/* ✅ DELETE - Only for manual Assigned tasks */}
          {row.taskType === "ASSIGNED" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                if (!confirm("Delete this task?")) return;

                const res = await fetch("/api/tasks/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    task_id: row.id,
                  }),
                });

                if (res.ok) {
                  toast({ title: "Task deleted" });
                  mutate(["tasks"]);
                } else {
                  toast({
                    title: "Failed to delete task",
                    variant: "destructive",
                  });
                }
              }}
            >
              Delete
            </Button>
          ) : (
            // For Onboarding/Subtasks, we don't allow delete here (must be done in Stages)
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground opacity-50 cursor-not-allowed"
              title="Manage in Stages"
            >
              Locked
            </Button>
          )}

        </div>
      ),
    },
  ];



  // ✅ APPLY SEARCH FILTER
  const filteredTasks = allTasks.filter((task: any) => {
    // SEARCH (already includes client name)
    if (q) {
      const search = q.toLowerCase();
      const match =
        task.title?.toLowerCase().includes(search) ||
        task.status?.toLowerCase().includes(search) ||
        getClientName(task.clientId)?.toLowerCase().includes(search);

      if (!match) return false;
    }

    // TASK TYPE
    if (filterTaskType !== "ALL" && task.taskType !== filterTaskType) {
      return false;
    }

    // ASSIGNED USER
    if (
      filterAssignedRole !== "ALL" &&
      task.assignedRole !== filterAssignedRole
    ) {
      return false;
    }

    // DUE DATE
    if (filterDue === "WITH_DUE" && !task.dueDate) {
      return false;
    }

    if (filterDue === "OVERDUE") {
      if (!task.dueDate) return false;
      if (new Date(task.dueDate) >= new Date()) return false;
    }

    if (filterDue === "CUSTOM") {
      if (!task.dueDate) return false;

      const taskDue = new Date(task.dueDate);

      const fromDate = dueFrom ? new Date(dueFrom) : null;
      const toDate = dueTo ? new Date(dueTo) : null;

      // ✅ make TO date inclusive
      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
      }

      if (fromDate && taskDue < fromDate) return false;
      if (toDate && taskDue > toDate) return false;
    }

    // STATUS FILTER
    if (filterStatus === "IN_PROGRESS") {
      // Show only tasks with "In Progress" status
      if (task.status !== "In Progress") return false;
    }
    if (filterStatus === "NOT_STARTED") {
      if (task.status !== "Not Started") return false;
    }
    if (filterStatus === "COMPLETED") {
      if (task.status !== "Completed") return false;
    }

    return true;
  });

  // const filteredTasks = allTasks.filter((task) => {
  //   if (!q) return true;

  //   const search = q.toLowerCase();

  //   return (
  //     task.title?.toLowerCase().includes(search) ||
  //     task.status?.toLowerCase().includes(search) ||
  //     getClientName(task.clientId)?.toLowerCase().includes(search)
  //   );
  // });

  // ✅ PAGINATION AFTER FILTER
  const total = filteredTasks.length;

  const rows = filteredTasks.slice(
    (page - 1) * pageSize,
    page * pageSize
  );


  // MATERIAL STYLE COUNTER
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="grid gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <Button onClick={() => openDrawer("assignTask", {})}>
          Assign Task
        </Button>
      </div>

      {/* SEARCH */}
      {/* <TableToolbar q={q} setQ={setQ} /> */}
      {/* SEARCH + FILTERS */}
      <div className="flex flex-wrap items-center gap-3">
        {/* SEARCH */}
        <TableToolbar q={q} setQ={setQ} />

        {/* TASK TYPE */}
        <Select
          value={filterTaskType}
          onValueChange={(v) => {
            setFilterTaskType(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Task Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
          </SelectContent>
        </Select>

        {/* ASSIGNED USER */}
        <Select
          value={filterAssignedRole}
          onValueChange={(v) => {
            setFilterAssignedRole(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Assigned User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Users</SelectItem>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="SERVICE_CENTER">Service Center</SelectItem>
            <SelectItem value="CPA">Preparer</SelectItem>
          </SelectContent>
        </Select>

        {/* DUE DATE FILTER */}
        <Select
          value={filterDue}
          onValueChange={(v) => {
            setFilterDue(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Due Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Due Dates</SelectItem>
            <SelectItem value="WITH_DUE">With Due Date</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="CUSTOM">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        {/* STATUS FILTER */}
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setFilterStatus(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="NOT_STARTED">Not Started</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* CUSTOM DATE RANGE */}
        {filterDue === "CUSTOM" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={dueFrom ?? ""}
              onChange={(e) => {
                setDueFrom(e.target.value || null);
                setPage(1);
              }}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={dueTo ?? ""}
              onChange={(e) => {
                setDueTo(e.target.value || null);
                setPage(1);
              }}
            />
          </div>
        )}

        {/* OVERDUE COUNT BADGE */}
        {(() => {
          const overdueCount = allTasks.filter((t) => {
            if (!t.dueDate || t.status === "Completed") return false;
            const dueDate = new Date(t.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return dueDate < today;
          }).length;
          return overdueCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              {overdueCount} overdue
            </div>
          ) : null;
        })()}

        {/* CLEAR */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFilterTaskType("ALL");
            setFilterAssignedRole("ALL");
            setFilterDue("ALL");
            setFilterStatus("ALL");
            setDueFrom(null);
            setDueTo(null);
            setQ("");
            setPage(1);
          }}
        >
          Clear Filters
        </Button>
      </div>

      {/* TABLE */}
      <DataTable
        columns={cols}
        rows={rows}
      />

      {/* MATERIAL STYLE PAGINATION BAR */}
      <div className="flex items-center justify-between text-sm text-muted-foreground py-3 px-1 border-t">

        {/* ITEMS PER PAGE DROPDOWN */}
        <div className="flex items-center gap-2">
          <span>Items per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              const newSize = Number(val);
              setPageSize(newSize);
              localStorage.setItem("adminTasksPageSize", String(newSize));
              setPage(1); // reset to page 1
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
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* COUNT DISPLAY */}
        <div>
          {start}–{end} of {total} items
        </div>
      </div>

      {/* BOTTOM PAGINATION BUTTONS */}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        setPage={setPage}
      />
      <ClientTaskModal
        open={openClientTasks}
        onClose={() => setOpenClientTasks(false)}
        clientName={selectedClientName}
        clientId={selectedClientId}   // ✅ PASS CLIENT ID
        tasks={selectedClientTasks}
      />

      {/* Task Completion Modal - requires document upload */}
      {pendingTask && (
        <TaskCompleteModal
          open={completeModalOpen}
          onClose={() => {
            setCompleteModalOpen(false);
            setPendingTask(null);
          }}
          onComplete={async () => {
            if (!pendingTask) return;

            // Update task status to Completed after document upload
            if (pendingTask.taskType === "ONBOARDING") {
              await fetch("/api/stages/subtask/update-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subtaskId: pendingTask.id,
                  status: "Completed",
                }),
              });
            } else {
              await fetch("/api/tasks/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  taskId: pendingTask.id,
                  status: "Completed",
                }),
              });
            }

            mutate(["tasks"]); // ✅ refresh table
            toast({
              title: "Task Completed",
              description: `Task "${pendingTask.title}" has been marked as complete.`,
            });
            setPendingTask(null);
          }}
          taskTitle={pendingTask.title}
          taskId={pendingTask.id}
          clientId={String(pendingTask.clientId)}
          clientName={pendingTask.clientName}
          taskType={pendingTask.taskType.toLowerCase() as "assigned" | "onboarding"}
        />
      )}
    </div>
  );
}