// app/api/messages/add/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendMessageNotification, sendAdminMessageNotification, getAdminsWithNotificationsEnabled } from "@/lib/email";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const {
      client_id,
      sender_role,
      receiver_role,
      body,
      parent_message_id,
      attachment_url,
      attachment_name,
      service_center_id,
      cpa_id
    } = await req.json();

    // Handle client_id: convert "0" or invalid values to null for admin-level chats
    const parsedClientId = client_id ? parseInt(client_id) : 0;
    const validClientId = parsedClientId > 0 ? parsedClientId : null;

    // Handle service_center_id and cpa_id
    const parsedServiceCenterId = service_center_id ? parseInt(service_center_id) : null;
    const parsedCpaId = cpa_id ? parseInt(cpa_id) : null;

    console.log("📨 Adding message:", { client_id, parsedClientId, validClientId, sender_role, receiver_role, service_center_id: parsedServiceCenterId, cpa_id: parsedCpaId });

    // Insert the message into Supabase
    const { data: insertedMessage, error: insertError } = await supabase
      .from("onboarding_messages")
      .insert({
        client_id: validClientId,
        sender_role,
        receiver_role,
        body,
        parent_message_id: parent_message_id || null,
        attachment_url: attachment_url || null,
        attachment_name: attachment_name || null,
        service_center_id: parsedServiceCenterId,
        cpa_id: parsedCpaId
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Insert failed:", insertError.message);
      throw insertError;
    }

    console.log("✅ Message inserted successfully");

    // Send email notification (async, non-blocking)
    handleEmailNotification({
      clientId: validClientId,
      senderRole: sender_role,
      receiverRole: receiver_role,
      serviceCenterId: parsedServiceCenterId,
      cpaId: parsedCpaId,
      messageBody: body,
    }).catch(err => console.error("❌ Email notification failed:", err));

    // Audit log (only for client-related messages)
    if (validClientId) {
      logAudit({
        clientId: validClientId,
        action: AuditActions.MESSAGE_SENT,
        actorRole: sender_role === "ADMIN" ? "ADMIN" : "CLIENT",
        details: body.substring(0, 50) + (body.length > 50 ? "..." : ""),
      });
    }

    return NextResponse.json({ success: true, data: insertedMessage });
  } catch (err: any) {
    console.error("POST /api/messages/add error:", err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

interface EmailNotificationParams {
  clientId: number | null;
  senderRole: string;
  receiverRole: string;
  serviceCenterId: number | null;
  cpaId: number | null;
  messageBody: string;
}

/**
 * Handle email notification logic based on sender/receiver roles
 */
async function handleEmailNotification(params: EmailNotificationParams) {
  const { clientId, senderRole, receiverRole, serviceCenterId, cpaId, messageBody } = params;

  console.log("📧 handleEmailNotification called:", { senderRole, receiverRole, clientId, serviceCenterId, cpaId });

  const isValidName = (name: string | null | undefined): boolean => {
    if (!name) return false;
    const trimmed = name.trim();
    return !!trimmed && !/^\d+$/.test(trimmed);
  };

  // 1. Admin Messaging Client
  if (senderRole === "ADMIN" && receiverRole === "CLIENT" && clientId) {
    const { data: client } = await supabase
      .from("Clients")
      .select("client_name, primary_contact_email, primary_contact_name")
      .eq("client_id", clientId)
      .maybeSingle();

    if (client?.primary_contact_email) {
      const recipientName = isValidName(client.primary_contact_name) ? client.primary_contact_name.trim() : (isValidName(client.client_name) ? client.client_name.trim() : "Valued Client");
      return await sendMessageNotification({
        recipientEmail: client.primary_contact_email,
        recipientName,
        senderName: "Your Account Manager",
        messagePreview: messageBody,
        clientId,
      });
    }
  }

  // 2. Admin Messaging Service Center
  if (senderRole === "ADMIN" && receiverRole === "SERVICE_CENTER" && serviceCenterId) {
    const { data: sc } = await supabase
      .from("service_centers")
      .select("center_name, email")
      .eq("service_center_id", serviceCenterId)
      .maybeSingle();

    if (sc?.email) {
      return await sendMessageNotification({
        recipientEmail: sc.email,
        recipientName: sc.center_name || "Service Center",
        senderName: "Admin - Legacy ClientHub",
        messagePreview: messageBody,
        clientId: clientId || 0,
      });
    }
  }

  // 3. Admin Messaging CPA
  if (senderRole === "ADMIN" && receiverRole === "CPA" && cpaId) {
    const { data: cpa } = await supabase
      .from("cpa_centers")
      .select("cpa_name, email")
      .eq("cpa_id", cpaId)
      .maybeSingle();

    if (cpa?.email) {
      return await sendMessageNotification({
        recipientEmail: cpa.email,
        recipientName: cpa.cpa_name || "CPA",
        senderName: "Admin - Legacy ClientHub",
        messagePreview: messageBody,
        clientId: clientId || 0,
      });
    }
  }

  // 4. Client Messaging Admin
  if (senderRole === "CLIENT" && receiverRole === "ADMIN" && clientId) {
    const { data: client } = await supabase
      .from("Clients")
      .select("client_name, primary_contact_name")
      .eq("client_id", clientId)
      .maybeSingle();

    const admins = await getAdminsWithNotificationsEnabled();
    if (admins.length > 0) {
      for (const admin of admins) {
        await sendAdminMessageNotification({
          adminEmail: admin.email,
          adminName: admin.name || "Admin",
          senderName: isValidName(client?.primary_contact_name) ? client!.primary_contact_name : (client?.client_name || "Client"),
          senderRole: "CLIENT",
          messagePreview: messageBody,
          clientName: client?.client_name || "Client",
        });
      }
      return { success: true };
    }
  }

  // 5. Client Messaging Service Center (Default)
  if (senderRole === "CLIENT" && clientId && receiverRole !== "ADMIN") {
    const { data } = await supabase
      .from("Clients")
      .select(`
        client_name,
        service_centers(email, center_name)
      `)
      .eq("client_id", clientId)
      .maybeSingle();

    const sc = (data as any)?.service_centers;
    if (sc?.email) {
      return await sendMessageNotification({
        recipientEmail: sc.email,
        recipientName: sc.center_name || "Admin",
        senderName: data?.client_name || "Client",
        messagePreview: messageBody,
        clientId,
      });
    }
  }

  // 6. Service Center Messaging Admin
  if (senderRole === "SERVICE_CENTER" && receiverRole === "ADMIN") {
    let scName = "Service Center";
    if (serviceCenterId) {
      const { data: sc } = await supabase.from("service_centers").select("center_name").eq("service_center_id", serviceCenterId).maybeSingle();
      scName = sc?.center_name || "Service Center";
    }
    const admins = await getAdminsWithNotificationsEnabled();
    for (const admin of admins) {
      await sendAdminMessageNotification({
        adminEmail: admin.email,
        adminName: admin.name || "Admin",
        senderName: scName,
        senderRole: "SERVICE_CENTER",
        messagePreview: messageBody,
      });
    }
    return { success: true };
  }

  // 7. CPA Messaging Admin
  if (senderRole === "CPA" && receiverRole === "ADMIN") {
    let cpaName = "CPA";
    if (cpaId) {
      const { data: cpa } = await supabase.from("cpa_centers").select("cpa_name").eq("cpa_id", cpaId).maybeSingle();
      cpaName = cpa?.cpa_name || "CPA";
    }
    const admins = await getAdminsWithNotificationsEnabled();
    for (const admin of admins) {
      await sendAdminMessageNotification({
        adminEmail: admin.email,
        adminName: admin.name || "Admin",
        senderName: cpaName,
        senderRole: "CPA",
        messagePreview: messageBody,
      });
    }
    return { success: true };
  }

  // 8. Service Center Messaging Client
  if (senderRole === "SERVICE_CENTER" && receiverRole === "CLIENT" && clientId) {
    const { data } = await supabase
      .from("Clients")
      .select(`
        client_name, primary_contact_email, primary_contact_name,
        service_centers(center_name)
      `)
      .eq("client_id", clientId)
      .maybeSingle();

    if (data?.primary_contact_email) {
      const sc = (data as any)?.service_centers;
      const recipientName = isValidName(data.primary_contact_name) ? data.primary_contact_name.trim() : (isValidName(data.client_name) ? data.client_name.trim() : "Valued Client");
      return await sendMessageNotification({
        recipientEmail: data.primary_contact_email,
        recipientName,
        senderName: sc?.center_name || "Your Service Center",
        messagePreview: messageBody,
        clientId,
      });
    }
  }

  // 9. CPA Messaging Client
  if (senderRole === "CPA" && receiverRole === "CLIENT" && clientId) {
    const { data } = await supabase
      .from("Clients")
      .select(`
        client_name, primary_contact_email, primary_contact_name,
        cpa_centers(cpa_name)
      `)
      .eq("client_id", clientId)
      .maybeSingle();

    if (data?.primary_contact_email) {
      const cpa = (data as any)?.cpa_centers;
      const recipientName = isValidName(data.primary_contact_name) ? data.primary_contact_name.trim() : (isValidName(data.client_name) ? data.client_name.trim() : "Valued Client");
      return await sendMessageNotification({
        recipientEmail: data.primary_contact_email,
        recipientName,
        senderName: cpa?.cpa_name || "Your CPA",
        messagePreview: messageBody,
        clientId,
      });
    }
  }

  console.warn("⚠️ No email notification scenario matched:", { senderRole, receiverRole, clientId, serviceCenterId, cpaId });
  return { success: false, reason: "No matching notification scenario" };
}
