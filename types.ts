// types.ts
export type UserRole = "ADMIN" | "CLIENT" | "SERVICE_CENTER" | "CPA";


export type ClientProfile = {
  client_id: number;
  client_name: string;
  code?: string;
  client_status?: string;
  sla_number?: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  created_at?: string;
  updated_at?: string;

  service_center_id?: number | null;
  cpa_id?: number | null;

  // ✅ ADD THESE TWO LINES (THIS FIXES THE RED ERROR)
  service_center_name?: string | null;
  cpa_name?: string | null;

  // Email addresses of the assigned Service Center and CPA
  service_center_email?: string | null;
  cpa_email?: string | null;

  // Optional extras already returned by your API
  stage_id?: number;
  stage_name?: string;
  status?: string;
  total_stages?: number;
  completed_stages?: number;
  progress?: number;

  // Archive status
  is_archived?: boolean;

  // Associated users for this client
  associated_users?: {
    id: number;
    name: string;
    email: string;
    role: string;
    phone?: string;
    created_at?: string;
  }[];
};


/* ------------------------- */
export type DocumentFile = {
  id: string;
  clientId: string;
  name: string;
  type: "PDF" | "XLSX" | "DOCX" | "IMG" | "OTHER";
  uploadedByRole: UserRole;
  uploadedAt: string;
  status?: "Uploaded" | "Reviewed" | "Approved" | "Needs Fix";
  notes?: string;
};



export type Task = {
  id: string;
  title: string;
  description?: string;

  clientId: string;
  clientName?: string;   // ✅ ADDED THIS

  stage?: string;
  assigneeRole: UserRole;
  createdByRole: UserRole;

  status: "Pending" | "In Review" | "In Progress" | "Approved" | "Rejected" | "Completed";
  dueDate?: string;

  createdAt: string;
  updatedAt?: string;

  attachments?: DocumentFile[];
};

export type Stage = {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  order: number;
};

export type Message = {
  id: string;
  threadId: string;
  participants: { role: UserRole; display: string }[];
  senderRole: UserRole;
  clientId?: string;
  body: string;
  createdAt: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
};

export type AuditLog = {
  id: string;
  actorRole: UserRole;
  action: string;
  clientId?: string;
  metadata?: Record<string, any>;
  at: string;
};

export type CPA = {
  cpa_id: number;
  cpa_code: string;
  cpa_name: string;
  email: string;
  created_at: string;
  updated_at?: string;
};

export type EmailLog = {
  id: number;
  recipientEmail: string;
  recipientName?: string;
  recipientRole?: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  relatedEntityType?: 'client' | 'cpa' | 'service_center';
  relatedEntityId?: number;
  relatedEntityName?: string;
  emailType: string;
  emailSubject: string;
  emailBodyPreview?: string;
  status: 'Pending' | 'Sent' | 'Delivered' | 'Failed' | 'Unknown';
  statusMessage?: string;
  acsMessageId?: string;
  resendCount: number;
  lastResentAt?: string;
  resentBy?: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  metadata?: Record<string, any>;
};
