// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { to, subject, body: emailBody, clientName } = body;

        if (!to || !subject || !emailBody) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: to, subject, body" },
                { status: 400 }
            );
        }

        // Replace template variables in the body
        let processedBody = emailBody;
        if (clientName) {
            processedBody = processedBody.replace(/\{\{clientName\}\}/gi, clientName);
            processedBody = processedBody.replace(/\{\{Client_Name\}\}/gi, clientName);
        }
        processedBody = processedBody.replace(/\{\{Company_Name\}\}/gi, "Legacy ClientHub");
        processedBody = processedBody.replace(/\{\{Support_Email\}\}/gi, "support@legacyclienthub.com");
        processedBody = processedBody.replace(/\{\{LC\}\}/gi, "Legacy ClientHub Team");

        // Send email using centralized service
        const result = await sendEmail({
            to,
            subject,
            html: processedBody,
            logging: {
                recipientName: clientName || undefined,
                emailType: 'custom_email',
                metadata: { source: 'api_send_email' }
            }
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                message: `Email sent successfully to ${to}`,
            });
        } else {
            return NextResponse.json(
                { success: false, error: result.error?.message || "Failed to send email" },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("Send email API error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to send email" },
            { status: 500 }
        );
    }
}
