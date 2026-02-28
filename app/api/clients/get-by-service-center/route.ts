// app/api/clients/get-by-service-center/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceCenterId = searchParams.get("serviceCenterId");

    if (!serviceCenterId) {
      return NextResponse.json(
        { success: false, error: "serviceCenterId is required" },
        { status: 400 }
      );
    }

    const scId = Number(serviceCenterId);

    // 1. Fetch clients assigned to this service center
    const { data: clients, error: clientsError } = await supabase
      .from("Clients")
      .select(`
        client_id,
        client_name,
        code,
        status,
        client_status,
        created_at,
        primary_contact_email
      `)
      .eq("service_center_id", scId);

    if (clientsError) throw clientsError;

    if (!clients || clients.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 2. Fetch the latest message for each client
    const clientIds = clients.map(c => c.client_id);
    const { data: allMessages, error: messagesError } = await supabase
      .from("onboarding_messages")
      .select("client_id, created_at, body, sender_role")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false });

    if (messagesError) throw messagesError;

    // 3. Join and find the latest message per client in JS
    const result = clients.map(client => {
      const clientMessages = (allMessages || []).filter(m => m.client_id === client.client_id);
      const lastMsg = clientMessages[0]; // Messages are ordered by created_at DESC

      return {
        ...client,
        last_message_at: lastMsg?.created_at || null,
        last_message_body: lastMsg?.body || null,
        last_message_sender_role: lastMsg?.sender_role || null
      };
    });

    // 4. Sort by latest interaction
    result.sort((a, b) => {
      const dateA = new Date(a.last_message_at || a.created_at).getTime();
      const dateB = new Date(b.last_message_at || b.created_at).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (err: any) {
    console.error("GET CLIENTS BY SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch assigned clients" },
      { status: 500 }
    );
  }
}
