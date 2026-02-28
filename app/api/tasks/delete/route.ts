// app/api/tasks/delete/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task_id } = body;

    if (!task_id) {
      return NextResponse.json(
        { success: false, error: "task_id is required" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // 1️⃣ Fetch clientId using task_id (before delete)
    // -----------------------------------------------------
    const { data: taskData, error: taskError } = await supabase
      .from("onboarding_tasks")
      .select("client_id")
      .eq("task_id", task_id)
      .maybeSingle();

    if (taskError) throw taskError;
    const clientId = taskData?.client_id;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------
    // 2️⃣ DELETE the task
    // -----------------------------------------------------
    const { error: deleteError } = await supabase
      .from("onboarding_tasks")
      .delete()
      .eq("task_id", task_id);

    if (deleteError) throw deleteError;

    // -----------------------------------------------------
    // 3️⃣ Recalculate client progress
    // -----------------------------------------------------
    try {
      if (clientId) {
        await calculateClientProgress(clientId);
      }
    } catch (progressError) {
      console.error("Progress calculation failed after delete:", progressError);
    }

    // Audit log
    try {
      logAudit({
        clientId: clientId || 0,
        action: AuditActions.TASK_DELETED,
        actorRole: "ADMIN",
        details: `Task #${task_id}`,
      });
    } catch (auditError) {
      console.error("Audit log failed after delete:", auditError);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("POST /api/tasks/delete error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
