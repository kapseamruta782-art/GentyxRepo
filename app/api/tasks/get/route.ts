// app/api/tasks/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q")?.toLowerCase();
    const taskType = searchParams.get("taskType"); // ONBOARDING | ASSIGNED
    const assignedRole = searchParams.get("assignedRole");
    const dueFrom = searchParams.get("dueFrom");
    const dueTo = searchParams.get("dueTo");
    const clientId = searchParams.get("clientId");
    const taskId = searchParams.get("taskId");

    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);
    const offset = (page - 1) * pageSize;

    // ─── QUERY 1: ONBOARDING TASKS ───
    // We avoid complex nested joins to stay robust against missing FKs
    let onboardingQuery = supabase
      .from("client_stage_subtasks")
      .select(`
        *,
        client_stages!inner(*)
      `);

    if (clientId) {
      onboardingQuery = onboardingQuery.eq("client_stages.client_id", Number(clientId));
    }
    if (dueFrom) onboardingQuery = onboardingQuery.gte("due_date", dueFrom);
    if (dueTo) onboardingQuery = onboardingQuery.lte("due_date", dueTo);

    // ─── QUERY 2: ASSIGNED TASKS ───
    let assignedQuery = supabase
      .from("onboarding_tasks")
      .select(`*`);

    if (clientId) assignedQuery = assignedQuery.eq("client_id", Number(clientId));
    if (dueFrom) assignedQuery = assignedQuery.gte("due_date", dueFrom);
    if (dueTo) assignedQuery = assignedQuery.lte("due_date", dueTo);

    const [onboardingRes, assignedRes] = await Promise.all([
      taskType === "ASSIGNED" ? ({ data: [], error: null } as any) : onboardingQuery,
      taskType === "ONBOARDING" ? ({ data: [], error: null } as any) : assignedQuery
    ]);

    if (onboardingRes.error) {
      console.error("Onboarding Tasks Error:", onboardingRes.error);
      // Fallback or handle error
    }
    if (assignedRes.error) {
      console.error("Assigned Tasks Error:", assignedRes.error);
    }

    // ─── FETCH CLIENT NAMES SEPARATELY TO ENSURE RELIABILITY ───
    const allClientIds = new Set<number>();
    (onboardingRes.data || []).forEach((t: any) => allClientIds.add(t.client_stages.client_id));
    (assignedRes.data || []).forEach((t: any) => allClientIds.add(t.client_id));

    const { data: clientsData } = await supabase
      .from("Clients")
      .select("client_id, client_name")
      .in("client_id", Array.from(allClientIds));

    const clientMap = new Map(clientsData?.map(c => [c.client_id, c.client_name]));

    // ─── MAP AND FLATTEN ONBOARDING TASKS ───
    const onboardingTasks = (onboardingRes.data || []).map((t: any) => ({
      id: t.subtask_id,
      clientId: t.client_stages.client_id,
      clientName: clientMap.get(t.client_stages.client_id) || "Unknown Client",
      title: t.subtask_title,
      taskType: "ONBOARDING",
      assignedRole: "CLIENT",
      status: t.status,
      dueDate: t.due_date,
      sourceStage: t.client_stages.stage_name, // Assuming stage_name is on client_stages
      createdAt: t.created_at,
      documentRequired: t.document_required || 0
    }));

    // ─── MAP AND FLATTEN ASSIGNED TASKS ───
    const assignedTasks = (assignedRes.data || []).map((t: any) => ({
      id: t.task_id,
      clientId: t.client_id,
      clientName: clientMap.get(t.client_id) || "Unknown Client",
      title: t.task_title,
      taskType: "ASSIGNED",
      assignedRole: t.assigned_to_role,
      status: t.status,
      dueDate: t.due_date,
      sourceStage: null,
      createdAt: t.created_at,
      documentRequired: t.document_required ?? 1
    }));

    // Merge and manual filter
    let allTasks = [...onboardingTasks, ...assignedTasks];

    if (taskId) {
      allTasks = allTasks.filter(t => String(t.id) === taskId);
    }
    if (assignedRole) {
      allTasks = allTasks.filter(t => t.assignedRole === assignedRole);
    }
    if (q) {
      allTasks = allTasks.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.clientName?.toLowerCase().includes(q)
      );
    }

    allTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginatedData = allTasks.slice(offset, offset + pageSize);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      page,
      pageSize,
      total: allTasks.length
    });

  } catch (err: any) {
    console.error("GET /api/tasks/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}