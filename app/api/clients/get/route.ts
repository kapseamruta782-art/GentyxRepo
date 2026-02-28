// app/api/clients/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
    const pageSize = Math.max(parseInt(searchParams.get("pageSize") || "10"), 1);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const statusFilter = (searchParams.get("status") || "ALL").trim();
    const archiveFilter = (searchParams.get("archiveFilter") || "ALL").trim();
    const offset = (page - 1) * pageSize;

    // 1. Fetch base clients with joins
    // Note: If relationships are missing in Supabase, this might fail.
    // We'll fall back to separate queries if needed, but let's try the join first.
    let query = supabase
      .from("Clients")
      .select(`
        *,
        service_centers(center_name, email),
        cpa_centers(cpa_name, email)
      `);

    // Applying archive filter
    if (archiveFilter === "active") {
      query = query.or("is_archived.eq.false,is_archived.is.null");
    } else if (archiveFilter === "archived") {
      query = query.eq("is_archived", true);
    }

    const { data: clients, error: clientsError } = await query;

    if (clientsError) {
      console.error("Supabase Clients Error:", clientsError);
      throw clientsError;
    }

    // 2. Fetch additional data for all clients (messages, stages) to compute status/progress
    // In a high-scale app, we'd use a View or RPC. For now, we do it in JS.

    const clientIds = clients.map(c => c.client_id);

    const [stagesRes, messagesRes] = await Promise.all([
      supabase.from("client_stages").select("*").in("client_id", clientIds).order("order_number"),
      supabase.from("onboarding_messages")
        .select("*")
        .in("client_id", clientIds)
        .or("and(sender_role.eq.ADMIN,receiver_role.eq.CLIENT),and(sender_role.eq.CLIENT,receiver_role.eq.ADMIN)")
        .order("created_at", { ascending: false })
    ]);

    const allStages = stagesRes.data || [];
    const allMessages = messagesRes.data || [];

    // 3. Process and Filter in JS
    let processedClients = clients.map(client => {
      const clientStages = allStages.filter(s => s.client_id === client.client_id);
      const clientMessages = allMessages.filter(m => m.client_id === client.client_id);
      const lastMsg = clientMessages[0];

      // Status Logic
      let status = "Not Started";
      if (clientStages.length > 0) {
        const allCompleted = clientStages.every(s => s.status === "Completed");
        const allNotStarted = clientStages.every(s => s.status === "Not Started");
        if (allCompleted) status = "Completed";
        else if (!allNotStarted) status = "In Progress";
      }

      // Progress Logic
      const totalStages = clientStages.length;
      const completedStages = clientStages.filter(s => s.status === "Completed").length;
      const progress = totalStages === 0 ? 0 : (completedStages / totalStages) * 100;

      // Current Stage Name
      const currentStage = clientStages.find(s => s.status === "In Progress") ||
        clientStages.slice().reverse().find(s => s.status === "Completed") ||
        clientStages.find(s => s.status === "Not Started" && s.is_required);

      return {
        ...client,
        service_center_name: client.service_centers?.center_name,
        service_center_email: client.service_centers?.email,
        cpa_name: client.cpa_centers?.cpa_name,
        cpa_email: client.cpa_centers?.email,
        status,
        progress,
        total_stages: totalStages,
        completed_stages: completedStages,
        stage_name: currentStage?.stage_name,
        last_message_at: lastMsg?.created_at,
        last_message_body: lastMsg?.body,
        last_message_sender_role: lastMsg?.sender_role
      };
    });

    // Filtering by Status
    if (statusFilter !== "ALL") {
      processedClients = processedClients.filter(c => c.status === statusFilter);
    }

    // Filtering by Query string
    if (q) {
      processedClients = processedClients.filter(c =>
        (c.client_name?.toLowerCase().includes(q)) ||
        (c.code?.toLowerCase().includes(q)) ||
        (c.primary_contact_name?.toLowerCase().includes(q)) ||
        (c.service_center_name?.toLowerCase().includes(q)) ||
        (c.cpa_name?.toLowerCase().includes(q))
      );
    }

    // Sorting
    processedClients.sort((a, b) => {
      // Archived at bottom
      if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;

      // Sort by recent message or creation
      const dateA = new Date(a.last_message_at || a.created_at).getTime();
      const dateB = new Date(b.last_message_at || b.created_at).getTime();
      return dateB - dateA;
    });

    const total = processedClients.length;
    const paginatedData = processedClients.slice(offset, offset + pageSize);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      page,
      pageSize,
      total,
    });

  } catch (err: any) {
    console.error("GET /api/clients/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
