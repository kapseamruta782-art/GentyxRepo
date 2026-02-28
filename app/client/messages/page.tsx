// app/client/messages/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useUIStore } from "@/store/ui-store";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { fetchClient } from "@/lib/api";

export default function ClientMessages() {
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);

  const [clientId, setClientId] = useState<string | null>(null);

  // Wait for client context from login
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId);
    }
  }, [role, currentClientId]);

  // Mark messages as read when this page loads
  useEffect(() => {
    if (clientId && typeof window !== "undefined") {
      const now = new Date();
      localStorage.setItem(`clienthub_messages_read_${clientId}`, now.toISOString());
    }
  }, [clientId]);

  // Fetch client data to get service center and CPA info
  const { data: client } = useSWR(
    clientId ? ["client", clientId] : null,
    () => fetchClient(clientId!)
  );

  // Extract IDs from client data
  const serviceCenterId = client?.service_center_id;
  const cpaId = client?.cpa_id;

  // Fetch service center name if assigned
  const { data: serviceCenterData } = useSWR(
    serviceCenterId ? ["sc", serviceCenterId] : null,
    async () => {
      const res = await fetch(`/api/service-centers/${serviceCenterId}/get`);
      const json = await res.json();
      return json.data;
    }
  );

  // Fetch CPA name if assigned
  const { data: cpaData } = useSWR(
    cpaId ? ["cpa", cpaId] : null,
    async () => {
      const res = await fetch(`/api/cpas/${cpaId}/get`);
      const json = await res.json();
      return json.data;
    }
  );

  const serviceCenterName = serviceCenterData?.center_name;
  const cpaName = cpaData?.cpa_name;

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Communicate with your admin, service center, and preparer team
        </p>
      </div>

      <FlexibleChat
        clientId={clientId}
        serviceCenterName={serviceCenterName}
        cpaName={cpaName}
        serviceCenterId={serviceCenterId ?? undefined}
        cpaId={cpaId ?? undefined}
        currentUserRole="CLIENT"
        recipients={[
          { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
          ...(serviceCenterId ? [{ role: "SERVICE_CENTER" as const, label: serviceCenterName || "Service Center", color: "bg-emerald-500" }] : []),
          ...(cpaId ? [{ role: "CPA" as const, label: cpaName || "Preparer", color: "bg-amber-500" }] : []),
        ]}
        height="600px"
      />
    </div>
  );
}

