// app/api/default-stages/save/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { templateId, stages } = await req.json();

    if (!templateId || !Array.isArray(stages)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 }
      );
    }

    const tId = Number(templateId);

    // 1. Delete old subtasks and stages
    // First find old stage IDs to delete their subtasks
    const { data: oldStages, error: fetchError } = await supabase
      .from("default_stages")
      .select("default_stage_id")
      .eq("template_id", tId);

    if (fetchError) throw fetchError;
    const oldStageIds = (oldStages || []).map(s => s.default_stage_id);

    if (oldStageIds.length > 0) {
      const { error: subDeleteError } = await supabase
        .from("default_stage_subtasks")
        .delete()
        .in("default_stage_id", oldStageIds);

      if (subDeleteError) throw subDeleteError;

      const { error: stageDeleteError } = await supabase
        .from("default_stages")
        .delete()
        .eq("template_id", tId);

      if (stageDeleteError) throw stageDeleteError;
    }

    // 2. Insert new data
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];

      const { data: insertedStage, error: stageInsertError } = await supabase
        .from("default_stages")
        .insert({
          template_id: tId,
          stage_name: s.stage_name,
          order_number: i + 1,
          is_required: s.is_required ?? false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (stageInsertError) throw stageInsertError;
      const newStageId = insertedStage.default_stage_id;

      if (s.subtasks && Array.isArray(s.subtasks)) {
        const subtasksToInsert = s.subtasks.map((st: any, index: number) => ({
          default_stage_id: newStageId,
          title: st.title || "",
          order_number: index + 1,
          status: 'Not Started',
          created_at: new Date().toISOString()
        }));

        const { error: subtasksInsertError } = await supabase
          .from("default_stage_subtasks")
          .insert(subtasksToInsert);

        if (subtasksInsertError) throw subtasksInsertError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/default-stages/save error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save default stages" },
      { status: 500 }
    );
  }
}
