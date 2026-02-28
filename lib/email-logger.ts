// lib/email-logger.ts
// Centralized email logging service for tracking all system-generated emails

import { supabase } from "@/lib/db";

export type EmailLogStatus = 'Pending' | 'Sent' | 'Delivered' | 'Failed' | 'Unknown';

export type EmailType =
    | 'welcome_client'
    | 'welcome_cpa'
    | 'welcome_service_center'
    | 'task_notification'
    | 'task_assigned'
    | 'task_updated'
    | 'message_notification'
    | 'document_notification'
    | 'stage_notification'
    | 'custom_email'
    | 'onboarding_task'
    | 'general';

export interface EmailLogEntry {
    recipientEmail: string;
    recipientName?: string;
    recipientRole?: 'CLIENT' | 'CPA' | 'SERVICE_CENTER' | null;
    relatedEntityType?: 'client' | 'cpa' | 'service_center' | null;
    relatedEntityId?: number | null;
    relatedEntityName?: string | null;
    emailType: EmailType;
    emailSubject: string;
    emailBodyPreview?: string;
    status: EmailLogStatus;
    statusMessage?: string;
    messageId?: string;
    metadata?: Record<string, any>;
}

export interface EmailLogRecord extends EmailLogEntry {
    id: number;
    createdAt: string;
    sentAt?: string;
    deliveredAt?: string;
    originalEmailId?: number;
    resendCount: number;
    lastResentAt?: string;
    resentBy?: string;
}

/**
 * Log an email to the database
 */
export async function logEmail(entry: EmailLogEntry): Promise<number | null> {
    try {
        // Truncate body preview to first 2000 chars to avoid bloat
        const bodyPreview = entry.emailBodyPreview
            ? entry.emailBodyPreview.substring(0, 2000)
            : null;

        const { data, error } = await supabase
            .from("email_logs")
            .insert({
                recipient_email: entry.recipientEmail,
                recipient_name: entry.recipientName || null,
                recipient_role: entry.recipientRole || null,
                related_entity_type: entry.relatedEntityType || null,
                related_entity_id: entry.relatedEntityId || null,
                related_entity_name: entry.relatedEntityName || null,
                email_type: entry.emailType,
                email_subject: entry.emailSubject,
                email_body_preview: bodyPreview,
                status: entry.status,
                status_message: entry.statusMessage || null,
                message_id: entry.messageId || null,
                metadata: entry.metadata || null,
                sent_at: entry.status === 'Sent' || entry.status === 'Delivered' ? new Date().toISOString() : null,
                created_at: new Date().toISOString()
            })
            .select("id")
            .single();

        if (error) throw error;

        const logId = data?.id;
        console.log(`📧 Email logged with ID: ${logId}`);
        return logId;
    } catch (error) {
        console.error("❌ Failed to log email:", error);
        return null;
    }
}

/**
 * Update an existing email log status
 */
export async function updateEmailLogStatus(
    logId: number,
    status: EmailLogStatus,
    statusMessage?: string,
    messageId?: string
): Promise<boolean> {
    try {
        const sentAt = (status === 'Sent' || status === 'Delivered') ? new Date().toISOString() : null;
        const deliveredAt = status === 'Delivered' ? new Date().toISOString() : null;

        const updateData: any = { status };
        if (statusMessage) updateData.status_message = statusMessage;
        if (messageId) updateData.message_id = messageId;
        if (sentAt) updateData.sent_at = sentAt;
        if (deliveredAt) updateData.delivered_at = deliveredAt;

        const { error } = await supabase
            .from("email_logs")
            .update(updateData)
            .eq("id", logId);

        if (error) throw error;

        console.log(`📧 Email log ${logId} updated to status: ${status}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to update email log ${logId}:`, error);
        return false;
    }
}

/**
 * Log a resend attempt
 */
