// app/api/clients/archive/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientId, archive } = body;

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Client ID is required" },
                { status: 400 }
            );
        }

        // archive should be true to archive, false to unarchive (restore)
        const isArchived = archive === true;

        // 1. Get client info for logging
        const { data: client, error: clientError } = await supabase
            .from("Clients")
            .select("client_name")
            .eq("client_id", clientId)
            .maybeSingle();

        if (clientError) throw clientError;
        const clientName = client?.client_name || "Unknown";

        // 2. Update the is_archived flag
        const { error: updateError } = await supabase
            .from("Clients")
            .update({
                is_archived: isArchived,
                updated_at: new Date().toISOString()
            })
            .eq("client_id", clientId);

        if (updateError) throw updateError;

        const action = isArchived ? "archived" : "restored";
        console.log(`✅ Client "${clientName}" (ID: ${clientId}) has been ${action}`);

        return NextResponse.json({
            success: true,
            message: `Client "${clientName}" has been ${action} successfully.`,
            clientId,
            clientName,
            isArchived: isArchived,
        });

    } catch (error: any) {
        console.error("Archive client error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to archive client" },
            { status: 500 }
        );
    }
}
