// app/api/stages/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = Number(searchParams.get("clientId"));

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    // 1. Fetch Client Stages
    const { data: stages, error: stagesError } = await supabase
      .from("client_stages")
      .select("*")
      .eq("client_id", clientId)
      .order("order_number", { ascending: true });

    if (stagesError) throw stagesError;

    // 2. Fetch Tasks (onboarding_tasks)
    const { data: tasks, error: tasksError } = await supabase
      .from("onboarding_tasks")
      .select("*")
      .eq("client_id", clientId)
      .order("order_number", { ascending: true });

    if (tasksError) throw tasksError;

    // 3. Group tasks under stage_id
    const stagesWithTasks = (stages || []).map(stage => ({
      ...stage,
      tasks: (tasks || []).filter(t => t.stage_id === stage.client_stage_id),
    }));

    return NextResponse.json({
      success: true,
      data: stagesWithTasks
    });

  } catch (err: any) {
    console.error("GET /api/stages/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch stages" },
      { status: 500 }
    );
  }
}
