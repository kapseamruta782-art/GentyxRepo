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
                    client_id,
                    Clients (
                        client_name,
                        primary_contact_name,
                        cpa_id,
                        service_center_id,
                        cpa_centers ( cpa_name ),
                        service_centers ( center_name )
                    )
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

                    const client = subtaskData.client_stages?.Clients;

                    if (!whoName && client) {
                        switch (whoRole) {
                            case "CLIENT":
                                whoName = client.primary_contact_name || client.client_name || "Client";
                                break;
                            case "CPA":
                                whoName = client.cpa_centers?.cpa_name || "CPA";
                                break;
                            case "SERVICE_CENTER":
                                whoName = client.service_centers?.center_name || "Service Center";
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
                            stageName: subtaskData.client_stages?.stage_name || "Onboarding",
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
