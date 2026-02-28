// app/api/stages/add/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, stageName, isRequired, orderNumber } = body;

    if (!clientId || !stageName) {
      return NextResponse.json(
        { success: false, error: "clientId and stageName are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("client_stages")
      .insert({
        client_id: Number(clientId),
        stage_name: stageName,
        is_required: isRequired ?? true,
        order_number: orderNumber ?? 1,
        status: 'Pending',
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("POST /api/stages/add error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add stage" },
      { status: 500 }
    );
  }
}
