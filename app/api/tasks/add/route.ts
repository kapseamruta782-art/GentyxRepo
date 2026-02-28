import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendTaskNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🔍 Incoming /api/tasks/add body:", body);

    const {
      clientId: rawClientId,
      taskTitle,
      title,
      description = "",
      dueDate,
      assignedToRole,
      assigneeRole,
      documentRequired = true,
      sendNotification = true,
    } = body;

    const clientId = Number(rawClientId);
    const finalTitle = taskTitle || title;
    const role = assignedToRole || assigneeRole || "CLIENT";
    const docRequired = documentRequired === true || documentRequired === 1;

    if (!clientId || !finalTitle) {
      return NextResponse.json(
        { success: false, error: "clientId and taskTitle are required" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // 1️⃣ VERIFY CLIENT EXISTS AND GET CLIENT DETAILS
    // -----------------------------------------------------
    const { data: client, error: clientError } = await supabase
      .from("Clients")
      .select(`
        client_id,
        client_name,
        primary_contact_name,
        primary_contact_email,
        cpa_id,
        service_center_id,
        cpa_centers (
          cpa_name,
          email
        ),
        service_centers (
          center_name,
          email
        )
      `)
      .eq("client_id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Invalid clientId" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------
    // 2️⃣ GET A SAFE STAGE ID
    // -----------------------------------------------------
    const { data: stageData, error: stageError } = await supabase
      .from("onboarding_stages")
      .select("stage_id")
      .order("stage_id")
      .limit(1)
      .maybeSingle();

    if (stageError) throw stageError;

    const stageId = stageData?.stage_id;

    if (!stageId) {
      return NextResponse.json(
        { success: false, error: "No onboarding stages configured in system" },
        { status: 500 }
      );
    }

    // -----------------------------------------------------
    // 3️⃣ AUTO-INCREMENT ORDER NUMBER (CLIENT LEVEL)
    // -----------------------------------------------------
    const { data: orderData, error: orderError } = await supabase
      .from("onboarding_tasks")
      .select("order_number")
      .eq("client_id", clientId)
      .order("order_number", { ascending: false })
      .limit(1);

    if (orderError) throw orderError;

    const nextOrder = (orderData?.[0]?.order_number || 0) + 1;

    // -----------------------------------------------------
    // 4️⃣ INSERT SEPARATE ASSIGNED TASK
    // -----------------------------------------------------
    const { data: insertedTask, error: insertError } = await supabase
      .from("onboarding_tasks")
      .insert({
        stage_id: stageId,
        client_id: clientId,
        task_title: finalTitle,
        description,
        assigned_to_role: role,
        due_date: dueDate || null,
        status: 'Not Started',
        order_number: nextOrder,
        document_required: docRequired,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("task_id")
      .single();

    if (insertError) throw insertError;

    const taskId = insertedTask.task_id;

    // -----------------------------------------------------
    // 5️⃣ SEND EMAIL NOTIFICATION (AUTOMATIC)
    // -----------------------------------------------------
    if (sendNotification) {
      try {
        let recipientEmail: string | null = null;
        let recipientName: string = "";
        let recipientRole: "CLIENT" | "CPA" | "SERVICE_CENTER" = "CLIENT";

        switch (role.toUpperCase()) {
          case "CLIENT":
            recipientEmail = client.primary_contact_email;
            recipientName = client.primary_contact_name || client.client_name;
            recipientRole = "CLIENT";
            break;

          case "CPA":
            recipientEmail = (client.cpa_centers as any)?.email;
            recipientName = (client.cpa_centers as any)?.cpa_name || "CPA";
            recipientRole = "CPA";
            break;

          case "SERVICE_CENTER":
            recipientEmail = (client.service_centers as any)?.email;
            recipientName = (client.service_centers as any)?.center_name || "Service Center";
            recipientRole = "SERVICE_CENTER";
            break;
        }

        if (recipientEmail) {
          await sendTaskNotificationEmail({
            recipientEmail,
            recipientName,
            recipientRole,
            taskTitle: finalTitle,
            taskDescription: description,
            dueDate,
            clientName: client.client_name,
            notificationType: "assigned",
            assignedByName: "Admin",
          });
        }
      } catch (emailError: any) {
        console.error("❌ Task notification email error:", emailError?.message || emailError);
      }
    }

    return NextResponse.json({
      success: true,
      taskId,
    });

  } catch (err: any) {
    console.error("POST /api/tasks/add error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add task" },
      { status: 500 }
    );
  }
}
