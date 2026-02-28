"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Icons
import {
  Download, Filter, Calendar as CalendarIcon,
  User as UserIcon, Building2, Layers,
  CheckCircle2, Clock, XCircle, AlertCircle,
  FileBarChart, FileText
} from "lucide-react";

export default function ReportsPage() {
  // ---------------------------- FILTER STATES ----------------------------
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    serviceCenter: "all",
    cpa: "all",
    stage: "all",
    status: "all",
  });

  const [reportData, setReportData] = useState<any[]>([]);
  const [serviceCenters, setServiceCenters] = useState<any[]>([]);
  const [cpas, setCPAs] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Summary data
  const [taskSummary, setTaskSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    inreview: 0,
  });

  const [stageSummary, setStageSummary] = useState<any>({});
  const [documentSummary, setDocumentSummary] = useState<any>({});

  const { toast } = useToast();

  // ---------------------------- FETCH MULTIPLE MASTER LISTS ----------------------------
  async function loadMasterFilters() {
    try {
      const [scRes, cpaRes, stageRes] = await Promise.all([
        fetch("/api/service-centers/get"),
        fetch("/api/cpas/get"),
        fetch("/api/stages/list"),
      ]);

      const sc = await scRes.json();
      const cp = await cpaRes.json();
      const st = await stageRes.json();

      setServiceCenters(sc.data || []);
      setCPAs(cp.data || []);
      setStages(st.data || []);
    } catch (err) {
      console.error("Failed to load filters", err);
    }
  }

  // ---------------------------- FETCH REPORT DATA ----------------------------
  async function fetchReports() {
    setIsLoading(true);
    try {
      const body = {
        fromDate: filters.fromDate || null,
        toDate: filters.toDate || null,
        serviceCenter:
          filters.serviceCenter === "all" ? null : Number(filters.serviceCenter),
        cpa: filters.cpa === "all" ? null : Number(filters.cpa),
        stage: filters.stage === "all" ? null : Number(filters.stage),
        status: filters.status === "all" ? null : filters.status,
      };

      const res = await fetch("/api/reports/get", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        console.error("Report fetch error:", data.error);
        return;
      }

      setReportData(data.clients || []);

      // ---------------- SUMMARY: STAGE COUNT ----------------
      const stageCount: any = {};
      (data.clients || []).forEach((c: any) => {
        const sName = c.stage_name || "No Stage";
        stageCount[sName] = (stageCount[sName] || 0) + 1;
      });
      setStageSummary(stageCount);

      // ---------------- SUMMARY: TASK STATUS ----------------
      let pending = 0,
        approved = 0,
        rejected = 0,
        inreview = 0;

      (data.clients || []).forEach((c: any) => {
        pending += c.pending_tasks || 0;
        approved += c.approved_tasks || 0;
        rejected += c.rejected_tasks || 0;
        inreview += c.inreview_tasks || 0;
      });

      setTaskSummary({ pending, approved, rejected, inreview });

      // ---------------- SUMMARY: DOCUMENTS (NEED REAL TABLE NEXT) ----------------
      // Kept static as per original file, can be dynamic later
      setDocumentSummary({
        uploaded: 7,
        reviewed: 8,
        approved: 8,
        needsFix: 7,
      });

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  // Load master lists once
  useEffect(() => {
    loadMasterFilters();
  }, []);

  // Fetch report whenever filters change
  useEffect(() => {
    fetchReports();
  }, [filters]);

  // ---------------------------- EXPORT CSV ----------------------------
  function handleExportCSV() {
    const csv = [
      ["Client", "Stage", "Progress", "Status", "Pending Tasks", "Approved Tasks"],
      ...reportData.map((r) => [
        r.client_name,
        r.stage_name,
        r.progress + "%",
        r.client_status,
        r.pending_tasks,
        r.approved_tasks
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exported", description: "CSV file downloaded successfully" });
  }

  // ---------------------------- UI HELPERS ----------------------------
  const getStatusBadgeVariant = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "active": return "default"; // black/primary
      case "completed": return "success"; // we might not have success variant, use default or outline
      case "in progress": return "secondary";
      case "not started": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">
            Track client progress, task status, and overall performance.
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* FILTERS CARD */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Filter Reports</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* DATE FROM */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> From Date
              </label>
              <Input
                type="date"
                className="h-9"
                value={filters.fromDate}
                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              />
            </div>

            {/* DATE TO */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> To Date
              </label>
              <Input
                type="date"
                className="h-9"
                value={filters.toDate}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              />
            </div>

            {/* SERVICE CENTER/ CPA / STATUS */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Service Center
              </label>
              <Select
                value={filters.serviceCenter}
                onValueChange={(v) => setFilters({ ...filters, serviceCenter: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Centers</SelectItem>
                  {serviceCenters.map((sc) => (
                    <SelectItem key={sc.service_center_id} value={String(sc.service_center_id)}>
                      {sc.center_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <UserIcon className="h-3 w-3" /> Preparer
              </label>
              <Select
                value={filters.cpa}
                onValueChange={(v) => setFilters({ ...filters, cpa: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Preparers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Preparers</SelectItem>
                  {cpas.map((c) => (
                    <SelectItem key={c.cpa_id} value={String(c.cpa_id)}>
                      {c.cpa_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters({ ...filters, status: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SUMMARY CARDS SECTION */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* CLIENTS BY STAGE */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" /> Clients by Onboarding Stage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-2 mt-2">
              {Object.keys(stageSummary).length === 0 && (
                <div className="text-sm text-muted-foreground italic">No data available</div>
              )}
              {Object.entries(stageSummary).map(([stage, count]: [string, unknown]) => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[180px]" title={stage}>{stage}</span>
                  <Badge variant="secondary" className="font-mono">{String(count)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* TASK STATUS */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Overall Task Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3 mt-2">
              <div className="flex justify-between text-sm">
                < span className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" /> Pending
                </span>
                <span className="font-bold">{taskSummary.pending}</span>
              </div>
              <div className="flex justify-between text-sm">
                < span className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" /> In Review
                </span>
                <span className="font-bold">{taskSummary.inreview}</span>
              </div>
              <div className="flex justify-between text-sm">
                < span className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" /> Approved
                </span>
                <span className="font-bold">{taskSummary.approved}</span>
              </div>
              <div className="flex justify-between text-sm">
                < span className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" /> Rejected
                </span>
                <span className="font-bold">{taskSummary.rejected}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DOCUMENTS STATUS */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" /> Document Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uploaded</span>
                <span className="font-medium">{documentSummary.uploaded}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reviewed</span>
                <span className="font-medium">{documentSummary.reviewed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Approved</span>
                <span className="font-medium">{documentSummary.approved}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Needs Fix</span>
                <span className="font-medium text-destructive">{documentSummary.needsFix}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CLIENT REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Client Report</CardTitle>
          <CardDescription>
            Viewing {reportData.length} records based on current filters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead className="w-[150px]">Completion</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Loading report data...
                    </TableCell>
                  </TableRow>
                ) : reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No clients found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((c) => (
                    <TableRow key={c.client_id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{c.client_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.stage_name || <span className="italic opacity-50">No Stage</span>}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={c.progress} className="h-2 w-[80px]" />
                          <span className="text-xs font-medium w-8 text-right">{c.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          c.client_status === "Active" ? "bg-green-50 text-green-700 border-green-200" : ""
                        }>
                          {c.client_status || "Unknown"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
