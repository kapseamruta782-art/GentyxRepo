import type { AuditLog, ClientProfile, DocumentFile, EmailTemplate, Message, Stage, Task, UserRole } from "@/types"

export const mockServiceCenters = [
  { id: "sc-1", name: "North Ops" },
  { id: "sc-2", name: "East Ops" },
  { id: "sc-3", name: "West Ops" },
]

export const mockCPAs = [
  { id: "cpa-1", name: "Acme CPA" },
  { id: "cpa-2", name: "Ledger & Co" },
  { id: "cpa-3", name: "Prime Audit" },
]

export const mockStages: Stage[] = [
  { id: "stg-1", name: "KYC", isRequired: true, order: 1, description: "Know Your Customer" },
  { id: "stg-2", name: "Docs Review", isRequired: true, order: 2 },
  { id: "stg-3", name: "Accounting Setup", isRequired: true, order: 3 },
  { id: "stg-4", name: "Go-Live", isRequired: false, order: 4 },
]

export const mockClients: ClientProfile[] = Array.from({ length: 10 }).map((_, i) => {
  const pct = Math.min(100, i * 10 + 15)
  const stg = mockStages[Math.min(mockStages.length - 1, Math.floor(i / 3))].name
  return {
    id: `cli-${i + 1}`,
    name: `Client ${i + 1} LLC`,
    primaryContact: { name: `Contact ${i + 1}`, email: `client${i + 1}@mail.com`, phone: "555-0101" },
    serviceCenterId: mockServiceCenters[i % mockServiceCenters.length].id,
    cpaId: mockCPAs[i % mockCPAs.length].id,
    status: pct >= 100 ? "Completed" : pct > 0 ? "In Progress" : "Not Started",
    onboardingStage: stg,
    progressPct: pct,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }
})

const roles: UserRole[] = ["ADMIN", "CLIENT", "SERVICE_CENTER", "CPA"]

export const mockTasks: Task[] = Array.from({ length: 36 }).map((_, i) => {
  const client = mockClients[i % mockClients.length]
  const assigneeRole = (["CLIENT", "SERVICE_CENTER", "CPA"] as UserRole[])[i % 3]
  const statusOrder = ["Pending", "In Review", "Approved", "Rejected"] as Task["status"][]
  return {
    id: `tsk-${i + 1}`,
    title: i % 2 ? "Upload KYC Documents" : "Connect Bank Feeds",
    description: "Please complete this step to proceed.",
    clientId: client.id,
    stage: client.onboardingStage,
    assigneeRole,
    createdByRole: roles[i % roles.length],
    status: statusOrder[i % statusOrder.length],
    dueDate: new Date(Date.now() + (i % 10) * 86400000).toISOString(),
    createdAt: new Date(Date.now() - (i % 5) * 86400000).toISOString(),
  }
})

export const mockDocuments: DocumentFile[] = mockClients.flatMap((c, idx) => {
  const statusOrder: DocumentFile["status"][] = ["Uploaded", "Reviewed", "Approved", "Needs Fix"]
  return ["KYC.pdf", "Bank-Statement.pdf", "ChartOfAccounts.xlsx"].map((name, j) => ({
    id: `doc-${idx + 1}-${j + 1}`,
    clientId: c.id,
    name,
    type: name.endsWith(".pdf") ? "PDF" : name.endsWith(".xlsx") ? "XLSX" : "OTHER",
    uploadedByRole: roles[(idx + j) % roles.length],
    uploadedAt: new Date(Date.now() - (idx + j) * 3600000).toISOString(),
    status: statusOrder[(idx + j) % statusOrder.length],
    notes: (idx + j) % 4 === 3 ? "Please re-upload the last page." : undefined,
  }))
})

export const mockMessages: Message[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `msg-${i + 1}`,
  threadId: `thr-${Math.floor(i / 4) + 1}`,
  participants: [
    { role: "CLIENT", display: "Client User" },
    { role: "SERVICE_CENTER", display: "SC Agent" },
    { role: "ADMIN", display: "Admin" },
  ],
  senderRole: roles[i % roles.length],
  clientId: mockClients[i % mockClients.length].id,
  body: i % 2 ? "Can you review the upload?" : "Please provide the latest statements.",
  createdAt: new Date(Date.now() - i * 1800000).toISOString(),
}))

export const mockEmailTemplates: EmailTemplate[] = [
  {
    id: "tpl-1",
    name: "New Task Assigned",
    subject: "New Task: {{taskTitle}}",
    body: 'Hi {{clientName}}, a new task "{{taskTitle}}" was assigned and is due {{dueDate}}.',
    isDefault: true,
  },
  {
    id: "tpl-2",
    name: "Stage Updated",
    subject: "Stage: {{stageName}}",
    body: "Your onboarding stage is now {{stageName}}.",
    isDefault: false,
  },
]

export const mockAuditLogs: AuditLog[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `aud-${i + 1}`,
  actorRole: roles[i % roles.length],
  action: ["TASK_CREATED", "DOC_UPLOADED", "STAGE_SET"][i % 3],
  clientId: mockClients[i % mockClients.length].id,
  metadata: { taskId: `tsk-${i + 1}` },
  at: new Date(Date.now() - i * 600000).toISOString(),
}))
