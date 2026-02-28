// app/api/help/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("help_content")
            .select("role_name, help_items");

        if (error) throw error;

        // If no data in DB, return default
        if (!data || data.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    ADMIN: ["Create a client", "Assign Service Center and CPA", "Set initial stage or tasks"],
                    CLIENT: ["Check Inbox and Tasks", "Upload required documents", "Ask a question if blocked"],
                    SERVICE_CENTER: ["Review client uploads", "Assign tasks to client", "Leave feedback notes"],
                    CPA: ["Review documents", "Set stage for assigned clients", "Create CPA tasks"],
                }
            });
        }

        // Transform recordset to object
        const helpData: Record<string, string[]> = {};
        for (const row of data) {
            helpData[row.role_name] = JSON.parse(row.help_items);
        }

        return NextResponse.json({ success: true, data: helpData });

    } catch (err: any) {
        console.error("GET /api/help/get error:", err);

        // Return default data on error
        return NextResponse.json({
            success: true,
            data: {
                ADMIN: ["Create a client", "Assign Service Center and CPA", "Set initial stage or tasks"],
                CLIENT: ["Check Inbox and Tasks", "Upload required documents", "Ask a question if blocked"],
                SERVICE_CENTER: ["Review client uploads", "Assign tasks to client", "Leave feedback notes"],
                CPA: ["Review documents", "Set stage for assigned clients", "Create CPA tasks"],
            }
        });
    }
}
