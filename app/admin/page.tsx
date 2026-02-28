// app/admin/page.tsx
"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  UserCheck,
  ListChecks,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { DataTable, type Column } from "@/components/data-table";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { StatusPill } from "@/components/widgets/status-pill";
import { fetchClients, fetchAllTasks, fetchDocuments } from "@/lib/api";



import type { ClientProfile, Task, DocumentFile } from "@/types";
import { useState, useMemo } from "react";
import { ClientTaskModal } from "@/components/widgets/client-task-modal";

// Shape returned by fetchClients()
type ClientsResponse = {
  data: ClientProfile[];
  total?: number;
};

// Shape returned by fetchTasks()
type TasksResponse = {
  data: Task[];
};

// We will extend Task with client_name for the table
type TaskRowWithClientName = Task & { client_name: string };

export default function AdminDashboard() {
  const router = useRouter();

  // ✅ SEARCH STATES (MUST BE INSIDE COMPONENT)
  const [clientSearch, setClientSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [openClientTasks, setOpenClientTasks] = useState(false);
  const [selectedClientTasks, setSelectedClientTasks] = useState<any[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);


  // ---------- DATA FETCHING ----------

  // 1. Clients (Load ALL for clients kpi + progress chart)
  const { data: clients } = useSWR<ClientsResponse>(
    ["clients"],
    () => fetchClients({ page: 1, pageSize: 500 })
  );

  // 2. Tasks (Load ALL for tasks kpi + chart)
  const { data: tasks } = useSWR<TasksResponse>(
    ["dashboard-tasks"],
    () => fetchAllTasks({ page: 1, pageSize: 500 })
  );

  // 3. Documents
  const { data: docs } = useSWR<DocumentFile[]>(
    ["docs"],
    () => fetchDocuments({ clientId: "" })
  );

  const clientRows: ClientProfile[] = clients?.data ?? [];
  const taskRows: Task[] = tasks?.data ?? [];
  const docRows: DocumentFile[] = docs ?? [];

  // ---------- PAGINATION STATE ----------

  // Clients pagination
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(5);

  // Tasks pagination
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(5);


  // ---------- DATA PROCESSING: CLIENTS ----------
  // ✅ FILTERED CLIENTS (SEARCH)
  const filteredClients = useMemo(() => {
    return clientRows.filter((c) =>
      c.client_name?.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clientRows, clientSearch]);

  // ✅ PAGINATED CLIENTS
  const paginatedClients = filteredClients.slice(
    (clientPage - 1) * clientPageSize,
    clientPage * clientPageSize
  );

  const clientTotalPages = Math.ceil(filteredClients.length / clientPageSize);
  const clientStart = filteredClients.length
    ? (clientPage - 1) * clientPageSize + 1
    : 0;
  const clientEnd = Math.min(clientPage * clientPageSize, filteredClients.length);


  // ---------- DATA PROCESSING: TASKS ----------
  // Build Client Map
  const clientNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    clientRows.forEach((c) => {
      if (c.client_id != null) map[c.client_id] = c.client_name;
    });
    return map;
  }, [clientRows]);

  // Extend tasks with client names
  const tasksWithClientNames = useMemo(() => {
    return taskRows.map((t) => {
      const anyTask = t as any;
      const clientId =
        typeof anyTask.client_id !== "undefined"
          ? anyTask.client_id
          : anyTask.clientId;

      return {
        ...t,
        client_name:
          (clientId != null ? clientNameMap[clientId] : undefined) || "Unknown",
      } as TaskRowWithClientName;
    });
  }, [taskRows, clientNameMap]);

  // ✅ FILTERED TASKS
  const filteredTasks = useMemo(() => {
    return tasksWithClientNames.filter((t) => {
      const term = taskSearch.toLowerCase();
      return (
        t.title?.toLowerCase().includes(term) ||
        t.client_name?.toLowerCase().includes(term)
      );
    });
  }, [tasksWithClientNames, taskSearch]);

  // ✅ PAGINATED TASKS
  const paginatedTasks = filteredTasks.slice(
    (taskPage - 1) * taskPageSize,
    taskPage * taskPageSize
  );

  const taskTotalPages = Math.ceil(filteredTasks.length / taskPageSize);
  const taskStart = filteredTasks.length
    ? (taskPage - 1) * taskPageSize + 1
    : 0;
  const taskEnd = Math.min(taskPage * taskPageSize, filteredTasks.length);


  // ---------- KPI VALUES ----------

  const totalClients = clients?.total ?? clientRows.length;

  // Active Onboarding: Clients with status "In Progress" (case-insensitive)
  const activeOnboarding = clientRows.filter((c) => {
    const status = (c.status || "").toLowerCase();
    return status === "in progress" || status === "active";
  }).length;

  // Tasks In Progress: Only tasks with "In Progress" status
  const inProgressTasks = taskRows.filter((t) => {
    const status = (t.status || "").toLowerCase();
    return status === "in progress";
  }).length;

  // Overdue Tasks: Tasks past due date that aren't completed/approved
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today for accurate comparison

  const overdueTasks = taskRows.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    due.setHours(23, 59, 59, 999); // End of due date
    const status = (t.status || "").toLowerCase();
    return due < today && status !== "approved" && status !== "completed";
  }).length;


  // Note: Chart data is now computed inline in the render for better clarity


  // ---------- KPIS CONFIG ----------
  const kpis = [
    {
      label: "Total Clients",
      value: totalClients,
      icon: Users,
      color: "text-blue-500",
      helper: "All registered clients",
      onClick: () => router.push("/admin/clients"),
    },
    {
      label: "Active Onboarding",
      value: activeOnboarding,
      icon: UserCheck,
      color: "text-emerald-500",
      helper: "Clients with onboarding in progress",
      onClick: () => router.push("/admin/clients?status=active"),
    },
    {
      label: "Tasks In Progress",
      value: inProgressTasks,
      icon: ListChecks,
      color: "text-amber-500",
      helper: "Active tasks requiring action",
      onClick: () => router.push("/admin/tasks?status=in-progress"),
    },
    {
      label: "Overdue Tasks",
      value: overdueTasks,
      icon: Clock,
      color: "text-red-500",
      helper: "Past due date, needs attention",
      onClick: () => router.push("/admin/tasks?filter=overdue"),
    },
  ];


  // ---------- TABLE COLUMNS ----------
  const clientCols: Column<ClientProfile>[] = [
    { key: "client_name", header: "Client" },

    // ✅ SERVICE CENTER: show "Not Assigned" if missing
    {
      key: "service_center_name",
      header: "Service Center",
      render: (row) => {
        const name = (row.service_center_name ?? "").toString().trim();
        return name.length > 0 ? name : "Not Assigned";
      },
    },

    // ✅ CPA: show "Not Assigned" if missing
    {
      key: "cpa_name",
      header: "Preparer",
      render: (row) => {
        const name = (row.cpa_name ?? "").toString().trim();
        return name.length > 0 ? name : "Not Assigned";
      },
    },

    { key: "stage_name", header: "Stage" },

    {
      key: "progress",
      header: "Progress",
      render: (row) => (
        <div className="flex items-center gap-2">
          <ProgressRing
            value={row.progress ?? 0}
            completedStages={row.completed_stages}
            totalStages={row.total_stages}
          />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status || "Not Started"} />,
    },
  ];

  const taskCols: Column<TaskRowWithClientName>[] = [
    { key: "client_name", header: "Client" },
    { key: "title", header: "Title" },
    { key: "assigneeRole", header: "Assigned User" },
    {
      key: "dueDate",
      header: "Due",
      render: (r) => {
        if (!r.dueDate) return <span className="text-muted-foreground">-</span>;
        const dueDate = new Date(r.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const status = (r.status || "").toLowerCase();
        const isOverdue = dueDate < today && status !== "completed" && status !== "approved";
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
      render: (r) => <StatusPill status={r.status} />,
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* ---------- HEADER ---------- */}
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>

        {/* ---------- KPI CARDS ---------- */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card
              key={k.label}
              className="cursor-pointer border border-slate-200/70 shadow-sm transition hover:shadow-md"
              onClick={k.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{k.label}</CardTitle>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{k.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{k.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ---------- CHARTS ---------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Client Onboarding Progress - Donut Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <UserCheck className="h-3.5 w-3.5 text-white" />
                </div>
                Client Onboarding Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientRows.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No clients available
                </div>
              ) : (
                (() => {
                  // Group clients by completion percentage
                  const groups = [
                    { label: "Not Started", range: [0, 0], color: "#9ca3af" },
                    { label: "Early (1-25%)", range: [1, 25], color: "#f59e0b" },
                    { label: "Mid (26-50%)", range: [26, 50], color: "#3b82f6" },
                    { label: "Advanced (51-75%)", range: [51, 75], color: "#8b5cf6" },
                    { label: "Near Done (76-99%)", range: [76, 99], color: "#10b981" },
                    { label: "Completed", range: [100, 100], color: "#059669" },
                  ];

                  const chartData = groups.map(group => {
                    const count = clientRows.filter(c => {
                      const progress = c.progress ?? 0;
                      if (group.range[0] === 0 && group.range[1] === 0) return progress === 0;
                      return progress >= group.range[0] && progress <= group.range[1];
                    }).length;
                    return { name: group.label, value: count, color: group.color };
                  }).filter(d => d.value > 0);

                  const totalClients = clientRows.length;
                  const avgProgress = Math.round(
                    clientRows.reduce((sum, c) => sum + (c.progress ?? 0), 0) / totalClients
                  );
                  const completedCount = clientRows.filter(c => (c.progress ?? 0) === 100).length;

                  return (
                    <div className="flex items-center gap-4">
                      {/* Donut Chart */}
                      <div className="w-40 h-40 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={35}
                              outerRadius={60}
                              paddingAngle={2}
                              dataKey="value"
                              nameKey="name"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              wrapperStyle={{ zIndex: 100 }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
                                      <span className="font-semibold">{data.name}</span>
                                      <span>: {data.value} clients</span>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center text - moved pointer-events to none so tooltip works */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-bold text-gray-800">{avgProgress}%</span>
                          <span className="text-xs text-muted-foreground">avg</span>
                        </div>
                      </div>

                      {/* Legend & Stats */}
                      <div className="flex-1 space-y-2">
                        {chartData.slice(0, 4).map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-gray-600">{item.name}</span>
                            </div>
                            <span className="font-semibold">{item.value}</span>
                          </div>
                        ))}
                        <div className="pt-2 mt-2 border-t grid grid-cols-2 gap-2 text-center">
                          <div>
                            <div className="text-lg font-bold text-blue-600">{totalClients}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-green-600">{completedCount}</div>
                            <div className="text-xs text-muted-foreground">Done</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Task Status Overview - Donut Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <ListChecks className="h-3.5 w-3.5 text-white" />
                </div>
                Task Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taskRows.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No tasks available
                </div>
              ) : (
                (() => {
                  const statusConfig = [
                    { status: "Pending", color: "#f59e0b" },
                    { status: "In Progress", color: "#3b82f6" },
                    { status: "In Review", color: "#8b5cf6" },
                    { status: "Completed", color: "#10b981" },
                    { status: "Approved", color: "#059669" },
                  ];

                  const chartData = statusConfig.map(item => ({
                    name: item.status,
                    value: taskRows.filter(t => (t.status || "Pending") === item.status).length,
                    color: item.color
                  })).filter(d => d.value > 0);

                  const doneCount = taskRows.filter(t => t.status === "Completed" || t.status === "Approved").length;
                  const donePercentage = Math.round((doneCount / taskRows.length) * 100);

                  return (
                    <div className="flex items-center gap-4">
                      {/* Donut Chart */}
                      <div className="w-40 h-40 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={35}
                              outerRadius={60}
                              paddingAngle={2}
                              dataKey="value"
                              nameKey="name"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              wrapperStyle={{ zIndex: 100 }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
                                      <span className="font-semibold">{data.name}</span>
                                      <span>: {data.value} tasks</span>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center text - pointer-events-none so tooltip works */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-bold text-gray-800">{donePercentage}%</span>
                          <span className="text-xs text-muted-foreground">done</span>
                        </div>
                      </div>

                      {/* Legend & Stats */}
                      <div className="flex-1 space-y-2">
                        {chartData.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-gray-600">{item.name}</span>
                            </div>
                            <span className="font-semibold">{item.value}</span>
                          </div>
                        ))}
                        <div className="pt-2 mt-2 border-t grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-lg font-bold text-amber-600">{taskRows.length}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-red-600">{overdueTasks}</div>
                            <div className="text-xs text-muted-foreground">Overdue</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-green-600">{doneCount}</div>
                            <div className="text-xs text-muted-foreground">Done</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---------- CLIENTS TABLE ---------- */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Client List</CardTitle>
              <input
                type="text"
                placeholder="Search client..."
                className="border rounded px-3 py-1 text-sm w-64"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientPage(1);
                }}
              />
            </div>
          </CardHeader>

          <CardContent>
            <DataTable
              columns={clientCols}
              rows={paginatedClients}
              onRowAction={(row: ClientProfile) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/admin/clients/${row.client_id}`);
                  }}
                >
                  Open
                </Button>
              )}
              onRowClick={(row: ClientProfile) =>
                router.push(`/admin/clients/${row.client_id}`)
              }
            />
            {/* Pagination Controls */}
            <PaginationControls
              page={clientPage}
              pageSize={clientPageSize}
              total={filteredClients.length}
              start={clientStart}
              end={clientEnd}
              onPageChange={setClientPage}
              onPageSizeChange={(s: number) => { setClientPageSize(s); setClientPage(1); }}
              totalPages={clientTotalPages}
            />
          </CardContent>
        </Card>

        {/* ---------- OUTSTANDING TASKS TABLE ---------- */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <CardTitle>Outstanding Tasks</CardTitle>
            <input
              type="text"
              placeholder="Search task or client..."
              className="border rounded px-3 py-1 text-sm w-64"
              value={taskSearch}
              onChange={(e) => {
                setTaskSearch(e.target.value);
                setTaskPage(1);
              }}
            />
          </CardHeader>

          <CardContent>
            <DataTable
              columns={taskCols}
              rows={paginatedTasks}
              onRowAction={(row: any) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const tasksForClient = tasksWithClientNames.filter(
                      (t: any) =>
                        Number(t.client_id ?? t.clientId) ===
                        Number(row.client_id ?? row.clientId)
                    );
                    setSelectedClientTasks(tasksForClient);
                    setSelectedClientName(row.client_name);
                    setSelectedClientId(row.client_id ?? row.clientId);
                    setOpenClientTasks(true);
                  }}
                >
                  All Tasks
                </Button>
              )}
            />
            {/* Pagination Controls */}
            <PaginationControls
              page={taskPage}
              pageSize={taskPageSize}
              total={filteredTasks.length}
              start={taskStart}
              end={taskEnd}
              onPageChange={setTaskPage}
              onPageSizeChange={(s: number) => { setTaskPageSize(s); setTaskPage(1); }}
              totalPages={taskTotalPages}
            />
          </CardContent>
        </Card>
      </div>

      <ClientTaskModal
        open={openClientTasks}
        onClose={() => setOpenClientTasks(false)}
        clientName={selectedClientName}
        clientId={selectedClientId}
        tasks={selectedClientTasks}
      />
    </>
  );
}

// Helper for Pagination to reduce code duplication
interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalPages: number;
}

function PaginationControls({
  page, pageSize, total, start, end, onPageChange, onPageSizeChange, totalPages
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-2 text-sm">
        <span>Items per page:</span>
        <select
          className="border rounded px-2 py-1"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[5, 10, 20, 50, 100].map((s: number) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>
          {start}–{end} of {total} items
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          disabled={page === totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
