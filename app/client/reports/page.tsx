// app/client/reports/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { fetchClientTasksByClientId } from "@/lib/api";
import {
  BarChart2,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  TrendingUp,
  Calendar,
  ArrowRight,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Types
type StageItem = {
  client_stage_id: number;
  stage_name: string;
  order_number: number;
  status: string;
};

export default function ClientReports() {
  const router = useRouter();
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);

  const [clientId, setClientId] = useState<string | null>(null);

  // Wait for client context
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId);
    }
  }, [role, currentClientId]);

  // Fetch client data
  const { data: client } = useSWR(
    clientId ? ["client-reports-data", clientId] : null,
    async () => {
      const res = await fetch(`/api/clients/${clientId}/get`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    }
  );

  // Fetch stages
  const { data: stageData } = useSWR(
    clientId ? ["client-reports-stages", clientId] : null,
    async () => {
      const res = await fetch(`/api/stages/client/get?clientId=${clientId}`);
      if (!res.ok) return { data: [], subtasks: [] };
      return res.json();
    }
  );

  const stages: StageItem[] = stageData?.data || [];
  const subtasksFlat = stageData?.subtasks || [];

  // Map subtasks to stages
  const subtasksByStage = stages.map((stage) => ({
    ...stage,
    subtasks: subtasksFlat.filter(
      (s: any) => s.client_stage_id === stage.client_stage_id
    ),
  }));

  // Tasks
  const { data: tasksResponse } = useSWR(
    clientId ? ["client-reports-tasks", clientId] : null,
    () => fetchClientTasksByClientId(clientId!),
    { revalidateOnFocus: false }
  );

  const tasks = (tasksResponse?.data || []) as any[];

  // Documents
  const { data: docsResponse } = useSWR(
    clientId ? ["client-reports-docs", clientId] : null,
    async () => {
      const res = await fetch(`/api/documents/get-by-client?id=${clientId}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  const docs = (docsResponse?.data || []).filter(
    (d: any) => d.type === "file" && !d.name?.endsWith(".keep")
  );

  // Calculate stage progress
  const completedStagesCount = useMemo(() => {
    return subtasksByStage.filter((stage) => {
      const allSubtasksCompleted =
        stage.subtasks?.length > 0 &&
        stage.subtasks.every((st: any) => st.status === "Completed");
      return stage.status === "Completed" || allSubtasksCompleted;
    }).length;
  }, [subtasksByStage]);

  const inProgressStagesCount = useMemo(() => {
    return subtasksByStage.filter((stage) => stage.status === "In Progress").length;
  }, [subtasksByStage]);

  const progress =
    stages.length > 0
      ? Math.round((completedStagesCount / stages.length) * 100)
      : 0;

  // Task stats
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(
      (t) => t.status === "Completed" || t.status === "completed"
    ).length;
    const inProgress = tasks.filter(
      (t) => t.status === "In Progress" || t.status === "in progress"
    ).length;
    const notStarted = tasks.filter(
      (t) => t.status === "Not Started" || t.status === "not started"
    ).length;
    const overdue = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate < new Date() && t.status !== "Completed" && t.status !== "completed";
    }).length;

    return { total, completed, inProgress, notStarted, overdue };
  }, [tasks]);

  // Subtask stats
  const subtaskStats = useMemo(() => {
    const allSubtasks = subtasksFlat as any[];
    const total = allSubtasks.length;
    const completed = allSubtasks.filter((s) => s.status === "Completed").length;
    const inProgress = allSubtasks.filter((s) => s.status === "In Progress").length;
    const notStarted = allSubtasks.filter((s) => s.status === "Not Started" || !s.status).length;

    return { total, completed, inProgress, notStarted };
  }, [subtasksFlat]);

  // Document stats
  const docStats = useMemo(() => {
    return {
      total: docs.length,
      folders: (docsResponse?.data || []).filter((d: any) => d.type === "folder").length,
    };
  }, [docs, docsResponse]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            My Progress Report
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your onboarding progress, tasks, and documents.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={progress}
            completedStages={completedStagesCount}
            totalStages={stages.length}
          />
        </div>
      </div>

      {/* OVERALL PROGRESS CARD */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Overall Onboarding Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-bold text-2xl text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-4" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{completedStagesCount} of {stages.length} stages completed</span>
                <span>{stages.length - completedStagesCount} remaining</span>
              </div>
            </div>

            {/* Stage Timeline */}
            {stages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {stages
                  .sort((a, b) => a.order_number - b.order_number)
                  .map((stage, index) => {
                    const stageWithSubtasks = subtasksByStage.find(
                      (s) => s.client_stage_id === stage.client_stage_id
                    );
                    const allSubtasksCompleted =
                      stageWithSubtasks?.subtasks?.length > 0 &&
                      stageWithSubtasks?.subtasks?.every(
                        (st: any) => st.status === "Completed"
                      );
                    const isCompleted = stage.status === "Completed" || allSubtasksCompleted;
                    const isInProgress = stage.status === "In Progress";

                    return (
                      <span key={stage.client_stage_id} className="flex items-center">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isCompleted
                              ? "bg-green-100 border border-green-300 text-green-800 shadow-sm"
                              : isInProgress
                                ? "bg-blue-100 border border-blue-300 text-blue-800 shadow-sm animate-pulse"
                                : "bg-gray-100 border border-gray-300 text-gray-600"
                            }`}
                        >
                          {isCompleted && <CheckCircle2 className="inline-block mr-1 h-3 w-3" />}
                          {stage.stage_name}
                        </span>
                        {index < stages.length - 1 && (
                          <span className="mx-2 text-muted-foreground font-bold">→</span>
                        )}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* STATS CARDS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Stages Card */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Stages
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {completedStagesCount}/{stages.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {inProgressStagesCount} in progress
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Card */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tasks
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {taskStats.completed}/{taskStats.total}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {taskStats.inProgress} in progress
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <ListChecks className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subtasks Card */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Subtasks
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {subtaskStats.completed}/{subtaskStats.total}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {subtaskStats.inProgress} in progress
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Card */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Documents
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {docStats.total}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {docStats.folders} folders
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DETAILED BREAKDOWN */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Task Status Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5 text-primary" />
              Task Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{taskStats.completed}</span>
                  <Progress
                    value={taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0}
                    className="w-20 h-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{taskStats.inProgress}</span>
                  <Progress
                    value={taskStats.total > 0 ? (taskStats.inProgress / taskStats.total) * 100 : 0}
                    className="w-20 h-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  <span className="text-sm">Not Started</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{taskStats.notStarted}</span>
                  <Progress
                    value={taskStats.total > 0 ? (taskStats.notStarted / taskStats.total) * 100 : 0}
                    className="w-20 h-2"
                  />
                </div>
              </div>

              {taskStats.overdue > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm text-red-600">Overdue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-600">{taskStats.overdue}</span>
                    <Progress
                      value={taskStats.total > 0 ? (taskStats.overdue / taskStats.total) * 100 : 0}
                      className="w-20 h-2"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push("/client/tasks")}
                >
                  View All Tasks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage Progress Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Stage Progress Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-muted/50 rounded-full p-3 mb-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No stages configured yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {subtasksByStage
                  .sort((a, b) => a.order_number - b.order_number)
                  .map((stage) => {
                    const totalSubtasks = stage.subtasks?.length || 0;
                    const completedSubtasks = stage.subtasks?.filter(
                      (s: any) => s.status === "Completed"
                    ).length || 0;
                    const stageProgress = totalSubtasks > 0
                      ? Math.round((completedSubtasks / totalSubtasks) * 100)
                      : 0;

                    const allSubtasksCompleted = totalSubtasks > 0 && completedSubtasks === totalSubtasks;
                    const isCompleted = stage.status === "Completed" || allSubtasksCompleted;
                    const isInProgress = stage.status === "In Progress";

                    return (
                      <div key={stage.client_stage_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : isInProgress ? (
                              <Clock className="h-4 w-4 text-blue-600" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className={isCompleted ? "text-green-700" : ""}>
                              {stage.stage_name}
                            </span>
                          </div>
                          <Badge
                            variant={isCompleted ? "default" : isInProgress ? "secondary" : "outline"}
                            className={isCompleted ? "bg-green-100 text-green-800" : ""}
                          >
                            {completedSubtasks}/{totalSubtasks}
                          </Badge>
                        </div>
                        <Progress value={stageProgress} className="h-2" />
                      </div>
                    );
                  })}

                <div className="pt-3 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push("/client/stages")}
                  >
                    View All Stages
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DOCUMENTS & QUICK LINKS */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Documents Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Documents Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">Total Files</p>
                    <p className="text-xs text-muted-foreground">Uploaded documents</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{docStats.total}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Folder className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Folders</p>
                    <p className="text-xs text-muted-foreground">Organized categories</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{docStats.folders}</span>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/client/documents")}
              >
                Manage Documents
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="w-full justify-start h-12"
                onClick={() => router.push("/client/tasks")}
              >
                <ListChecks className="mr-3 h-5 w-5 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">View Tasks</p>
                  <p className="text-xs text-muted-foreground">
                    {taskStats.total - taskStats.completed} pending
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-12"
                onClick={() => router.push("/client/stages")}
              >
                <TrendingUp className="mr-3 h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">View Stages</p>
                  <p className="text-xs text-muted-foreground">
                    {stages.length - completedStagesCount} remaining
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-12"
                onClick={() => router.push("/client/messages")}
              >
                <Clock className="mr-3 h-5 w-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium">Messages</p>
                  <p className="text-xs text-muted-foreground">Contact your admin</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-12"
                onClick={() => router.push("/client/profile")}
              >
                <Calendar className="mr-3 h-5 w-5 text-orange-600" />
                <div className="text-left">
                  <p className="font-medium">My Profile</p>
                  <p className="text-xs text-muted-foreground">View account details</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
