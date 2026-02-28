// app/api/test-email/route.ts
import { sendEmail } from "@/lib/email";
import { supabase } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        // 1. Fetch current admin email from Supabase
        const { data: adminSettings, error: adminError } = await supabase
            .from("AdminSettings")
            .select("email")
            .maybeSingle();

        if (adminError) throw adminError;

        if (!adminSettings?.email) {
            return NextResponse.json({ error: "No admin found in AdminSettings table" }, { status: 404 });
        }

        const dbEmail = adminSettings.email;

        // 2. Send email to the address found in the DB
        const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>Supabase Verification: Admin Email</h1>
        <p>This email was sent to the address currently stored in your <strong>AdminSettings</strong> Supabase table.</p>
        <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin:0; font-weight:bold; color: #5a1f2d;">Stored Email: ${dbEmail}</p>
        </div>
        <p>✅ If you are reading this, your Supabase configuration is working correctly and the system is using your testing email.</p>
        <hr />
        <p style="font-size: 12px; color: #666;">Sage ClientHub Verification</p>
      </div>
    `;

        const result = await sendEmail({
            to: dbEmail,
            subject: "Verification: Supabase Database Email Successful",
            html,
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Email sent to database address: ${dbEmail}`,
                messageId: result.messageId
            });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error("POST /api/test-email error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to send test email" }, { status: 500 });
    }
}
