// app/api/email-templates/create/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { name, subject, body } = await req.json();

    const { error } = await supabase
      .from("email_templates")
      .insert({
        name,
        subject,
        body,
        is_default: false,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/email-templates/create error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create email template" },
      { status: 500 }
    );
  }
}
