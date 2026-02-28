// app/api/clients/delete/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientId } = body;

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Client ID is required" },
                { status: 400 }
            );
        }

        const cid = Number(clientId);

        // 1. Get client info before deletion
        const { data: client, error: clientError } = await supabase
            .from("Clients")
            .select("client_name, primary_contact_email")
            .eq("client_id", cid)
            .maybeSingle();

        if (clientError) throw clientError;
        if (!client) {
            return NextResponse.json(
                { success: false, error: "Client not found" },
                { status: 404 }
            );
        }

        const clientName = client.client_name || "Unknown";
        const clientEmail = client.primary_contact_email;

        console.log(`🗑️ Starting deletion of client: ${clientName} (ID: ${cid})`);

        // 2. Delete messages
        const { error: msgError } = await supabase
            .from("onboarding_messages")
            .delete()
            .eq("client_id", cid);
        if (msgError) console.warn("  ⚠ Error deleting messages:", msgError.message);

        // 3. Delete onboarding tasks
        const { error: taskError } = await supabase
            .from("onboarding_tasks")
            .delete()
            .eq("client_id", cid);
        if (taskError) console.warn("  ⚠ Error deleting tasks:", taskError.message);

        // 4. Delete client stage subtasks (cascaded manual delete)
        const { data: stages } = await supabase
            .from("client_stages")
            .select("client_stage_id")
            .eq("client_id", cid);

        const stageIds = (stages || []).map(s => s.client_stage_id);
        if (stageIds.length > 0) {
            const { error: subError } = await supabase
                .from("client_stage_subtasks")
                .delete()
                .in("client_stage_id", stageIds);
            if (subError) console.warn("  ⚠ Error deleting subtasks:", subError.message);
        }

        // 5. Delete client stages
        const { error: stageDeleteError } = await supabase
            .from("client_stages")
            .delete()
            .eq("client_id", cid);
        if (stageDeleteError) console.warn("  ⚠ Error deleting stages:", stageDeleteError.message);

        // 6. Delete client users
        const { error: clientUsersError } = await supabase
            .from("client_users")
            .delete()
            .eq("client_id", cid);
        if (clientUsersError) console.warn("  ⚠ Error deleting client users:", clientUsersError.message);

        // 7. Delete audit logs
        const { error: auditError } = await supabase
            .from("onboarding_audit_log")
            .delete()
            .eq("client_id", cid);
        if (auditError) console.warn("  ⚠ Error deleting audit logs:", auditError.message);

        // 8. Delete user credentials
        if (clientEmail) {
            const { error: userDeleteError } = await supabase
                .from("Users")
                .delete()
                .eq("email", clientEmail);
            if (userDeleteError) console.warn("  ⚠ Error deleting user credentials:", userDeleteError.message);
        }

        // 9. Delete the client record
        const { error: finalDeleteError } = await supabase
            .from("Clients")
            .delete()
            .eq("client_id", cid);

        if (finalDeleteError) throw finalDeleteError;

        console.log(`✅ Successfully deleted client: ${clientName} (ID: ${cid})`);

        return NextResponse.json({
            success: true,
            message: `Client "${clientName}" and all associated data have been deleted successfully.`,
            deletedClientId: cid,
            deletedClientName: clientName,
        });

    } catch (error: any) {
        console.error("Delete client error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to delete client" },
            { status: 500 }
        );
    }
}
