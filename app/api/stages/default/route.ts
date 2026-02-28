// app/api/stages/default/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("onboarding_stages")
      .select(`
        stage_id,
        stage_name,
        order_number,
        is_required
      `)
      .order("order_number", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (err: any) {
    console.error("GET /api/stages/default error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch default stages" },
      { status: 500 }
    );
  }
}
