// app/api/audit/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    let query = supabase
      .from("onboarding_audit_log")
      .select(`
        audit_id,
        client_id,
        action,
        actor_role,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", Number(clientId));
    }

    const { data, error } = await query;

    if (error) throw error;

    // Map to match the expected frontend format (audit_id -> id, created_at -> at)
    const formattedData = (data || []).map(item => ({
      id: item.audit_id,
      client_id: item.client_id,
      action: item.action,
      actor_role: item.actor_role,
      at: item.created_at
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
    });
  } catch (err: any) {
    console.error("GET /api/audit/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
