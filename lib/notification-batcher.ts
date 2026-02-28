// lib/notification-batcher.ts
// Batches notifications to avoid sending too many emails when multiple actions happen quickly

interface PendingDocumentNotification {
    documentName: string;
    folderPath?: string;
    timestamp: Date;
}

interface PendingFolderNotification {
    folderName: string;
    parentPath?: string;
    timestamp: Date;
}

interface PendingNotificationBatch {
    uploaderName: string;
    uploaderRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER' | 'ADMIN';
    clientName: string;
    clientId: number | string;
    documents: PendingDocumentNotification[];
    folders: PendingFolderNotification[];
    timer: NodeJS.Timeout | null;
}

// In-memory store for pending notifications (keyed by clientId)
const pendingBatches: Map<string, PendingNotificationBatch> = new Map();

// How long to wait after last activity before sending the batch (in ms)
const BATCH_DELAY_MS = 30000; // 30 seconds

/**
 * Queue a document upload notification for batching
 */
export function queueDocumentUploadNotification(params: {
    clientId: number | string;
    clientName: string;
    uploaderName: string;
    uploaderRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER' | 'ADMIN';
    documentName: string;
    folderPath?: string;
}): void {
    const key = `doc-${params.clientId}`;

    let batch = pendingBatches.get(key);

    if (!batch) {
        batch = {
            uploaderName: params.uploaderName,
            uploaderRole: params.uploaderRole,
            clientName: params.clientName,
            clientId: params.clientId,
            documents: [],
            folders: [],
            timer: null,
        };
        pendingBatches.set(key, batch);
    }

    // Add the document to the batch
    batch.documents.push({
        documentName: params.documentName,
        folderPath: params.folderPath,
        timestamp: new Date(),
    });

    console.log(`📋 Queued document notification: ${params.documentName} (${batch.documents.length} pending for client ${params.clientId})`);

    // Reset the timer
    if (batch.timer) {
        clearTimeout(batch.timer);
    }

    batch.timer = setTimeout(() => {
        sendBatchedDocumentNotification(key);
    }, BATCH_DELAY_MS);
}

/**
 * Queue a folder creation notification for batching
 */
export function queueFolderCreatedNotification(params: {
    clientId: number | string;
    clientName: string;
    creatorName: string;
    creatorRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER' | 'ADMIN';
    folderName: string;
    parentPath?: string;
}): void {
    const key = `folder-${params.clientId}`;

    let batch = pendingBatches.get(key);

    if (!batch) {
        batch = {
            uploaderName: params.creatorName,
            uploaderRole: params.creatorRole,
            clientName: params.clientName,
            clientId: params.clientId,
            documents: [],
            folders: [],
            timer: null,
        };
        pendingBatches.set(key, batch);
    }

    // Add the folder to the batch
    batch.folders.push({
        folderName: params.folderName,
        parentPath: params.parentPath,
        timestamp: new Date(),
    });

    console.log(`📋 Queued folder notification: ${params.folderName} (${batch.folders.length} pending for client ${params.clientId})`);

    // Reset the timer
    if (batch.timer) {
        clearTimeout(batch.timer);
    }

    batch.timer = setTimeout(() => {
        sendBatchedFolderNotification(key);
    }, BATCH_DELAY_MS);
}

/**
 * Send batched document upload notification
 */
