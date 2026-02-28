// app/api/service-centers/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    // 1. Fetch Service Centers
    const { data: scs, error: scsError } = await supabase
      .from("service_centers")
      .select("service_center_id, center_name")
      .order("center_name");

    if (scsError) throw scsError;

    const scIds = scs.map(sc => sc.service_center_id);

    // 2. Fetch last messages in parallel
    const { data: allMessages, error: msgsError } = await supabase
      .from("onboarding_messages")
      .select("*")
      .in("service_center_id", scIds)
      .or("client_id.is.null,client_id.eq.0")
      .order("created_at", { ascending: false });

    if (msgsError) throw msgsError;

    // 3. Process in JS
    const processed = scs.map(sc => {
      const lastMsg = allMessages.find(m => m.service_center_id === sc.service_center_id);

      return {
        ...sc,
        last_message_at: lastMsg?.created_at,
        last_message_body: lastMsg?.body,
        last_message_sender_role: lastMsg?.sender_role
      };
    });

    // Final Sort: Most recent message first
    processed.sort((a, b) => {
      const dateA = new Date(a.last_message_at || '1900-01-01').getTime();
      const dateB = new Date(b.last_message_at || '1900-01-01').getTime();
      return dateB - dateA || a.center_name.localeCompare(b.center_name);
    });

    return NextResponse.json({
      success: true,
      data: processed
    });

  } catch (err: any) {
    console.error("GET /api/service-centers/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch service centers" },
      { status: 500 }
    );
  }
}
