// app/api/cpas/debug/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
    try {
        // 1. Get all CPAs
        const { data: cpas, error: cpaError } = await supabase
            .from("cpa_centers")
            .select("cpa_id, cpa_code, cpa_name, email");

        if (cpaError) throw cpaError;

        // 2. Get all CPA users
        const { data: users, error: userError } = await supabase
            .from("Users")
            .select("id, email, role")
            .eq("role", "CPA");

        if (userError) throw userError;

        // 3. Check which CPAs don't have matching users
        const userEmails = (users || []).map((u: any) => u.email?.toLowerCase());

        const unmatchedCpas = (cpas || []).filter((cpa: any) => {
            if (!cpa.email) return true;
            return !userEmails.includes(cpa.email?.toLowerCase());
        });

        return NextResponse.json({
            cpas: cpas || [],
            users: users || [],
            unmatchedCpas,
            message: unmatchedCpas.length > 0
                ? `Found ${unmatchedCpas.length} CPA(s) without matching user accounts`
                : "All CPAs have user accounts"
        });
    } catch (err: any) {
        console.error("Debug error:", err);
        return NextResponse.json(
            { success: false, message: err.message || "Failed to run CPA debug" },
            { status: 500 }
        );
    }
}
