// app/api/service-centers/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendUpdateNotification } from "@/lib/email";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { center_id, center_name, center_code, email, users } = body;

    if (!center_id) {
      return NextResponse.json(
        { success: false, error: "center_id is required" },
        { status: 400 }
      );
    }

    // 1. CHECK FOR DUPLICATE SERVICE CENTER NAME
    if (center_name) {
      const { data: existingName } = await supabase
        .from("service_centers")
        .select("service_center_id, center_name")
        .ilike("center_name", center_name.trim())
        .neq("service_center_id", center_id)
        .maybeSingle();

      if (existingName) {
        return NextResponse.json(
          {
            success: false,
            error: `A service center named "${existingName.center_name}" already exists`
          },
          { status: 409 }
        );
      }
    }

    // 2. CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES
    if (email && email.trim()) {
      const searchEmail = email.trim().toLowerCase();

      // Check Clients
      const { data: existingClient } = await supabase
        .from("Clients")
        .select("client_name")
        .ilike("primary_contact_email", searchEmail)
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
        .neq("service_center_id", center_id)
        .maybeSingle();

      if (existingSC) {
        return NextResponse.json({ success: false, error: `This email is already used by service center: "${existingSC.center_name}"` }, { status: 409 });
      }
    }

    // 3. GET OLD EMAIL BEFORE UPDATE (for syncing Users table)
    const { data: scData } = await supabase
      .from("service_centers")
      .select("email")
      .eq("service_center_id", center_id)
      .maybeSingle();
    const oldEmail = scData?.email;

    // 4. UPDATE SERVICE CENTER
    const { error: updateError } = await supabase
      .from("service_centers")
      .update({
        center_name,
        center_code,
        email,
        updated_at: new Date().toISOString()
      })
      .eq("service_center_id", center_id);

    if (updateError) throw updateError;

    // 5. SYNC EMAIL TO USERS TABLE
    if (email && email.trim() && oldEmail && email.toLowerCase() !== oldEmail.toLowerCase()) {
      const { error: userError } = await supabase
        .from("Users")
        .update({ email: email.toLowerCase() })
        .eq("email", oldEmail.toLowerCase())
        .eq("role", "SERVICE_CENTER");

      if (userError) console.error("⚠️ Failed to sync Users table email:", userError.message);
      else console.log(`✅ Service Center login email updated from ${oldEmail} to ${email}`);
    }

    // 6. SEND NOTIFICATION
    if (email) {
      sendUpdateNotification({
        recipientEmail: email,
        recipientName: center_name,
        updateType: 'profile_updated',
        details: {
          title: 'Your Service Center Profile Has Been Updated',
          description: `Your Service Center profile "${center_name}" has been updated by the administrator.`,
          actionUrl: 'https://legacy.hubonesystems.net/login',
          actionLabel: 'View Your Profile',
        },
      }).catch(err => console.error("⚠️ Notification failed:", err));
    }

    // 7. UPDATE ASSOCIATED USERS
    if (Array.isArray(users)) {
      // Delete existing
      const { error: deleteError } = await supabase
        .from("service_center_users")
        .delete()
        .eq("service_center_id", center_id);

      if (deleteError) console.error("⚠️ Failed to delete old associated users:", deleteError.message);

      // Insert new
      const usersToInsert = users
        .filter(u => u.name && u.email)
        .map(u => ({
          service_center_id: center_id,
          user_name: u.name,
          email: u.email,
          role: u.role || "User",
          phone: u.phone || null,
          created_at: new Date().toISOString()
        }));

      if (usersToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("service_center_users")
          .insert(usersToInsert);

        if (insertError) console.error("⚠️ Failed to insert new associated users:", insertError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Service Center updated successfully",
    });

  } catch (err: any) {
    console.error("UPDATE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update service center" },
      { status: 500 }
    );
  }
}
