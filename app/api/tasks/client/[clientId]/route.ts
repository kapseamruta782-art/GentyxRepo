// api/tasks/client/[clientId]/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ clientId: string }> }
) {
    try {
        const { clientId: clientIdParam } = await params;
        const clientId = Number(clientIdParam);

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "Invalid clientId" },
                { status: 400 }
            );
        }

        const { data: tasks, error } = await supabase
            .from("onboarding_tasks")
            .select(`
                task_id,
                task_title,
                status,
                order_number,
                due_date,
                created_at,
                document_required,
                onboarding_stages(stage_name)
            `)
            .eq("client_id", clientId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Map data to match expected frontend structure
        const formattedTasks = (tasks || []).map((t: any) => ({
            id: t.task_id,
            title: t.task_title,
            status: t.status,
            order_number: t.order_number,
            dueDate: t.due_date,
            createdAt: t.created_at,
            documentRequired: t.document_required ?? true,
            stage: t.onboarding_stages?.stage_name
        }));

        return NextResponse.json({
            success: true,
            data: formattedTasks,
        });
    } catch (err: any) {
        console.error("GET /api/tasks/client/[clientId] error:", err);

        return NextResponse.json(
            { success: false, error: err.message || "Failed to fetch client tasks" },
            { status: 500 }
        );
    }
}
