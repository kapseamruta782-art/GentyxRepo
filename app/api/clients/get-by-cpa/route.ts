// app/api/clients/get-by-cpa/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cpaId = searchParams.get("cpaId");

    if (!cpaId) {
      return NextResponse.json(
        { success: false, error: "CPA ID is required" },
        { status: 400 }
      );
    }

    const cid = Number(cpaId);

    // 1. Fetch clients for this CPA
    const { data: clients, error: clientsError } = await supabase
      .from("Clients")
      .select("client_id, client_name, code, client_status, status, primary_contact_email")
      .eq("cpa_id", cid);

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

    // 3. Join in JS
    const result = clients.map(client => {
      const clientMessages = (allMessages || []).filter(m => m.client_id === client.client_id);
      const lastMsg = clientMessages[0];

      return {
        ...client,
        last_message_at: lastMsg?.created_at || null,
        last_message_body: lastMsg?.body || null,
        last_message_sender_role: lastMsg?.sender_role || null
      };
    });

    // 4. Sort by latest interaction
    result.sort((a, b) => {
      const dateA = new Date(a.last_message_at || '1900-01-01').getTime();
      const dateB = new Date(b.last_message_at || '1900-01-01').getTime();
      if (dateA !== dateB) return dateB - dateA;
      return a.client_name.localeCompare(b.client_name);
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error("GET BY CPA ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch assigned clients" },
      { status: 500 }
    );
  }
}