async function sendBatchedDocumentNotification(key: string): Promise<void> {
    const batch = pendingBatches.get(key);
    if (!batch || batch.documents.length === 0) {
        pendingBatches.delete(key);
        return;
    }

    // Remove the batch from pending
    pendingBatches.delete(key);

    console.log(`📧 Sending batched document notification for ${batch.documents.length} documents (Uploader: ${batch.uploaderRole})`);

    try {
        const {
            getAdminsWithNotificationsEnabled,
            getClientEmail,
            sendAdminBatchDocumentUploadNotification,
            sendClientBatchDocumentUploadNotification
        } = await import("@/lib/email");

        if (batch.uploaderRole === "ADMIN") {
            // Notify CLIENT
            const client = await getClientEmail(batch.clientId);
            if (!client) {
                console.warn(`⚠️ No client email found for ID ${batch.clientId} - skipping notification`);
                return;
            }

            await sendClientBatchDocumentUploadNotification({
                clientEmail: client.email,
                clientName: client.name,
                uploaderName: batch.uploaderName || "Admin", // Fallback if name missing
                documents: batch.documents.map(d => ({
                    name: d.documentName,
                    folder: d.folderPath,
                })),
            });
            console.log(`✅ Batched notification sent to CLIENT (${client.email}) for ${batch.documents.length} documents`);

        } else {
            // Notify ALL ADMINs
            const admins = await getAdminsWithNotificationsEnabled();
            if (admins.length === 0) {
                console.warn("⚠️ No admins found - skipping batch notification");
                return;
            }

            // Send to each admin
            for (const admin of admins) {
                try {
                    await sendAdminBatchDocumentUploadNotification({
                        adminEmail: admin.email,
                        adminName: admin.name,
                        uploaderName: batch.uploaderName,
                        uploaderRole: batch.uploaderRole,
                        documents: batch.documents.map(d => ({
                            name: d.documentName,
                            folder: d.folderPath,
                        })),
                        clientName: batch.clientName,
                        clientId: batch.clientId,
                    });
                    console.log(`✅ Batched notification sent to ADMIN (${admin.email}) for ${batch.documents.length} documents`);
                } catch (err) {
                    console.error(`❌ Failed to send to admin ${admin.email}:`, err);
                }
            }
            console.log(`📧 Notified ${admins.length} admin(s) about ${batch.documents.length} document upload(s)`);
        }

    } catch (error) {
        console.error("❌ Failed to send batched document notification:", error);
    }
}

/**
 * Send batched folder creation notification
 */
async function sendBatchedFolderNotification(key: string): Promise<void> {
    const batch = pendingBatches.get(key);
    if (!batch || batch.folders.length === 0) {
        pendingBatches.delete(key);
        return;
    }

    // Remove the batch from pending
    pendingBatches.delete(key);

    console.log(`📧 Sending batched folder notification for ${batch.folders.length} folders (Creator: ${batch.uploaderRole})`);

    try {
        const {
            getAdminsWithNotificationsEnabled,
            getClientEmail,
            sendAdminBatchFolderCreatedNotification,
            sendClientBatchFolderCreatedNotification
        } = await import("@/lib/email");

        if (batch.uploaderRole === "ADMIN") {
            // Notify CLIENT
            const client = await getClientEmail(batch.clientId);
            if (!client) {
                console.warn(`⚠️ No client email found for ID ${batch.clientId} - skipping notification`);
                return;
            }

            await sendClientBatchFolderCreatedNotification({
                clientEmail: client.email,
                clientName: client.name,
                creatorName: batch.uploaderName || "Admin",
                folders: batch.folders.map(f => ({
                    name: f.folderName,
                    parentPath: f.parentPath,
                })),
            });
            console.log(`✅ Batched notification sent to CLIENT (${client.email}) for ${batch.folders.length} folders`);

        } else {
            // Notify ALL ADMINs
            const admins = await getAdminsWithNotificationsEnabled();
            if (admins.length === 0) {
                console.warn("⚠️ No admins found - skipping batch notification");
                return;
            }

            // Send to each admin
            for (const admin of admins) {
                try {
                    await sendAdminBatchFolderCreatedNotification({
                        adminEmail: admin.email,
                        adminName: admin.name,
                        creatorName: batch.uploaderName,
                        creatorRole: batch.uploaderRole,
                        folders: batch.folders.map(f => ({
                            name: f.folderName,
                            parentPath: f.parentPath,
                        })),
                        clientName: batch.clientName,
                        clientId: batch.clientId,
                    });
                    console.log(`✅ Batched notification sent to ADMIN (${admin.email}) for ${batch.folders.length} folders`);
                } catch (err) {
                    console.error(`❌ Failed to send to admin ${admin.email}:`, err);
                }
            }
            console.log(`📧 Notified ${admins.length} admin(s) about ${batch.folders.length} folder creation(s)`);
        }
    } catch (error) {
        console.error("❌ Failed to send batched folder notification:", error);
    }
}
