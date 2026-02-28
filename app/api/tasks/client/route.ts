// app/api/tasks/client/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const { data: tasks, error } = await supabase
      .from("onboarding_tasks")
      .select("task_id, task_title, assigned_to_role, due_date, status")
      .eq("client_id", parseInt(clientId))
      .order("task_id", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: tasks || []
    });

  } catch (err: any) {
    console.error("GET /api/tasks/client error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
