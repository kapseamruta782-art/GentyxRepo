// app/api/service-centers/[id]/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const numericId = Number(id);

    const { data: center, error } = await supabase
      .from("service_centers")
      .select(`
        service_center_id, 
        center_name, 
        center_code,
        email,
        created_at,
        updated_at
      `)
      .eq("service_center_id", numericId)
      .maybeSingle();

    if (error) throw error;

    if (!center) {
      return NextResponse.json({
        success: false,
        error: "Service center not found"
      }, { status: 404 });
    }

    // Map to expected structure
    const formattedCenter = {
      id: center.service_center_id,
      name: center.center_name,
      code: center.center_code,
      email: center.email,
      created_at: center.created_at,
      updated_at: center.updated_at
    };

    return NextResponse.json({
      success: true,
      data: formattedCenter
    });

  } catch (err: any) {
    console.error("GET /api/service-centers/[id]/get error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch service center" },
      { status: 500 }
    );
  }
}