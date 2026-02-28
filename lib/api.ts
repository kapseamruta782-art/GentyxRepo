// lib/api.ts
import type { ClientProfile } from "@/types";

/* -------------------------------------------------------------
    FETCH CLIENT LIST  (calls:  /api/clients/get )
--------------------------------------------------------------*/
export async function fetchClients({
  page = 1,
  pageSize = 10,
  q = "",
  status = "ALL",
  archiveFilter = "ALL",
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  archiveFilter?: string;
}) {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    q,
    status,
    archiveFilter,
  });

  const res = await fetch(`/api/clients/get?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

/* -------------------------------------------------------------
    FETCH SINGLE CLIENT BY ID (calls: /api/clients/[id]/get )
--------------------------------------------------------------*/
export async function fetchClient(id: string) {
  const res = await fetch(`/api/clients/${id}/get`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch client");
  const json = await res.json();
  return json.data as ClientProfile;
}

/* -------------------------------------------------------------
    (OLD) CLIENT-SPECIFIC TASKS — used in Client Detail Page
    calls: /api/tasks/get?clientId=123
--------------------------------------------------------------*/
export async function fetchClientTasks(params?: { clientId?: string }) {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set("clientId", params.clientId);

  const res = await fetch(`/api/tasks/get?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch tasks for client");
  return res.json();
}

