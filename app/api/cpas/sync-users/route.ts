// app/api/cpas/sync-users/route.ts
// This endpoint syncs all existing CPAs to the Users table
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

const DEFAULT_PASSWORD = "Cpa@12345";

export async function POST() {
    try {
        // 1. Get all CPAs
        const { data: cpas, error: cpaError } = await supabase
            .from("cpa_centers")
            .select("cpa_id, cpa_name, email")
            .not("email", "is", null);

        if (cpaError) throw cpaError;

        // 2. Get all existing Users with role 'CPA'
        const { data: users, error: userError } = await supabase
            .from("Users")
            .select("email")
            .eq("role", "CPA");

        if (userError) throw userError;

        const existingEmails = new Set((users || []).map(u => u.email.toLowerCase()));

        const cpasToCreate = (cpas || []).filter(c => !existingEmails.has(c.email!.toLowerCase()));

        let created = 0;
        const createdList: string[] = [];

        for (const cpa of cpasToCreate) {
            try {
                const { error: insertErr } = await supabase
                    .from("Users")
                    .insert({
                        email: cpa.email!.toLowerCase(),
                        password: DEFAULT_PASSWORD,
                        role: "CPA"
                    });

                if (insertErr) throw insertErr;

                created++;
                createdList.push(cpa.email!);
                console.log(`✅ Created user for CPA: ${cpa.email}`);
            } catch (err: any) {
                console.error(`❌ Failed to create user for CPA ${cpa.email}:`, err.message);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${created} CPA(s) to Users table. Default password: ${DEFAULT_PASSWORD}`,
            created,
            createdEmails: createdList,
            total: cpasToCreate.length
        });
    } catch (err: any) {
        console.error("CPA sync error:", err);
        return NextResponse.json(
            { success: false, message: err.message || "Failed to sync CPAs" },
            { status: 500 }
        );
    }
}

// Also allow GET for easy testing
export async function GET() {
    return POST();
}
