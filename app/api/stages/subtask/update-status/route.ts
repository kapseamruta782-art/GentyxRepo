// app/api/stages/subtask/update-status/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendAdminTaskCompletionEmail, getAdminsWithNotificationsEnabled } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { subtaskId, status, completedByRole, completedByName } = body;

        if (!subtaskId) {
            return NextResponse.json(
                { success: false, error: "Missing subtaskId" },
                { status: 400 }
            );
        }

        if (!status) {
            return NextResponse.json(
                { success: false, error: "Missing status" },
                { status: 400 }
            );
        }

        // 1. Fetch subtask details with relations BEFORE update
        const { data: subtaskData, error: subtaskError } = await supabase
            .from("client_stage_subtasks")
            .select(`
                subtask_id,
                subtask_title,
                status,
                client_stages (
                    stage_name,
                    client_id
                )
            `)
            .eq("subtask_id", subtaskId)
            .maybeSingle();

        if (subtaskError) throw subtaskError;
        if (!subtaskData) {
            return NextResponse.json(
                { success: false, error: "Subtask not found" },
                { status: 404 }
            );
        }

        // Fetch client data separately because client_stages might lack a foreign key to Clients
        let clientData: any = null;
        const clientStages: any = subtaskData?.client_stages;
        const clientId = Array.isArray(clientStages) ? clientStages[0]?.client_id : clientStages?.client_id;
        if (clientId) {
            const { data } = await supabase
                .from("Clients")
                .select(`
                    client_name,
                    primary_contact_name,
                    cpa_id,
                    service_center_id,
                    cpa_centers ( cpa_name ),
                    service_centers ( center_name )
                `)
                .eq("client_id", clientId)
                .maybeSingle();
            clientData = data;
        }

        const previousStatus = subtaskData.status;

        // 2. Update subtask status
        const { error: updateError } = await supabase
            .from("client_stage_subtasks")
            .update({
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq("subtask_id", subtaskId);

        if (updateError) throw updateError;

        // 3. Check if newly completed
        const isNewlyCompleted = status === "Completed" && previousStatus !== "Completed";

        if (isNewlyCompleted) {
            try {
                const admins = await getAdminsWithNotificationsEnabled();

                if (admins.length > 0) {
                    const whoRole = (completedByRole || "CLIENT").toUpperCase();
                    let whoName = completedByName || "";

                    const client = clientData;

                    if (!whoName && client) {
                        switch (whoRole) {
                            case "CLIENT":
                                whoName = client.primary_contact_name || client.client_name || "Client";
                                break;
                            case "CPA":
                                const cpa = client.cpa_centers as any;
                                whoName = (Array.isArray(cpa) ? cpa[0]?.cpa_name : cpa?.cpa_name) || "CPA";
                                break;
                            case "SERVICE_CENTER":
                                const sc = client.service_centers as any;
                                whoName = (Array.isArray(sc) ? sc[0]?.center_name : sc?.center_name) || "Service Center";
                                break;
                            default:
                                whoName = "User";
                        }
                    }

                    for (const admin of admins) {
                        sendAdminTaskCompletionEmail({
                            adminEmail: admin.email,
                            adminName: admin.name || "Admin",
                            taskTitle: subtaskData.subtask_title,
                            clientName: client?.client_name || "Unknown Client",
                            completedByRole: whoRole as any,
                            completedByName: whoName || "User",
                            taskType: "ONBOARDING",
                            stageName: (Array.isArray(clientStages) ? clientStages[0]?.stage_name : clientStages?.stage_name) || "Onboarding",
                        }).catch(err => console.error(`❌ Admin email failed for ${admin.email}:`, err));
                    }
                }
            } catch (emailErr) {
                console.error("❌ Admin completion notification error:", emailErr);
            }
        }

        return NextResponse.json({
            success: true,
            message: "Subtask status updated"
        });

    } catch (err: any) {
        console.error("POST /api/stages/subtask/update-status error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update subtask status" },
            { status: 500 }
        );
    }
}