// FETCH TASKS FOR SPECIFIC CLIENT (used inside client detail page)
export async function fetchTasks(params: { clientId: string }) {
  const clientId = params.clientId;

  if (!clientId) throw new Error("clientId is required for fetchTasks()");

  const res = await fetch(`/api/tasks/list?clientId=${encodeURIComponent(clientId)}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

/* -------------------------------------------------------------
    CLIENT — FETCH TASKS (CLIENT-SCOPED, SAFE)
    calls: /api/tasks/client/[clientId]
--------------------------------------------------------------*/
export async function fetchClientTasksByClientId(
  clientId: string | number
) {
  if (!clientId) {
    throw new Error("clientId is required");
  }

  const res = await fetch(`/api/tasks/client/${clientId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch client tasks");
  }

  return res.json(); // { success, data }
}


export async function fetchDocuments(params?: { clientId?: string }) {
  const qs = params?.clientId ? `?clientId=${params.clientId}` : "";
  const url = `/api/documents/list${qs}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  return res.json();
}


/* -------------------------------------------------------------
    FETCH MESSAGES (calls: /api/messages/get )
--------------------------------------------------------------*/
export async function fetchMessages(params?: { clientId?: string }) {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set("clientId", params.clientId);

  const res = await fetch(`/api/messages/get?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

/* -------------------------------------------------------------
    FETCH AUDIT LOGS (calls: /api/audit/get )
--------------------------------------------------------------*/
export async function fetchAuditLogs(params?: { clientId?: string }) {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set("clientId", params.clientId);

  const res = await fetch(`/api/audit/get?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}
/* -------------------------------------------------------------
    ASSIGN TASK (calls: /api/tasks/add )
--------------------------------------------------------------*/
export async function assignTask(payload: {
  clientId: number;
  taskTitle: string;
  assignedToRole: string;
  dueDate?: string | null;
  description?: string;
  orderNumber?: number;
  documentRequired?: boolean;
}) {
  const res = await fetch("/api/tasks/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: payload.clientId,
      taskTitle: payload.taskTitle,
      assignedToRole: payload.assignedToRole,
      dueDate: payload.dueDate || null,
      description: payload.description || "",
      orderNumber: payload.orderNumber || 1,
      documentRequired: payload.documentRequired !== false, // Default to true
    }),
  });

  const json = await res.json();

  if (!json.success) throw new Error(json.error || "Failed to assign task");
  return json;
}



// FETCH SERVICE CENTERS
export async function fetchServiceCenters() {
  const res = await fetch("/api/service-centers/get", { cache: "no-store" });
  const json = await res.json();
  return json; // must contain { success, data }
}

// FETCH CPAs (already working)
export async function fetchCPAs() {
  const res = await fetch("/api/cpas/get", { cache: "no-store" });
  return res.json();
}

// FETCH MASTER STAGES (NO CLIENT ID NEEDED)
export async function fetchStagesList() {
  const res = await fetch("/api/stages/list", { cache: "no-store" });
  const json = await res.json();
  return json; // must return { success, data }
}


/* -------------------------------------------------------------
    CREATE NEW CLIENT  (calls: /api/clients/add )
--------------------------------------------------------------*/
export type NewClientPayload = {
  clientName: string;
  code?: string;
  slaNumber?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  serviceCenterId?: number | null;
  cpaId?: number | null;
  stageId?: number | null;
  associatedUsers: {
    name: string;
    email: string;
    role: string;
  }[];
};

export async function createClient(payload: any) {

  console.log("FINAL PAYLOAD SENT TO BACKEND:", payload);

  const res = await fetch("/api/clients/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Always parse and return the JSON response, even on error status
  // This allows the caller to read the specific error message
  const json = await res.json();
  return json;
}

export async function fetchDefaultStages() {
  const res = await fetch("/api/stages/default", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch default stages");
  return res.json();
}

export async function fetchClientStages(clientId: number | string) {
  const res = await fetch(`/api/stages/client/get?clientId=${clientId}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch client stages");
  return res.json();
}

export async function saveClientStages(payload: {
  clientId: number | string;
  stages: any[];
  subtasks: Record<string, any[]>;
}) {
  const res = await fetch("/api/stages/client/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to save client stages");
  return res.json();
}


// SET STAGE FOR A CLIENT
export async function setStage(payload: {
  clientId: number;
  stageName: string;
}) {
  const res = await fetch("/api/stages/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.json();
}


/* -------------------------------------------------------------
    ADMIN — FETCH ALL TASKS (UNIFIED)
    calls: /api/tasks/get
--------------------------------------------------------------*/
export async function fetchAllTasks({
  page = 1,
  pageSize = 10,
  q,
  taskType,
  assignedRole,
  dueFrom,
  dueTo,
  clientId,
}: {
  page?: number;
  pageSize?: number;
  q?: string;
  taskType?: "ONBOARDING" | "ASSIGNED";
  assignedRole?: string;
  dueFrom?: string;
  dueTo?: string;
  clientId?: string | number;
}) {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (q) params.set("q", q);
  if (taskType) params.set("taskType", taskType);
  if (assignedRole) params.set("assignedRole", assignedRole);
  if (dueFrom) params.set("dueFrom", dueFrom);
  if (dueTo) params.set("dueTo", dueTo);
  if (clientId) params.set("clientId", String(clientId));

  const res = await fetch(`/api/tasks/get?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch all tasks");
  return res.json();
}

// FETCH SIMPLE TASKS FOR A CLIENT (used inside client detail page)
export async function fetchClientTasksSimple(clientId: string) {
  const res = await fetch(`/api/tasks/client?clientId=${clientId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch simple tasks");
  return res.json();
}


export async function fetchClientDocuments(clientId: string | number) {
  const res = await fetch(`/api/documents/get-by-client?id=${clientId}`);
  return res.json();
}


/* -------------------------------------------------------------
    EMAIL TEMPLATE API CALLS
--------------------------------------------------------------*/

// GET all templates
export async function fetchEmailTemplates() {
  const res = await fetch("/api/email-templates/get", { cache: "no-store" });
  const json = await res.json();
  return json.data || [];
}

// CREATE template
export async function createEmailTemplate(payload: {
  name: string;
  subject: string;
  body: string;
}) {
  const res = await fetch("/api/email-templates/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.json();
}

// UPDATE template
export async function updateEmailTemplate(payload: {
  id: number | string;
  name: string;
  subject: string;
  body: string;
}) {
  const res = await fetch("/api/email-templates/update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.json();
}

// DELETE template
export async function deleteEmailTemplate(id: number | string) {
  const res = await fetch(`/api/email-templates/delete?id=${id}`, {
    method: "DELETE"
  });

  return res.json();
}


//  Default Stage Templates and Stages API Calls

export async function fetchDefaultStageTemplates() {
  const res = await fetch("/api/default-stage-templates/list", { cache: "no-store" });
  return res.json();
}

export async function createDefaultStageTemplate(payload: {
  template_name: string;
  description?: string;
}) {
  const res = await fetch("/api/default-stage-templates/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchDefaultStagesByTemplate(templateId: number) {
  const res = await fetch(`/api/default-stages/list?templateId=${templateId}`, {
    cache: "no-store",
  });
  return res.json();
}

export async function saveDefaultStages(payload: {
  templateId: number;
  stages: any[];
}) {
  const res = await fetch("/api/default-stages/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ADMIN PROFILE API Calls
export async function fetchAdminProfile() {
  const res = await fetch("/api/admin/profile/get", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch admin profile");
  const json = await res.json();
  return json.data;
}

export async function updateAdminProfile(payload: {
  full_name: string;
  email: string;
  phone: string;
}) {
  const res = await fetch("/api/admin/profile/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update admin profile");
  return res.json();
}

export async function updateAdminPassword(payload: {
  currentPassword?: string;
  newPassword?: string;
}) {
  const res = await fetch("/api/admin/password/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to update password");
  return json;
}

export async function createAdminUser(payload: {
  currentPassword?: string;
  newEmail?: string;
  newPassword?: string;
}) {
  const res = await fetch("/api/admin/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to create admin");
  return json;
}


/* -------------------------------------------------------------
    EMAIL LOGS / AUDIT API CALLS
--------------------------------------------------------------*/

export interface EmailLogFilters {
  page?: number;
  pageSize?: number;
  recipientRole?: string;
  status?: string;
  emailType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// FETCH EMAIL LOGS
export async function fetchEmailLogs(filters: EmailLogFilters) {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.recipientRole) params.set("recipientRole", filters.recipientRole);
  if (filters.status) params.set("status", filters.status);
  if (filters.emailType) params.set("emailType", filters.emailType);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.search) params.set("search", filters.search);

  const res = await fetch(`/api/email-logs?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch email logs");
  return res.json();
}

// RESEND EMAIL
export async function resendEmail(emailLogId: number, adminEmail?: string) {
  const res = await fetch("/api/email-logs/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailLogId, adminEmail }),
  });

  return res.json();
}
