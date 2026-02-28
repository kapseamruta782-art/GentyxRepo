// app/api/tasks/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { calculateClientProgress } from "@/lib/progress";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendTaskNotificationEmail, sendAdminTaskCompletionEmail, getAdminsWithNotificationsEnabled } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      taskId,
      taskTitle,
      dueDate,
      status,
      assignedToRole,
      documentRequired,
      sendNotification = false,
      completedByRole,
      completedByName,
    } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // 1️⃣ Fetch task details and client info BEFORE update
    // -----------------------------------------------------
    const { data: taskData, error: taskError } = await supabase
      .from("onboarding_tasks")
      .select(`
        *,
        clients (
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
        )
      `)
      .eq("task_id", taskId)
      .maybeSingle();

    if (taskError) throw taskError;

    if (!taskData) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    const clientId = taskData.client_id;
    const previousStatus = taskData.status;
    const clientData = taskData.clients;

    // Track what fields are being updated for the notification
    const updatedFields: string[] = [];
    if (taskTitle && taskTitle !== taskData.task_title) {
      updatedFields.push(`Title changed to "${taskTitle}"`);
    }
    if (dueDate && new Date(dueDate).toDateString() !== new Date(taskData.due_date).toDateString()) {
      updatedFields.push(`Due date changed to ${new Date(dueDate).toLocaleDateString()}`);
    }
    if (status && status !== taskData.status) {
      updatedFields.push(`Status changed to "${status}"`);
    }
    if (assignedToRole && assignedToRole !== taskData.assigned_to_role) {
      updatedFields.push(`Assigned to ${assignedToRole.replace('_', ' ')}`);
    }

    // -----------------------------------------------------
    // 2️⃣ Update the task
    // -----------------------------------------------------
    const { error: updateError } = await supabase
      .from("onboarding_tasks")
      .update({
        task_title: taskTitle || undefined,
        due_date: dueDate || undefined,
        status: status || undefined,
        assigned_to_role: assignedToRole || undefined,
        document_required: documentRequired !== undefined ? (documentRequired === true || documentRequired === 1) : undefined,
        updated_at: new Date().toISOString()
      })
      .eq("task_id", taskId);

    if (updateError) throw updateError;

    // -----------------------------------------------------
    // 3️⃣ Recalculate the client's progress
    // -----------------------------------------------------
    if (clientId) {
      try {
        await calculateClientProgress(clientId);
      } catch (progressError) {
        console.error("Progress calculation failed:", progressError);
      }

      // Audit log
      try {
        const isCompleted = status === "Completed";
        logAudit({
          clientId,
          action: isCompleted ? AuditActions.TASK_COMPLETED : AuditActions.TASK_UPDATED,
          actorRole: "CLIENT",
          details: taskTitle || taskData.task_title || `Task #${taskId}`,
        });
      } catch (auditError) {
        console.error("Audit log failed:", auditError);
      }
    }

    // -----------------------------------------------------
    // 4️⃣ SEND EMAIL TO ADMIN ON TASK COMPLETION
    // -----------------------------------------------------
    const isNewlyCompleted = status === "Completed" && previousStatus !== "Completed";

    if (isNewlyCompleted && taskData) {
      try {
        const admins = await getAdminsWithNotificationsEnabled();

        if (admins.length > 0) {
          const whoRole = (completedByRole || taskData.assigned_to_role || "CLIENT").toUpperCase();
          let whoName = completedByName || "";

          if (!whoName) {
            switch (whoRole) {
              case "CLIENT":
                whoName = clientData?.primary_contact_name || clientData?.client_name || "Client";
                break;
              case "CPA":
                whoName = clientData?.cpa_centers?.cpa_name || "CPA";
                break;
              case "SERVICE_CENTER":
                whoName = clientData?.service_centers?.center_name || "Service Center";
                break;
              default:
                whoName = "User";
            }
          }

          for (const admin of admins) {
            try {
              await sendAdminTaskCompletionEmail({
                adminEmail: admin.email,
                adminName: admin.name || "Admin",
                taskTitle: taskTitle || taskData.task_title,
                clientName: clientData?.client_name || "Unknown Client",
                completedByRole: whoRole as 'CLIENT' | 'CPA' | 'SERVICE_CENTER',
                completedByName: whoName,
                taskType: "ASSIGNED",
              });
            } catch (err) {
              console.error(`❌ Failed to send to admin ${admin.email}:`, err);
            }
          }
        }
      } catch (adminEmailError) {
        console.error("❌ Admin task completion email error:", adminEmailError);
      }
    }

    // -----------------------------------------------------
    // 5️⃣ SEND EMAIL NOTIFICATION TO ASSIGNEE (IF ENABLED)
    // -----------------------------------------------------
    if (sendNotification && updatedFields.length > 0 && taskData) {
      try {
        const targetRole = assignedToRole || taskData.assigned_to_role || "CLIENT";

        let recipientEmail: string | null = null;
        let recipientName: string = "";
        let recipientRole: "CLIENT" | "CPA" | "SERVICE_CENTER" = "CLIENT";

        switch (targetRole.toUpperCase()) {
          case "CLIENT":
            recipientEmail = clientData?.primary_contact_email;
            recipientName = clientData?.primary_contact_name || clientData?.client_name;
            recipientRole = "CLIENT";
            break;

          case "CPA":
            recipientEmail = clientData?.cpa_centers?.email;
            recipientName = clientData?.cpa_centers?.cpa_name || "CPA";
            recipientRole = "CPA";
            break;

          case "SERVICE_CENTER":
            recipientEmail = clientData?.service_centers?.email;
            recipientName = clientData?.service_centers?.center_name || "Service Center";
            recipientRole = "SERVICE_CENTER";
            break;
        }

        if (recipientEmail) {
          await sendTaskNotificationEmail({
            recipientEmail,
            recipientName,
            recipientRole,
            taskTitle: taskTitle || taskData.task_title,
            dueDate: dueDate || taskData.due_date,
            clientName: clientData?.client_name,
            notificationType: "updated",
            updatedFields,
            assignedByName: "Admin",
          });
        }
      } catch (emailError) {
        console.error("❌ Task update notification email error:", emailError);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("POST /api/tasks/update error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update task" },
      { status: 500 }
    );
  }
}
