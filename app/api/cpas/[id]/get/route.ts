// app/api/cpas/[id]/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request, { params }: any) {
    try {
        const { id } = await params;
        const numericId = Number(id);

        const { data: cpa, error } = await supabase
            .from("cpa_centers")
            .select(`
                cpa_id,
                cpa_code,
                cpa_name,
                email,
                created_at,
                updated_at
            `)
            .eq("cpa_id", numericId)
            .maybeSingle();

        if (error) throw error;

        if (!cpa) {
            return NextResponse.json(
                { success: false, message: "CPA not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: cpa,
        });
    } catch (err: any) {
        console.error("GET /api/cpas/[id]/get error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to fetch CPA" },
            { status: 500 }
        );
    }
}
