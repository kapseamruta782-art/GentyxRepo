// lib/progress.ts
import { supabase } from "@/lib/db";

// ---------------------------------------------------------
// Fetch all stages + tasks for a client
// ---------------------------------------------------------
export async function fetchClientStagesAndTasks(clientId: number) {
  const { data: stages, error: stagesError } = await supabase
    .from("client_stages")
    .select("*")
    .eq("client_id", clientId)
    .order("order_number", { ascending: true });

  if (stagesError) throw stagesError;

  // Tasks are now subtasks linked via client_stage_id
  const stageIds = (stages || []).map(s => s.client_stage_id);
  const { data: tasks, error: tasksError } = await supabase
    .from("client_stage_subtasks")
    .select("*")
    .in("client_stage_id", stageIds)
    .order("order_number", { ascending: true });

  if (tasksError) throw tasksError;

  return {
    stages: stages || [],
    tasks: tasks || []
  };
}

// ---------------------------------------------------------
// Calculate stage completion: Completed if ALL tasks are done
// ---------------------------------------------------------
function calculateStageStatus(tasksForStage: any[]) {
  if (tasksForStage.length === 0) return "Not Started";

  const allCompleted = tasksForStage.every(t => (t.status || "").toLowerCase() === "completed");

  if (allCompleted) return "Completed";

  // Check if any is in progress or completed
  const anyStarted = tasksForStage.some(t => {
    const s = (t.status || "").toLowerCase();
    return s === "completed" || s === "in progress";
  });

  if (anyStarted) return "In Progress";

  return "Not Started";
}

// ---------------------------------------------------------
// MAIN LOGIC — Calculate overall client progress
// ---------------------------------------------------------
export async function calculateClientProgress(clientId: number) {
  const { stages, tasks } = await fetchClientStagesAndTasks(clientId);

  if (stages.length === 0) {
    // No stages found, ensure progress is 0
    await updateClientProgressInDb(clientId, 0, null, null, "Not Started");
    return { progress: 0, nextStage: null };
  }

  let totalStages = stages.length;
  let completedStages = 0;

  for (const stage of stages) {
    const stageTasks = tasks.filter(t => t.client_stage_id === stage.client_stage_id);

    // Determine status purely from subtasks
    const calculatedStatus = calculateStageStatus(stageTasks);

    if (calculatedStatus === "Completed") completedStages++;

    // Update stage status in DB if it differs
    if (stage.status !== calculatedStatus) {
      const { error: updateError } = await supabase
        .from("client_stages")
        .update({
          status: calculatedStatus,
          updated_at: new Date().toISOString()
        })
        .eq("client_stage_id", stage.client_stage_id);

      if (updateError) console.error(`⚠️ Failed to update stage ${stage.client_stage_id} status:`, updateError.message);

      // Update local object for next step
      stage.status = calculatedStatus;
    }
  }

  // Calculate client progress %
  const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Determine the NEXT ACTIVE STAGE (First non-completed stage)
  const nextStage = stages.find(s => s.status !== "Completed") || null;
  const clientStatus = progress === 100 ? "Completed" : (progress > 0 ? "In Progress" : "Not Started");

  await updateClientProgressInDb(clientId, progress, nextStage?.client_stage_id || null, nextStage?.stage_name || null, clientStatus);

  return {
    progress,
    nextStage
  };
}

async function updateClientProgressInDb(clientId: number, progress: number, stageId: number | null, stageName: string | null, status: string) {
  const { error } = await supabase
    .from("Clients")
    .update({
      progress: progress,
      stage_id: stageId,
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq("client_id", clientId);

  if (error) console.error(`⚠️ Failed to update client ${clientId} progress:`, error.message);
}
