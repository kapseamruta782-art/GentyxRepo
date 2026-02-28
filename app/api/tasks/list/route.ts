// app/api/tasks/list/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const { data, error } = await (clientId
      ? supabase
        .from("onboarding_tasks")
        .select(`
            id:task_id,
            stageId:stage_id,
            clientId:client_id,
            clientName:clients(client_name),
            title:task_title,
            assigneeRole:assigned_to_role,
            status,
            dueDate:due_date,
            created_at,
            documentRequired:document_required
          `)
        .eq("client_id", Number(clientId))
        .order("created_at", { ascending: false })
      : supabase
        .from("onboarding_tasks")
        .select(`
            id:task_id,
            stageId:stage_id,
            clientId:client_id,
            clientName:clients(client_name),
            title:task_title,
            assigneeRole:assigned_to_role,
            status,
            dueDate:due_date,
            created_at,
            documentRequired:document_required
          `)
        .order("created_at", { ascending: false }));

    if (error) throw error;

    // Flatten clientName if it's nested
    const flattened = data?.map((item: any) => ({
      ...item,
      clientName: item.clientName?.client_name || "Unknown",
    }));

    return NextResponse.json({
      success: true,
      data: flattened || [],
      total: flattened?.length || 0,
      page: 1,
      pageSize: flattened?.length || 0,
    });

  } catch (err: any) {
    console.error("GET /api/tasks/list error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
