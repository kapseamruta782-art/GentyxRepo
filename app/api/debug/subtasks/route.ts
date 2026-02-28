// app/api/debug/subtasks/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("client_stage_subtasks")
      .select("*")
      .order("subtask_id", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data: data || [],
    });
  } catch (err: any) {
    console.error("DEBUG SUBTASKS ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch subtasks" },
      { status: 500 }
    );
  }
}
