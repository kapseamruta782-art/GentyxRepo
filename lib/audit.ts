import { supabase } from "@/lib/db";

// Action type constants for consistency
// ... (AuditActions remain the same)
export const AuditActions = {
    // Client
    CLIENT_CREATED: "Client created",
    CLIENT_UPDATED: "Client details updated",

    // Tasks
    TASK_CREATED: "Task created",
    TASK_UPDATED: "Task updated",
    TASK_COMPLETED: "Task marked as completed",
    TASK_DELETED: "Task deleted",
    TASK_ASSIGNED: "Task assigned",

    // Stages
    STAGE_STARTED: "Stage started",
    STAGE_COMPLETED: "Stage completed",
    STAGE_UPDATED: "Stage updated",

    // Documents
    DOCUMENT_UPLOADED: "Document uploaded",
    DOCUMENT_DELETED: "Document deleted",
    FOLDER_CREATED: "Folder created",
    FOLDER_DELETED: "Folder deleted",

    // Messages
    MESSAGE_SENT: "Message sent",

    // Role Assignments
    SERVICE_CENTER_ASSIGNED: "Service Center assigned",
    CPA_ASSIGNED: "CPA assigned",
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

export type AuditActorRole = "ADMIN" | "CLIENT" | "SYSTEM" | "CPA" | "SERVICE_CENTER";

interface LogAuditParams {
    clientId: number | string;
    action: string;
    actorRole: AuditActorRole;
    details?: string;
}

/**
 * Log an audit entry for a client action
 */
export async function logAudit({
    clientId,
    action,
    actorRole,
    details,
}: LogAuditParams): Promise<void> {
    try {
        const fullAction = details ? `${action}: ${details}` : action;

        const { error } = await supabase
            .from("onboarding_audit_log")
            .insert({
                client_id: Number(clientId),
                action: fullAction,
                actor_role: actorRole,
                created_at: new Date().toISOString()
            });

        if (error) throw error;

        console.log(`[AUDIT] ${actorRole} | ${fullAction} | Client: ${clientId}`);
    } catch (error) {
        // Don't throw - audit logging should never break the main operation
        console.error("[AUDIT ERROR]", error);
    }
}
