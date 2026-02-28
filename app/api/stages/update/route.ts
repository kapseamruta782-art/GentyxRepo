// app/api/stages/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, stageName } = body;

    if (!clientId || !stageName) {
      return NextResponse.json(
        { success: false, error: "clientId and stageName are required" },
        { status: 400 }
      );
    }

    // 1. Reset all stages to Not Started
    const { error: resetError } = await supabase
      .from("client_stages")
      .update({ status: 'Not Started' })
      .eq("client_id", clientId);

    if (resetError) throw resetError;

    // 2. Set the selected stage to In Progress
    const { error: updateError } = await supabase
      .from("client_stages")
      .update({ status: 'In Progress' })
      .eq("client_id", clientId)
      .eq("stage_name", stageName);

    if (updateError) throw updateError;

    // Audit log
    logAudit({
      clientId,
      action: AuditActions.STAGE_STARTED,
      actorRole: "ADMIN",
      details: stageName,
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("POST /api/stages/update error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update stage" },
      { status: 500 }
    );
  }
}
