// app/api/default-stages/list/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: "templateId required" },
        { status: 400 }
      );
    }

    const tId = Number(templateId);

    // 1. Fetch default stages
    const { data: stages, error: stagesError } = await supabase
      .from("default_stages")
      .select("*")
      .eq("template_id", tId)
      .order("order_number", { ascending: true });

    if (stagesError) throw stagesError;

    if (!stages || stages.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 2. Fetch default stage subtasks
    const stageIds = stages.map((s: any) => s.default_stage_id);
    const { data: subtasks, error: subtasksError } = await supabase
      .from("default_stage_subtasks")
      .select("*")
      .in("default_stage_id", stageIds)
      .order("order_number", { ascending: true });

    if (subtasksError) throw subtasksError;

    // 3. Merge subtasks into stages
    const data = stages.map((s: any) => ({
      ...s,
      subtasks: (subtasks || []).filter((st: any) => st.default_stage_id === s.default_stage_id),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/default-stages/list error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch default stages" },
      { status: 500 }
    );
  }
}
