// app/api/reports/get/route.ts

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      fromDate = null,
      toDate = null,
      serviceCenter = null,
      cpa = null,
      stage = null,
      status = null,
    } = body;

    // 1. Fetch Clients with filters
    let clientQuery = supabase
      .from("Clients")
      .select(`
        client_id,
        client_name,
        code,
        client_status,
        stage_id,
        progress,
        created_at,
        service_center_id,
        cpa_id,
        onboarding_stages(stage_name),
        service_centers(center_name),
        cpa_centers(cpa_name)
      `);

    if (fromDate) clientQuery = clientQuery.gte("created_at", fromDate);
    if (toDate) clientQuery = clientQuery.lte("created_at", toDate);
    if (serviceCenter) clientQuery = clientQuery.eq("service_center_id", serviceCenter);
    if (cpa) clientQuery = clientQuery.eq("cpa_id", cpa);
    if (stage) clientQuery = clientQuery.eq("stage_id", stage);
    if (status) clientQuery = clientQuery.eq("client_status", status);

    const { data: clients, error: clientsError } = await clientQuery.order("created_at", { ascending: false });

    if (clientsError) throw clientsError;

    if (!clients || clients.length === 0) {
      return NextResponse.json({ success: true, clients: [] });
    }

    // 2. Fetch all relevant Tasks for these clients to aggregate
    const clientIds = clients.map(c => c.client_id);
    const { data: tasks, error: tasksError } = await supabase
      .from("onboarding_tasks")
      .select("client_id, status")
      .in("client_id", clientIds);

    if (tasksError) throw tasksError;

    // 3. Aggregate Task Statuses per Client
    const taskAggregation = (tasks || []).reduce((acc: any, t: any) => {
      if (!acc[t.client_id]) {
        acc[t.client_id] = { pending: 0, inreview: 0, approved: 0, rejected: 0 };
      }
      const s = String(t.status).toLowerCase();
      if (s === "pending") acc[t.client_id].pending++;
      else if (s === "in review") acc[t.client_id].inreview++;
      else if (s === "approved") acc[t.client_id].approved++;
      else if (s === "rejected") acc[t.client_id].rejected++;
      return acc;
    }, {});

    // 4. Map back to expected structure
    const reportData = clients.map((c: any) => ({
      client_id: c.client_id,
      client_name: c.client_name,
      code: c.code,
      client_status: c.client_status,
      stage_id: c.stage_id,
      stage_name: c.onboarding_stages?.stage_name,
      progress: c.progress,
      service_center: c.service_centers?.center_name,
      cpa: c.cpa_centers?.cpa_name,
      created_at: c.created_at,
      pending_tasks: taskAggregation[c.client_id]?.pending || 0,
      inreview_tasks: taskAggregation[c.client_id]?.inreview || 0,
      approved_tasks: taskAggregation[c.client_id]?.approved || 0,
      rejected_tasks: taskAggregation[c.client_id]?.rejected || 0
    }));

    return NextResponse.json({
      success: true,
      clients: reportData,
    });
  } catch (err: any) {
    console.error("POST /api/reports/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
