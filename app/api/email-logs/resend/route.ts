// app/api/email-logs/resend/route.ts
// API endpoint for resending a logged email

import { NextResponse } from "next/server";
import { getEmailLogById, logResendAttempt } from "@/lib/email-logger";
import {
    sendClientWelcomeEmail,
    sendCpaWelcomeEmail,
    sendServiceCenterWelcomeEmail,
} from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { emailLogId, adminEmail } = body;

        if (!emailLogId) {
            return NextResponse.json(
                { success: false, error: "Email log ID is required" },
                { status: 400 }
            );
        }

        // Get the original email log
        const originalLog = await getEmailLogById(emailLogId);

        if (!originalLog) {
            return NextResponse.json(
                { success: false, error: "Email log not found" },
                { status: 404 }
            );
        }

        console.log("[Resend] Processing email:", {
            id: originalLog.id,
            type: originalLog.emailType,
            role: originalLog.recipientRole,
            email: originalLog.recipientEmail,
            name: originalLog.recipientName,
        });

        let result: { success: boolean; error?: any; messageId?: string };

        // Regenerate and resend the appropriate email based on type
        const emailType = originalLog.emailType;
        const recipientRole = originalLog.recipientRole;
        const recipientEmail = originalLog.recipientEmail;
        const recipientName = originalLog.recipientName || "User";
        const metadata = originalLog.metadata || {};

        // Handle welcome emails by regenerating them with the proper functions
        if (emailType?.includes("welcome") || emailType === "welcome_client" || emailType === "welcome_cpa" || emailType === "welcome_service_center") {
            // Determine which welcome email to send based on role
            if (recipientRole === "CLIENT" || emailType === "welcome_client") {
                console.log("[Resend] Resending CLIENT welcome email to:", recipientEmail);
                result = await sendClientWelcomeEmail(
                    recipientEmail,
                    recipientName,
                    metadata.clientName || originalLog.relatedEntityName,
                    metadata.code
                );
            } else if (recipientRole === "CPA" || emailType === "welcome_cpa") {
                console.log("[Resend] Resending CPA welcome email to:", recipientEmail);
                result = await sendCpaWelcomeEmail(
                    recipientEmail,
                    recipientName,
                    metadata.cpaCode
                );
            } else if (recipientRole === "SERVICE_CENTER" || emailType === "welcome_service_center") {
                console.log("[Resend] Resending SERVICE_CENTER welcome email to:", recipientEmail);
                result = await sendServiceCenterWelcomeEmail(
                    recipientEmail,
                    recipientName,
                    metadata.centerCode
                );
            } else {
                // Unknown welcome email type, try to infer from metadata
                console.log("[Resend] Unknown welcome type, defaulting to CLIENT");
                result = await sendClientWelcomeEmail(
                    recipientEmail,
                    recipientName,
                    metadata.clientName || originalLog.relatedEntityName,
                    metadata.code
                );
            }
        } else {
            // For non-welcome emails, we would need different logic
            // For now, return an error explaining we can only resend welcome emails
            return NextResponse.json(
                {
                    success: false,
                    error: `Resending "${emailType}" emails is not currently supported. Only welcome emails can be resent.`,
                },
                { status: 400 }
            );
        }

        // Update the original log's resend tracking
        await logResendAttempt(emailLogId, adminEmail || "Admin");

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Welcome email resent successfully to ${recipientEmail}`,
                messageId: result.messageId,
            });
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error?.message || "Failed to resend email",
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("POST /api/email-logs/resend error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to resend email" },
            { status: 500 }
        );
    }
}
