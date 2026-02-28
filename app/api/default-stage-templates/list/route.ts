// app/api/default-stage-templates/list/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("default_stage_templates")
      .select("template_id, template_name, description, is_active")
      .eq("is_active", true)
      .order("template_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error("GET /api/default-stage-templates/list error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
