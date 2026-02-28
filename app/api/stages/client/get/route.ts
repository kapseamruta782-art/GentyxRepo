// app/api/stages/client/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID required" },
        { status: 400 }
      );
    }

    const scId = Number(clientId);

    // 1. Fetch Stages
    const { data: stages, error: stagesError } = await supabase
      .from("client_stages")
      .select(`
        client_stage_id, 
        stage_name, 
        order_number, 
        is_required, 
        status, 
        start_date, 
        completed_at,
        document_required,
        document_mode
      `)
      .eq("client_id", scId)
      .order("order_number", { ascending: true });

    if (stagesError) throw stagesError;

    // 2. Fetch Subtasks
    const stageIds = (stages || []).map(s => s.client_stage_id);
    const { data: subtasks, error: subtasksError } = await supabase
      .from("client_stage_subtasks")
      .select(`
        client_stage_id,
        subtask_id,
        subtask_title,
        status,
        order_number,
        due_date,
        document_required,
        created_at
      `)
      .in("client_stage_id", stageIds)
      .order("order_number", { ascending: true });

    if (subtasksError) throw subtasksError;

    return NextResponse.json({
      success: true,
      data: stages || [],
      subtasks: subtasks || [],
    });

  } catch (err: any) {
    console.error("GET /api/stages/client/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch stages" },
      { status: 500 }
    );
  }
}
