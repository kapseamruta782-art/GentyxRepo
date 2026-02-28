// app/api/help/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { helpData } = body;

        if (!helpData || typeof helpData !== "object") {
            return NextResponse.json(
                { success: false, error: "Invalid help data" },
                { status: 400 }
            );
        }

        // Update or insert each role's help content
        for (const [roleName, items] of Object.entries(helpData)) {
            const { error } = await supabase
                .from("help_content")
                .upsert({
                    role_name: roleName,
                    help_items: JSON.stringify(items),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'role_name' });

            if (error) {
                console.error(`❌ Failed to update help content for ${roleName}:`, error.message);
                throw error;
            }
        }

        return NextResponse.json({ success: true, message: "Help content updated successfully" });

    } catch (err: any) {
        console.error("POST /api/help/update error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update help content" },
            { status: 500 }
        );
    }
}
