// app/api/clients/update-password/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientId, newPassword } = body;

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Missing clientId" },
                { status: 400 }
            );
        }

        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        // Get the client's email first
        const { data: client, error: clientError } = await supabase
            .from("Clients")
            .select("primary_contact_email")
            .eq("client_id", clientId)
            .maybeSingle();

        if (clientError) throw clientError;

        if (!client) {
            return NextResponse.json(
                { success: false, error: "Client not found" },
                { status: 404 }
            );
        }

        const clientEmail = client.primary_contact_email;

        if (!clientEmail) {
            return NextResponse.json(
                { success: false, error: "Client email not found" },
                { status: 400 }
            );
        }

        // Update the password in Users table
        const { error: updateError } = await supabase
            .from("Users")
            .update({ password: newPassword })
            .eq("email", clientEmail);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err: any) {
        console.error("POST /api/clients/update-password error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update password" },
            { status: 500 }
        );
    }
}