export async function logResendAttempt(
    originalLogId: number,
    resentBy: string
): Promise<boolean> {
    try {
        // We first need to get the current resend count
        const { data: current, error: fetchError } = await supabase
            .from("email_logs")
            .select("resend_count")
            .eq("id", originalLogId)
            .single();

        if (fetchError) throw fetchError;

        const { error } = await supabase
            .from("email_logs")
            .update({
                resend_count: (current?.resend_count || 0) + 1,
                last_resent_at: new Date().toISOString(),
                resent_by: resentBy
            })
            .eq("id", originalLogId);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error(`❌ Failed to log resend attempt for ${originalLogId}:`, error);
        return false;
    }
}

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

export interface EmailLogsResponse {
    data: EmailLogRecord[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * Fetch email logs with filtering and pagination
 */
export async function fetchEmailLogs(filters: EmailLogFilters): Promise<EmailLogsResponse> {
    try {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from("email_logs")
            .select("*", { count: 'exact' });

        if (filters.recipientRole && filters.recipientRole !== 'all') {
            query = query.eq("recipient_role", filters.recipientRole);
        }

        if (filters.status && filters.status !== 'all') {
            query = query.eq("status", filters.status);
        }

        if (filters.emailType && filters.emailType !== 'all') {
            query = query.eq("email_type", filters.emailType);
        }

        if (filters.dateFrom) {
            query = query.gte("created_at", new Date(filters.dateFrom).toISOString());
        }

        if (filters.dateTo) {
            const endDate = new Date(filters.dateTo);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt("created_at", endDate.toISOString());
        }

        if (filters.search) {
            query = query.or(`recipient_email.ilike.%${filters.search}%,recipient_name.ilike.%${filters.search}%,email_subject.ilike.%${filters.search}%,related_entity_name.ilike.%${filters.search}%`);
        }

        const { data, count, error } = await query
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) throw error;

        const formattedData = (data || []).map(row => ({
            id: row.id,
            recipientEmail: row.recipient_email,
            recipientName: row.recipient_name,
            recipientRole: row.recipient_role,
            relatedEntityType: row.related_entity_type,
            relatedEntityId: row.related_entity_id,
            relatedEntityName: row.related_entity_name,
            emailType: row.email_type,
            emailSubject: row.email_subject,
            emailBodyPreview: row.email_body_preview,
            status: row.status,
            statusMessage: row.status_message,
            messageId: row.message_id,
            originalEmailId: row.original_email_id,
            resendCount: row.resend_count,
            lastResentAt: row.last_resent_at,
            resentBy: row.resent_by,
            createdAt: row.created_at,
            sentAt: row.sent_at,
            deliveredAt: row.delivered_at,
            metadata: row.metadata
        }));

        return {
            data: formattedData as EmailLogRecord[],
            total: count || 0,
            page,
            pageSize
        };
    } catch (error) {
        console.error("❌ Failed to fetch email logs:", error);
        return {
            data: [],
            total: 0,
            page: filters.page || 1,
            pageSize: filters.pageSize || 20
        };
    }
}

/**
 * Get a single email log by ID
 */
export async function getEmailLogById(id: number): Promise<EmailLogRecord | null> {
    try {
        const { data, error } = await supabase
            .from("email_logs")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
            id: data.id,
            recipientEmail: data.recipient_email,
            recipientName: data.recipient_name,
            recipientRole: data.recipient_role,
            relatedEntityType: data.related_entity_type,
            relatedEntityId: data.related_entity_id,
            relatedEntityName: data.related_entity_name,
            emailType: data.email_type,
            emailSubject: data.email_subject,
            emailBodyPreview: data.email_body_preview,
            status: data.status,
            statusMessage: data.status_message,
            messageId: data.message_id,
            originalEmailId: data.original_email_id,
            resendCount: data.resend_count,
            lastResentAt: data.last_resent_at,
            resentBy: data.resent_by,
            createdAt: data.created_at,
            sentAt: data.sent_at,
            deliveredAt: data.delivered_at,
            metadata: data.metadata
        } as EmailLogRecord;
    } catch (error) {
        console.error(`❌ Failed to get email log ${id}:`, error);
        return null;
    }
}
