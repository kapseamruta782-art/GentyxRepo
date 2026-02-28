// app/api/notifications/task/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendTaskNotificationEmail, sendOnboardingTaskNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("📧 Task notification request (Supabase):", body);

        const {
            taskId,
            taskTitle,
            taskDescription,
            dueDate,
            clientId,
            assignedToRole,
            notificationType = "assigned", // 'assigned' | 'updated'
            taskType = "ASSIGNED", // 'ASSIGNED' | 'ONBOARDING'
            stageName, // For onboarding tasks
            updatedFields, // For updates
            assignedByName,
        } = body;

        // Validate required fields
        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "clientId is required" },
                { status: 400 }
            );
        }

        if (!taskTitle) {
            return NextResponse.json(
                { success: false, error: "taskTitle is required" },
                { status: 400 }
            );
        }

        if (!assignedToRole) {
            return NextResponse.json(
                { success: false, error: "assignedToRole is required" },
                { status: 400 }
            );
        }

        // 1. Fetch Client Details with relations
        const { data: client, error: clientError } = await supabase
            .from("Clients")
            .select(`
                client_id,
                client_name,
                primary_contact_name,
                primary_contact_email,
                cpa_id,
                service_center_id,
                cpa_centers ( cpa_name, email ),
                service_centers ( center_name, email )
            `)
            .eq("client_id", clientId)
            .maybeSingle();

        if (clientError) throw clientError;

        if (!client) {
            return NextResponse.json(
                { success: false, error: "Client not found" },
                { status: 404 }
            );
        }

        // 2. Determine Recipient
        let recipientEmail: string | null = null;
        let recipientName: string = "";
        let recipientRole: "CLIENT" | "CPA" | "SERVICE_CENTER" = "CLIENT";

        switch (assignedToRole.toUpperCase()) {
            case "CLIENT":
                recipientEmail = client.primary_contact_email;
                recipientName = client.primary_contact_name || client.client_name;
                recipientRole = "CLIENT";
                break;

            case "CPA":
                recipientEmail = client.cpa_centers?.email;
                recipientName = client.cpa_centers?.cpa_name || "CPA";
                recipientRole = "CPA";
                break;

            case "SERVICE_CENTER":
                recipientEmail = client.service_centers?.email;
                recipientName = client.service_centers?.center_name || "Service Center";
                recipientRole = "SERVICE_CENTER";
                break;

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown assignedToRole: ${assignedToRole}` },
                    { status: 400 }
                );
        }

        if (!recipientEmail) {
            console.warn(`⚠️ No email found for ${assignedToRole} role`);
            return NextResponse.json({
                success: false,
                error: `No email address found for ${assignedToRole}.`,
                skipped: true,
            });
        }

        console.log(`📧 Sending ${notificationType} notification to ${recipientRole}: ${recipientEmail}`);

        // 3. Send Email
        let emailResult;

        if (taskType === "ONBOARDING" && stageName) {
            emailResult = await sendOnboardingTaskNotificationEmail({
                recipientEmail,
                recipientName,
                recipientRole,
                stageName,
                subtaskTitle: taskTitle,
                clientName: client.client_name,
                notificationType: notificationType as any,
                dueDate,
                assignedByName,
            });
        } else {
            emailResult = await sendTaskNotificationEmail({
                recipientEmail,
                recipientName,
                recipientRole,
                taskTitle,
                taskDescription,
                dueDate,
                clientName: client.client_name,
                notificationType: notificationType as any,
                updatedFields,
                assignedByName,
            });
        }

        if (emailResult.success) {
            console.log(`✅ Task notification email sent successfully to ${recipientEmail}`);
            return NextResponse.json({
                success: true,
                message: `Notification sent to ${recipientRole} (${recipientEmail})`,
                messageId: emailResult.messageId,
            });
        } else {
            console.error(`❌ Failed to send task notification email:`, emailResult.error);
            return NextResponse.json(
                { success: false, error: emailResult.error || "Failed to send notification email" },
                { status: 500 }
            );
        }

    } catch (err: any) {
        console.error("POST /api/notifications/task error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to send task notification" },
            { status: 500 }
        );
    }
}
