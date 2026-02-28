// app/api/email-templates/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const { id, name, subject, body } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("email_templates")
      .update({
        name,
        subject,
        body,
        updated_at: new Date().toISOString()
      })
      .eq("template_id", Number(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Email template updated successfully"
    });

  } catch (error: any) {
    console.error("Email template update error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update email template" },
      { status: 500 }
    );
  }
}
