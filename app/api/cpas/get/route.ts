// app/api/cpas/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    // 1. Fetch CPAs
    const { data: cpas, error: cpasError } = await supabase
      .from("cpa_centers")
      .select(`
        cpa_id,
        cpa_code,
        cpa_name,
        email,
        created_at,
        updated_at
      `)
      .order("cpa_name");

    if (cpasError) throw cpasError;

    const cpaIds = cpas.map(c => c.cpa_id);

    // 2. Fetch counts and last messages in parallel
    const [countsRes, messagesRes] = await Promise.all([
      supabase.from("Clients").select("cpa_id"), // We'll count in JS to avoid complexity
      supabase.from("onboarding_messages")
        .select("*")
        .in("cpa_id", cpaIds)
        .or("client_id.is.null,client_id.eq.0")
        .order("created_at", { ascending: false })
    ]);

    const clientsData = countsRes.data || [];
    const allMessages = messagesRes.data || [];

    // 3. Process in JS
    const processed = cpas.map(c => {
      const client_count = clientsData.filter(cl => cl.cpa_id === c.cpa_id).length;
      const lastMsg = allMessages.find(m => m.cpa_id === c.cpa_id);

      return {
        ...c,
        client_count,
        last_message_at: lastMsg?.created_at,
        last_message_body: lastMsg?.body,
        last_message_sender_role: lastMsg?.sender_role
      };
    });

    // Final Sort: Most recent message first
    processed.sort((a, b) => {
      const dateA = new Date(a.last_message_at || '1900-01-01').getTime();
      const dateB = new Date(b.last_message_at || '1900-01-01').getTime();
      return dateB - dateA || a.cpa_name.localeCompare(b.cpa_name);
    });

    return NextResponse.json({
      success: true,
      data: processed
    });

  } catch (err: any) {
    console.error("GET /api/cpas/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch CPAs" },
      { status: 500 }
    );
  }
}
