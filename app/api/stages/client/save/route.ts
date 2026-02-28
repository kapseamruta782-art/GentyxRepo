// app/api/stages/client/save/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendOnboardingOverviewEmail } from "@/lib/email";

// Server-side stage status calculation
function computeFinalStageStatus(subtasks: any[]) {
  if (!subtasks || subtasks.length === 0) return "Not Started";

  const allCompleted = subtasks.every(
    (t) => (t.status || "").toLowerCase() === "completed"
  );

  if (allCompleted) return "Completed";

  return "In Progress";
}

// Helpers for safe DATE handling
function toISODate(d: any): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    console.log("STAGE SAVE API CALLED (Supabase)");

    const body = await req.json();
    const clientId = body.clientId;
    const sendEmailNotification = body.sendEmailNotification !== false;

    const stages = Array.isArray(body.stages)
      ? [...body.stages].sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    // 1. Fetch client details for email notification
    const { data: clientData, error: clientError } = await supabase
      .from("Clients")
      .select("client_name, primary_contact_name, primary_contact_email")
      .eq("client_id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;

    // 2. Clear old data
    // We'll delete subtasks first, then stages
    const { data: oldStages } = await supabase
      .from("client_stages")
      .select("client_stage_id")
      .eq("client_id", clientId);

    const oldStageIds = (oldStages || []).map(s => s.client_stage_id);

    if (oldStageIds.length > 0) {
      const { error: subDeleteError } = await supabase
        .from("client_stage_subtasks")
        .delete()
        .in("client_stage_id", oldStageIds);

      if (subDeleteError) throw subDeleteError;

      const { error: stageDeleteError } = await supabase
        .from("client_stages")
        .delete()
        .eq("client_id", clientId);

      if (stageDeleteError) throw stageDeleteError;
    }

    // 3. Insert new data
    let prevCompletionDate: string | null = null;

    for (const stage of stages) {
      const finalStatus = computeFinalStageStatus(stage.subtasks || []);
      const completedAt = finalStatus === "Completed"
        ? toISODate(stage.completed_at) || todayISO()
        : null;

      const startDateFromPayload = toISODate(stage.start_date);
      const startDate = startDateFromPayload ||
        (prevCompletionDate ? prevCompletionDate : null) ||
        (finalStatus === "In Progress" || finalStatus === "Completed" ? todayISO() : null);

      const { data: insertedStage, error: stageInsertError } = await supabase
        .from("client_stages")
        .insert({
          client_id: clientId,
          stage_name: stage.name,
          order_number: stage.order,
          is_required: stage.isRequired ? true : false,
          status: finalStatus,
          start_date: startDate,
          completed_at: completedAt,
          document_required: stage.document_required ? true : false,
          document_mode: stage.document_mode || 'stage',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (stageInsertError) throw stageInsertError;
      const stageId = insertedStage.client_stage_id;

      prevCompletionDate = completedAt;

      // Audit log
      if (finalStatus === "Completed") {
        logAudit({
          clientId,
          action: AuditActions.STAGE_COMPLETED,
          actorRole: "ADMIN",
          details: stage.name,
        });
      }

      // Insert subtasks
      if (stage.subtasks && stage.subtasks.length > 0) {
        const subtasksToInsert = stage.subtasks.map((sub: any, index: number) => ({
          client_stage_id: stageId,
          subtask_title: (sub.title || "").trim(),
          status: sub.status || "Not Started",
          order_number: index + 1,
          due_date: sub.due_date || null,
          document_required: sub.document_required ? true : false,
          created_at: new Date().toISOString()
        }));

        const { error: subtasksInsertError } = await supabase
          .from("client_stage_subtasks")
          .insert(subtasksToInsert);

        if (subtasksInsertError) throw subtasksInsertError;
      }
    }

    // 4. Recalculate Progress
    await calculateClientProgress(clientId).catch(err => console.error("⚠️ Progress sync failed:", err));

    // 5. Send Notification
    if (sendEmailNotification && clientData?.primary_contact_email && stages.length > 0) {
      const formattedStages = stages.map((stage: any) => ({
        name: stage.name,
        status: computeFinalStageStatus(stage.subtasks || []),
        subtasks: (stage.subtasks || []).map((sub: any) => ({
          title: sub.title,
          status: sub.status || 'Not Started',
          due_date: sub.due_date,
        }))
      }));

      sendOnboardingOverviewEmail({
        recipientEmail: clientData.primary_contact_email,
        recipientName: clientData.primary_contact_name || clientData.client_name,
        clientName: clientData.client_name,
        stages: formattedStages,
      }).catch(err => console.error("⚠️ Email failed:", err));
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("SAVE STAGE ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save stages" },
      { status: 500 }
    );
  }
}
