// app/admin/clients/page.tsx
"use client";

import useSWR, { mutate } from "swr";
import { fetchClients } from "@/lib/api";
import {
  DataTable,
  type Column,
  TableToolbar,
  TablePagination,
  useServerTableState,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { StatusPill } from "@/components/widgets/status-pill";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { Badge } from "@/components/ui/badge";
import type { ClientProfile } from "@/types";
import { Archive, ArchiveRestore } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminClientsList() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState();
  const [clientPageSize, setClientPageSize] = useState(5);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Read status filter from URL, default to "ALL"
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Load persisted page size on mount
  useEffect(() => {
    const savedSize = localStorage.getItem("adminClientsPageSize");
    if (savedSize) {
      setClientPageSize(Number(savedSize));
    }
  }, []);

  // Archive filter tab: "ALL" = all clients, "active" = only active, "archived" = only archived
  const [archiveFilter, setArchiveFilter] = useState<string>("ALL");

  // Archive confirmation state
  const [clientToArchive, setClientToArchive] = useState<ClientProfile | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  // Initialize filter from URL on mount
  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (urlStatus) {
      // Map URL param to filter value
      if (urlStatus === "active" || urlStatus === "In Progress") {
        setStatusFilter("In Progress");
      } else if (urlStatus === "completed" || urlStatus === "Completed") {
        setStatusFilter("Completed");
      } else if (urlStatus === "not-started" || urlStatus === "Not Started") {
        setStatusFilter("Not Started");
      }
    }
  }, [searchParams]);

  const router = useRouter();
  const openDrawer = useUIStore((s) => s.openDrawer);
  const handleRowClick = (row: ClientProfile, e: React.MouseEvent) => {
    // 1) If user is selecting text (copying), do NOT navigate
    const selection = window.getSelection?.()?.toString();
    if (selection && selection.trim().length > 0) return;

    // 2) If click came from an interactive element, do NOT navigate
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, a, input, textarea, select, [role="button"], [data-no-row-click="true"]'
      )
    ) {
      return;
    }

    // 3) Navigate to client details
    router.push(`/admin/clients/${row.client_id}`);
  };

  // ---------- FETCH CLIENTS (with server-side search, status filter, and archive filter) ----------
  const { data } = useSWR(
    ["clients", page, clientPageSize, q, statusFilter, archiveFilter],
    () => fetchClients({ page, pageSize: clientPageSize, q, status: statusFilter, archiveFilter }),
    { keepPreviousData: true }
  );

  // Client data is already filtered and paginated by the server
  const clientRows: ClientProfile[] = data?.data || [];

  // Use the server's total count for proper pagination
  const serverTotal = data?.total ?? 0;

  // ---- Client Pagination Calculations ----
  const clientTotalItems = serverTotal;
  const clientTotalPages = Math.ceil(clientTotalItems / clientPageSize);
  const clientStart = clientTotalItems > 0 ? (page - 1) * clientPageSize + 1 : 0;
  const clientEnd = Math.min(page * clientPageSize, clientTotalItems);

  // Rows are already paginated by the server
  const paginatedRows = clientRows;

  // ---------- ARCHIVE/UNARCHIVE HANDLER ----------
  const handleArchiveClient = async (client: ClientProfile, archive: boolean) => {
    try {
      const res = await fetch("/api/clients/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.client_id,
          archive,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: archive ? "Client Archived" : "Client Restored",
          description: json.message,
        });
        // Refresh the clients list
        mutate(["clients", page, clientPageSize, q, statusFilter, archiveFilter]);
      } else {
        toast({
          title: "Error",
          description: json.error || "Failed to update client status",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  // ---------- TABLE COLUMNS ----------
  const cols: Column<ClientProfile>[] = [
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

    { key: "stage_name", header: "Current Stage" },

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
      header: "Current Status",
      render: (row) => <StatusPill status={row.status || "Not Started"} />,
    },

    // ✅ NEW: Archive Status Column
    {
      key: "is_archived",
      header: "Status",
      render: (row) => (
        <Badge
          variant={row.is_archived ? "secondary" : "default"}
          className={row.is_archived
            ? "bg-gray-100 text-gray-600 border-gray-300"
            : "bg-green-50 text-green-700 border-green-300"
          }
        >
          {row.is_archived ? "Inactive" : "Active"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      {/* ---------- PAGE HEADER ---------- */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>

        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/admin/clients/new")}>
            New Client
          </Button>
        </div>
      </div>

      {/* ---------- ARCHIVE TABS ---------- */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => {
            setArchiveFilter("ALL");
            setPage(1);
          }}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${archiveFilter === "ALL"
            ? "text-gray-900"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          All Clients
          {archiveFilter === "ALL" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => {
            setArchiveFilter("active");
            setPage(1);
          }}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${archiveFilter === "active"
            ? "text-gray-900"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          Active Clients
          {archiveFilter === "active" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => {
            setArchiveFilter("archived");
            setPage(1);
          }}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${archiveFilter === "archived"
            ? "text-gray-900"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          Archived Clients
          {archiveFilter === "archived" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-t-full" />
          )}
        </button>
      </div>

      {/* ---------- SEARCH & FILTERS ---------- */}
      <div className="flex flex-wrap items-center gap-3">
        <TableToolbar q={q} setQ={setQ} setPage={setPage} />

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {statusFilter !== "ALL" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* ---------- CLIENTS TABLE ---------- */}
      <DataTable
        columns={cols}
        rows={paginatedRows}
        onRowClick={handleRowClick}
        onRowAction={(row: ClientProfile) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              data-no-row-click="true"
              onClick={() => router.push(`/admin/clients/${row.client_id}`)}
            >
              Open
            </Button>

            {/* Archive/Restore Button */}
            {row.is_archived ? (
              <Button
                size="sm"
                variant="outline"
                data-no-row-click="true"
                onClick={() => handleArchiveClient(row, false)}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <ArchiveRestore className="h-4 w-4 mr-1" />
                Restore
              </Button>
            ) : (

              <Button
                size="sm"
                variant="outline"
                data-no-row-click="true"
                onClick={() => {
                  setClientToArchive(row);
                  setIsArchiveDialogOpen(true);
                }}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
            )}
          </div>
        )
        }
      />

      {/* ---------- PAGINATION ---------- */}
      <div className="flex items-center justify-between px-2 py-3 text-sm">

        {/* LEFT SIDE — ITEMS PER PAGE */}
        <div className="flex items-center gap-2">
          <span>Items per page</span>

          <select
            className="border rounded px-2 py-1"
            value={clientPageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              setClientPageSize(newSize);
              localStorage.setItem("adminClientsPageSize", String(newSize));
              setPage(1); // Reset to page 1 on size change
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <span>
            {clientStart}–{clientEnd} of {clientTotalItems} items
          </span>
        </div>

        {/* RIGHT SIDE — PREV / NEXT (existing pagination) */}
        <TablePagination
          page={page}
          pageSize={clientPageSize}
          total={clientTotalItems}
          setPage={setPage}
        />
      </div>

      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to archive this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move <strong>{clientToArchive?.client_name}</strong> to the Archived Clients list.
              They will no longer appear in the active list, but data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClientToArchive(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => {
                if (clientToArchive) {
                  handleArchiveClient(clientToArchive, true);
                  setClientToArchive(null);
                }
              }}
            >
              Archive Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div >
  );
}
