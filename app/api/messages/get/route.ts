// /app/api/messages/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");
    const conversationBetween = url.searchParams.get("conversationBetween");
    const serviceCenterId = url.searchParams.get("serviceCenterId");
    const cpaId = url.searchParams.get("cpaId");

    console.log("📨 Fetching messages:", { clientId, conversationBetween, serviceCenterId, cpaId });

    // Parse conversation roles
    let role1 = "";
    let role2 = "";
    if (conversationBetween) {
      const roles = conversationBetween.split(",");
      role1 = roles[0] || "";
      role2 = roles[1] || "";
    }

    const parsedClientId = clientId ? parseInt(clientId) : 0;
    const validClientId = parsedClientId > 0 ? parsedClientId : null;
    const parsedServiceCenterId = serviceCenterId ? parseInt(serviceCenterId) : null;
    const parsedCpaId = cpaId ? parseInt(cpaId) : null;

    let query = supabase
      .from("onboarding_messages")
      .select(`
        *,
        Clients(client_name)
      `);

    // Applying Filters
    if (validClientId) {
      query = query.eq("client_id", validClientId);

      if (role1 && role2) {
        // Specific conversation roles
        query = query.or(`and(sender_role.eq.${role1},receiver_role.eq.${role2}),and(sender_role.eq.${role2},receiver_role.eq.${role1})`);

        // If chatting with SC or CPA, further filter by their ID
        const isChatWithSC = role1 === "SERVICE_CENTER" || role2 === "SERVICE_CENTER";
        const isChatWithCPA = role1 === "CPA" || role2 === "CPA";

        if (isChatWithSC && parsedServiceCenterId) {
          query = query.or(`service_center_id.eq.${parsedServiceCenterId},service_center_id.is.null`);
        } else if (isChatWithCPA && parsedCpaId) {
          query = query.or(`cpa_id.eq.${parsedCpaId},cpa_id.is.null`);
        }
      }
    } else if (parsedServiceCenterId) {
      // Service Center-specific (no client)
      query = query.or("client_id.is.null,client_id.eq.0")
        .eq("service_center_id", parsedServiceCenterId)
        .or(`and(sender_role.eq.${role1},receiver_role.eq.${role2}),and(sender_role.eq.${role2},receiver_role.eq.${role1})`);
    } else if (parsedCpaId) {
      // CPA-specific (no client)
      query = query.or("client_id.is.null,client_id.eq.0")
        .eq("cpa_id", parsedCpaId)
        .or(`and(sender_role.eq.${role1},receiver_role.eq.${role2}),and(sender_role.eq.${role2},receiver_role.eq.${role1})`);
    } else {
      // Generic fallback (no client, no SC, no CPA)
      query = query.or("client_id.is.null,client_id.eq.0")
        .is("service_center_id", null)
        .is("cpa_id", null)
        .or(`and(sender_role.eq.${role1},receiver_role.eq.${role2}),and(sender_role.eq.${role2},receiver_role.eq.${role1})`);
    }

    const { data: messages, error } = await query.order("created_at", { ascending: true });

    if (error) throw error;

    // Flatten client name
    const processedMessages = (messages || []).map((m: any) => ({
      ...m,
      client_name: m.Clients?.client_name
    }));

    console.log(`✅ Found ${processedMessages.length} messages`);

    return NextResponse.json({
      success: true,
      data: processedMessages,
    });
  } catch (err: any) {
    console.error("GET /api/messages/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || String(err) },
      { status: 500 }
    );
  }
}
