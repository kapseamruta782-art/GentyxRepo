// app/api/clients/[id]/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const clientId = Number(id);

    if (!clientId || Number.isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    // 1. Fetch Client with relations
    const { data: client, error: clientError } = await supabase
      .from("Clients")
      .select(`
        *,
        service_centers(center_name, email),
        cpa_centers(cpa_name, email)
      `)
      .eq("client_id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Client Stages
    const { data: stages, error: stagesError } = await supabase
      .from("client_stages")
      .select("*")
      .eq("client_id", clientId)
      .order("order_number", { ascending: true });

    if (stagesError) throw stagesError;

    // 3. Fetch Subtasks for these stages
    const stageIds = (stages || []).map(s => s.client_stage_id);
    const { data: subtasks, error: subtasksError } = await supabase
      .from("client_stage_subtasks")
      .select("*")
      .in("client_stage_id", stageIds);

    if (subtasksError) throw subtasksError;

    // 4. Calculate Progress (Matching legacy SQL logic)
    // completed_stages = stages where (status = 'Completed' OR no subtasks are NOT 'Completed')
    const totalStages = stages?.length || 0;
    const completedStagesList = (stages || []).filter(stage => {
      if (stage.status === "Completed") return true;

      const stageSubtasks = (subtasks || []).filter(st => st.client_stage_id === stage.client_stage_id);
      if (stageSubtasks.length === 0) return false; // If no subtasks and not marked completed, it's not completed

      return stageSubtasks.every(st => st.status === "Completed");
    });

    const completedStagesCount = completedStagesList.length;
    const progress = totalStages === 0 ? 0 : (completedStagesCount * 100) / totalStages;

    // 5. Determine Current Stage (Matching legacy TOP 1 with ORDER BY order_number)
    const firstStage = stages?.[0];

    // 6. Fetch Associated Users
    const { data: associatedUsers, error: usersError } = await supabase
      .from("client_users")
      .select(`
        id,
        user_name,
        email,
        role,
        phone,
        created_at
      `)
      .eq("client_id", clientId)
      .order("id", { ascending: true });

    if (usersError) throw usersError;

    // 7. Format Response
    const responseData = {
      client_id: client.client_id,
      client_name: client.client_name,
      code: client.code,
      client_status: client.client_status,
      status: client.client_status,
      sla_number: client.sla_number,
      primary_contact_first_name: client.primary_contact_first_name,
      primary_contact_last_name: client.primary_contact_last_name,
      primary_contact_name: client.primary_contact_name,
      primary_contact_email: client.primary_contact_email,
      primary_contact_phone: client.primary_contact_phone,
      created_at: client.created_at,
      updated_at: client.updated_at,
      service_center_id: client.service_center_id,
      service_center_name: client.service_centers?.center_name,
      service_center_email: client.service_centers?.email,
      cpa_id: client.cpa_id,
      cpa_name: client.cpa_centers?.cpa_name,
      cpa_email: client.cpa_centers?.email,
      stage_id: firstStage?.client_stage_id,
      stage_name: firstStage?.stage_name,
      total_stages: totalStages,
      completed_stages: completedStagesCount,
      progress: progress,
      is_archived: client.is_archived || false,
      associated_users: (associatedUsers || []).map(u => ({
        id: u.id,
        name: u.user_name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        created_at: u.created_at
      }))
    };

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (err: any) {
    console.error("GET /api/clients/[id]/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch client" },
      { status: 500 }
    );
  }
}
