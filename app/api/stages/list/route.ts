// app/api/stages/list/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("onboarding_stages")
      .select("stage_id, stage_name, order_number")
      .order("order_number", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data,
    });

  } catch (err: any) {
    console.error("GET /api/stages/list error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch stage list" },
      { status: 500 }
    );
  }
}
