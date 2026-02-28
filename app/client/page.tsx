// app/client/page.tsx
"use client";

import useSWR from "swr";
import { fetchClientTasksByClientId, fetchDocuments, fetchMessages } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/widgets/status-pill";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  ListChecks,
  ArrowRight,
  Folder,
  Upload,
  User,
} from "lucide-react";

// Types
type StageItem = {
  client_stage_id: number;
  stage_name: string;
  order_number: number;
  status: string;
};

function formatDueDate(value: any) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatRelativeTime(value: any) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function ClientHome() {
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);
  const router = useRouter();

  const [clientId, setClientId] = useState<string | null>(null);

  // Wait for client context from login
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId);
    }
  }, [role, currentClientId]);

  // Fetch client data
  const { data: client } = useSWR(
    clientId ? ["client-home-data", clientId] : null,
    async () => {
      const res = await fetch(`/api/clients/${clientId}/get`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    }
  );

  // Fetch stages for timeline
  const { data: stageData } = useSWR(
    clientId ? ["client-home-stages", clientId] : null,
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
  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = useSWR(
    clientId ? ["client-tasks", clientId] : null,
    () => fetchClientTasksByClientId(clientId!),
    { revalidateOnFocus: false }
  );

  // Documents - use client-scoped API
  const {
    data: docsResponse,
    isLoading: docsLoading,
    error: docsError,
  } = useSWR(
    clientId ? ["client-home-docs", clientId] : null,
    async () => {
      const res = await fetch(`/api/documents/get-by-client?id=${clientId}&role=CLIENT`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    { revalidateOnFocus: false }
  );
  const docs = (docsResponse?.data || []).filter(
    (d: any) => (d.type === 'file' || d.type === 'folder') && !d.name?.endsWith('.keep') && d.name !== '.keep'
  );

  // Messages - extract data array from response
  const { data: messagesData } = useSWR(
    clientId ? ["client-home-messages", clientId] : null,
    async () => {
      const res = await fetchMessages({ clientId: clientId! });
      return res?.data || [];
    },
    { revalidateOnFocus: false }
  );
  const messages = messagesData || [];

  // Calculate progress
  const completedStagesCount = useMemo(() => {
    return subtasksByStage.filter((stage) => {
      const allSubtasksCompleted =
        stage.subtasks?.length > 0 &&
        stage.subtasks.every((st: any) => st.status === "Completed");
      return stage.status === "Completed" || allSubtasksCompleted;
    }).length;
  }, [subtasksByStage]);

  const progress =
    stages.length > 0
      ? Math.round((completedStagesCount / stages.length) * 100)
      : 0;

  const topTasks = useMemo(() => {
    const list = (tasks?.data || []) as any[];
    return list
      .slice()
      .sort((a, b) => {
        const ad = a?.dueDate
          ? new Date(a.dueDate).getTime()
          : Number.POSITIVE_INFINITY;
        const bd = b?.dueDate
          ? new Date(b.dueDate).getTime()
          : Number.POSITIVE_INFINITY;
        return ad - bd;
      })
      .slice(0, 5);
  }, [tasks]);

  const topDocs = useMemo(() => {
    return docs.slice(0, 5);
  }, [docs]);

  const recentMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    // Sort by time (newest first) and take top 3
    return [...messages]
      .sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt || a.created_at).getTime();
        const bTime = new Date(b.createdAt || b.created_at).getTime();
        return bTime - aTime; // Descending - newest first
      })
      .slice(0, 3);
  }, [messages]);

  // Stats calculations
  const pendingTasksCount = useMemo(() => {
    const list = (tasks?.data || []) as any[];
    return list.filter(
      (t) => t.status !== "Completed" && t.status !== "completed"
    ).length;
  }, [tasks]);

  const completedTasksCount = useMemo(() => {
    const list = (tasks?.data || []) as any[];
    return list.filter(
      (t) => t.status === "Completed" || t.status === "completed"
    ).length;
  }, [tasks]);

  const totalDocsCount = useMemo(() => {
    return docs.length;
  }, [docs]);

  // Track last time user read messages using localStorage
  const [lastReadTime, setLastReadTime] = useState<Date | null>(null);

  // Load last read time from localStorage on mount
  useEffect(() => {
    if (clientId && typeof window !== "undefined") {
      const stored = localStorage.getItem(`clienthub_messages_read_${clientId}`);
      if (stored) {
        setLastReadTime(new Date(stored));
      }
    }
  }, [clientId]);

  // Mark messages as read when user navigates to messages
  const markMessagesAsRead = () => {
    if (clientId && typeof window !== "undefined") {
      const now = new Date();
      localStorage.setItem(`clienthub_messages_read_${clientId}`, now.toISOString());
      setLastReadTime(now);
    }
  };

  // Count unread messages (messages received after last read time)
  const unreadMessagesCount = useMemo(() => {
    if (!Array.isArray(messages)) return 0;

    // If never read, count messages from last 24 hours
    const cutoffTime = lastReadTime || (() => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      return oneDayAgo;
    })();

    return messages.filter((m: any) => {
      // Only count messages FROM others (not from CLIENT)
      const senderRole = m.senderRole || m.sender_role;
      const isFromOthers = senderRole !== "CLIENT";
      const msgDate = new Date(m.createdAt || m.created_at);
      return isFromOthers && msgDate > cutoffTime;
    }).length;
  }, [messages, lastReadTime]);

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
      {/* WELCOME HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{client?.client_name ? `, ${client.client_name}` : ""}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's an overview of your onboarding progress and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {stages.length > 0 && (
            <ProgressRing
              value={progress}
              completedStages={completedStagesCount}
              totalStages={stages.length}
            />
          )}
          <Button onClick={() => router.push("/client/profile")}>
            <User className="mr-2 h-4 w-4" />
            View Profile
          </Button>
        </div>
      </div>

      {/* MY DOCUMENTS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            My Documents
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                // Auto-route to "Client Uploaded" section in blob storage
                const uploadFolder = "Client Uploaded";
                useUIStore.getState().openDrawer("uploadDoc", {
                  clientId: clientId,
                  folderName: uploadFolder,
                });
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Files
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/client/documents")}
            >
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!clientId || docsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-muted-foreground">
                Loading documents…
              </span>
            </div>
          ) : docsError ? (
            <div className="text-sm text-red-600 py-4 text-center">
              Failed to load documents.
            </div>
          ) : topDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="bg-muted/50 rounded-full p-4 mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                No documents uploaded yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/client/documents")}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Your First Document
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {topDocs.map((d: any, idx: number) => {
                const isFolder = d.type === "folder";
                return (
                  <div
                    key={`doc-${idx}-${d.name}`}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (isFolder) {
                        router.push(`/client/documents?folder=${encodeURIComponent(d.name)}`);
                      } else {
                        // If file, go to documents page (or we could open preview)
                        router.push("/client/documents");
                      }
                    }}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isFolder ? "bg-amber-100" : "bg-primary/10"}`}>
                      {isFolder ? (
                        <Folder className="h-5 w-5 text-amber-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {isFolder ? "Folder" : (d.size ? `${(d.size / 1024).toFixed(1)} KB` : "Document")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ONBOARDING PROGRESS - STAGE TIMELINE (hidden if no stages assigned) */}
      {stages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Your Onboarding Progress
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-semibold text-primary">{progress}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{completedStagesCount} of {stages.length} stages completed</span>
                  <span>{stages.length - completedStagesCount} remaining</span>
                </div>
              </div>

              {/* Stage Timeline */}
              <div className="flex flex-wrap items-center gap-2 py-3 px-2 bg-muted/30 rounded-lg">
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

                    const isCompleted =
                      stage.status === "Completed" || allSubtasksCompleted;
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
                          {isCompleted && (
                            <CheckCircle2 className="inline-block mr-1 h-3 w-3" />
                          )}
                          {stage.stage_name}
                        </span>
                        {index < stages.length - 1 && (
                          <span className="mx-3 text-muted-foreground font-bold">
                            →
                          </span>
                        )}
                      </span>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QUICK STATS CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/client/tasks")}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Pending Tasks
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {pendingTasksCount}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/client/tasks")}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Completed Tasks
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {completedTasksCount}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/client/documents")}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Documents
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {totalDocsCount}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Folder className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            markMessagesAsRead();
            router.push("/client/messages");
          }}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Unread Messages
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {unreadMessagesCount}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RECENT MESSAGES & TASKS */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* RECENT MESSAGES / INBOX */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Recent Messages
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                markMessagesAsRead();
                router.push("/client/messages");
              }}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="bg-muted/50 rounded-full p-3 mb-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No messages yet.</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    markMessagesAsRead();
                    router.push("/client/messages");
                  }}
                  className="mt-1"
                >
                  Send a message to your admin
                </Button>
              </div>
            ) : (
              recentMessages.map((msg: any, idx: number) => {
                const senderRole = msg.senderRole || msg.sender_role;
                const isFromClient = senderRole === "CLIENT";
                const senderLabel = isFromClient
                  ? "You"
                  : senderRole === "ADMIN"
                    ? "Admin"
                    : senderRole === "SERVICE_CENTER"
                      ? "Service Center"
                      : senderRole === "CPA"
                        ? "Preparer"
                        : senderRole;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors cursor-pointer"
                    onClick={() => {
                      markMessagesAsRead();
                      router.push("/client/messages");
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2">{msg.body}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(msg.createdAt || msg.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isFromClient ? "Sent by: " : "From: "}{senderLabel}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* MY TASKS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListChecks className="h-5 w-5 text-primary" />
              My Tasks
            </CardTitle>
            <Button size="sm" onClick={() => router.push("/client/tasks")}>
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!clientId || tasksLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading tasks…
                </span>
              </div>
            ) : tasksError ? (
              <div className="text-sm text-red-600 py-4 text-center">
                Failed to load tasks.
              </div>
            ) : topTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="bg-muted/50 rounded-full p-3 mb-2">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No tasks assigned yet.
                </p>
              </div>
            ) : (
              topTasks.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Due: {formatDueDate(t.dueDate)}
                    </div>
                  </div>
                  <StatusPill status={t.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}