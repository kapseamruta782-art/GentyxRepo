// app/api/default-stage-templates/create/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const template_name = (body?.template_name ?? "").trim();
    const description = (body?.description ?? null) as string | null;

    if (!template_name) {
      return NextResponse.json(
        { success: false, error: "template_name is required" },
        { status: 400 }
      );
    }

    // 1. Prevent duplicates
    const { data: existing, error: checkError } = await supabase
      .from("default_stage_templates")
      .select("template_id")
      .eq("template_name", template_name)
      .eq("is_active", true)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Template name already exists" },
        { status: 409 }
      );
    }

    // 2. Insert and return the created row
    const { data: result, error: insertError } = await supabase
      .from("default_stage_templates")
      .insert({
        template_name,
        description,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error("POST /api/default-stage-templates/create error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create template" },
      { status: 500 }
    );
  }
}
