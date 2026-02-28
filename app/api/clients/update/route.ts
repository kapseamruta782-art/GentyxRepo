// app/api/clients/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendUpdateNotification } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      clientId,
      client_name,
      code,
      primary_contact_first_name,
      primary_contact_last_name,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      service_center_id,
      cpa_id,
      associatedUsers
    } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID missing" },
        { status: 400 }
      );
    }

    // Combine first and last name if not provided separately
    const fullContactName = primary_contact_name ||
      `${primary_contact_first_name || ''} ${primary_contact_last_name || ''}`.trim();

    // If Company Name is empty, use the Contact Name as the Client Name
    const trimmedClientName = client_name?.trim();
    const finalClientName = trimmedClientName || fullContactName;

    // 1. CHECK FOR DUPLICATE CLIENT NAME (CASE-INSENSITIVE, EXCLUDING CURRENT)
    if (finalClientName) {
      const { data: existingName } = await supabase
        .from("Clients")
        .select("client_id, client_name")
        .ilike("client_name", finalClientName)
        .neq("client_id", clientId)
        .maybeSingle();

      if (existingName) {
        return NextResponse.json(
          {
            success: false,
            error: `A client named "${existingName.client_name}" already exists`
          },
          { status: 409 }
        );
      }
    }

    // 2. CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (EXCLUDING CURRENT CLIENT)
    if (primary_contact_email && primary_contact_email.trim()) {
      const searchEmail = primary_contact_email.trim().toLowerCase();

      // Check Clients
      const { data: existingClient } = await supabase
        .from("Clients")
        .select("client_name")
        .ilike("primary_contact_email", searchEmail)
        .neq("client_id", clientId)
        .maybeSingle();

      if (existingClient) {
        return NextResponse.json({ success: false, error: `This email is already used by client: "${existingClient.client_name}"` }, { status: 409 });
      }

      // Check CPAs
      const { data: existingCpa } = await supabase
        .from("cpa_centers")
        .select("cpa_name")
        .ilike("email", searchEmail)
        .maybeSingle();

      if (existingCpa) {
        return NextResponse.json({ success: false, error: `This email is already used by CPA: "${existingCpa.cpa_name}"` }, { status: 409 });
      }

      // Check Service Centers
      const { data: existingSC } = await supabase
        .from("service_centers")
        .select("center_name")
        .ilike("email", searchEmail)
        .maybeSingle();

      if (existingSC) {
        return NextResponse.json({ success: false, error: `This email is already used by service center: "${existingSC.center_name}"` }, { status: 409 });
      }
    }

    // 3. GET OLD EMAIL BEFORE UPDATE (for syncing Users table)
    const { data: oldClientData } = await supabase
      .from("Clients")
      .select("primary_contact_email, service_center_id, cpa_id")
      .eq("client_id", clientId)
      .maybeSingle();
    const oldEmail = oldClientData?.primary_contact_email;

    // 4. UPDATE CLIENT
    const { error: updateError } = await supabase
      .from("Clients")
      .update({
        client_name: finalClientName,
        code,
        primary_contact_first_name: primary_contact_first_name || null,
        primary_contact_last_name: primary_contact_last_name || null,
        primary_contact_name: fullContactName,
        primary_contact_email,
        primary_contact_phone,
        service_center_id: service_center_id || null,
        cpa_id: cpa_id || null,
        updated_at: new Date().toISOString()
      })
      .eq("client_id", clientId);

    if (updateError) throw updateError;

    // 5. SYNC EMAIL TO USERS TABLE
    if (primary_contact_email && primary_contact_email.trim() && oldEmail &&
      primary_contact_email.toLowerCase() !== oldEmail.toLowerCase()) {
      const { error: userError } = await supabase
        .from("Users")
        .update({ email: primary_contact_email.toLowerCase() })
        .eq("email", oldEmail.toLowerCase())
        .eq("role", "CLIENT");

      if (userError) console.error("⚠️ Failed to sync Users table email:", userError.message);
      else console.log(`✅ Client login email updated from ${oldEmail} to ${primary_contact_email}`);
    }

    // 6. AUDIT LOGS
    logAudit({
      clientId,
      action: AuditActions.CLIENT_UPDATED,
      actorRole: "ADMIN",
      details: finalClientName,
    });

    if (service_center_id && service_center_id !== oldClientData?.service_center_id) {
      logAudit({ clientId, action: AuditActions.SERVICE_CENTER_ASSIGNED, actorRole: "ADMIN" });
    }

    if (cpa_id && cpa_id !== oldClientData?.cpa_id) {
      logAudit({ clientId, action: AuditActions.CPA_ASSIGNED, actorRole: "ADMIN" });
    }

    // 7. NOTIFICATION
    if (primary_contact_email) {
      sendUpdateNotification({
        recipientEmail: primary_contact_email,
        recipientName: fullContactName || finalClientName,
        updateType: 'profile_updated',
        details: {
          title: 'Your Profile Has Been Updated',
          description: `Your client profile "${finalClientName}" has been updated by the administrator.`,
          actionUrl: 'https://legacy.hubonesystems.net/login',
          actionLabel: 'View Your Profile',
        },
      }).catch(err => console.error("⚠️ Notification failed:", err));
    }

    // 8. UPDATE ASSOCIATED USERS
    if (Array.isArray(associatedUsers)) {
      // Delete existing
      const { error: deleteError } = await supabase
        .from("client_users")
        .delete()
        .eq("client_id", clientId);

      if (deleteError) console.error("⚠️ Failed to delete old associated users:", deleteError.message);

      // Insert new
      const usersToInsert = associatedUsers
        .filter(u => u.name && u.email)
        .map(u => ({
          client_id: clientId,
          user_name: u.name,
          email: u.email,
          role: u.role || "Client User",
          phone: u.phone || null,
          created_at: new Date().toISOString()
        }));

      if (usersToInsert.length > 0) {
        const { error: assocError } = await supabase
          .from("client_users")
          .insert(usersToInsert);

        if (assocError) console.error("⚠️ Failed to insert associated users:", assocError.message);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("UPDATE CLIENT ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update client" },
      { status: 500 }
    );
  }
}
