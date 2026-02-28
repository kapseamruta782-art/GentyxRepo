// app/client/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { useUIStore } from "@/store/ui-store";
import { Eye, Pencil, Phone, Mail, Building2, UserCircle } from "lucide-react";
import { formatPhone } from "@/lib/formatters";

// ------------------ TYPES ------------------
type StageItem = {
  client_stage_id: number;
  stage_name: string;
  order_number: number;
  status: string;
};

export default function ClientProfile() {
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
  const { data: client, isLoading: clientLoading } = useSWR(
    clientId ? ["client-profile", clientId] : null,
    async () => {
      const res = await fetch(`/api/clients/${clientId}/get`);
      if (!res.ok) throw new Error("Failed to fetch client");
      const json = await res.json();
      return json.data;
    }
  );

  // Fetch stages for timeline
  const { data: stageData } = useSWR(
    clientId ? ["client-stages-timeline", clientId] : null,
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

  // Calculate progress
  const progress =
    client?.total_stages && client?.completed_stages
      ? Math.round((client.completed_stages / client.total_stages) * 100)
      : 0;

  if (!clientId || clientLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* ---------- HEADER ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {client?.client_name ?? "Your Profile"}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {client?.primary_contact_phone
                  ? formatPhone(client.primary_contact_phone)
                  : "—"}
              </span>

              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {client?.primary_contact_email || "—"}
              </span>
            </div>

            {client?.primary_contact_name && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                Contact: {client.primary_contact_name}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ProgressRing
            value={progress}
            completedStages={client?.completed_stages}
            totalStages={client?.total_stages}
          />

          {/* <Button
            variant="outline"
            onClick={() => router.push("/client/stages")}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Stages
          </Button> */}

          <Button onClick={() => router.push("/client/profile/edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* ---------- OVERVIEW CARDS ---------- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* CLIENT SUMMARY */}
        <Card className={`md:col-span-2 ${stages.length > 0 ? "lg:col-span-1" : "lg:col-span-3"}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Client Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Client Code</span>
              <span className="font-medium">{client?.code || "—"}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="font-medium">
                {client?.created_at
                  ? new Date(client.created_at).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <span className="font-medium">
                {client?.updated_at
                  ? new Date(client.updated_at).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Progress</span>
              <span className="font-bold text-lg text-primary">{progress}%</span>
            </div>
          </CardContent>
        </Card>

        {/* STAGE TIMELINE */}
        {stages.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
                Stage Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 py-2">
                {stages
                  .sort((a, b) => a.order_number - b.order_number)
                  .map((stage, index) => {
                    // Check if stage is completed (either stage status or all subtasks completed)
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

                    return (
                      <span
                        key={stage.client_stage_id}
                        className="flex items-center"
                      >
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isCompleted
                            ? "bg-green-100 border border-green-300 text-green-800 shadow-sm"
                            : stage.status === "In Progress"
                              ? "bg-blue-100 border border-blue-300 text-blue-800 shadow-sm animate-pulse"
                              : "bg-gray-100 border border-gray-300 text-gray-600"
                            }`}
                        >
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
            </CardContent>
          </Card>
        )}

        {/* SERVICE CENTER & CPA INFO */}
        {/* SERVICE CENTER & CPA INFO */}
        {(client?.service_center_name || client?.cpa_name) && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Your Assigned Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Service Center
                    </p>
                    <p className="text-lg font-semibold">
                      {client?.service_center_name || "Not Assigned"}
                    </p>
                    {client?.service_center_email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Mail className="h-3.5 w-3.5" />
                        {client.service_center_email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <UserCircle className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Preparer
                    </p>
                    <p className="text-lg font-semibold">
                      {client?.cpa_name || "Not Assigned"}
                    </p>
                    {client?.cpa_email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Mail className="h-3.5 w-3.5" />
                        {client.cpa_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
