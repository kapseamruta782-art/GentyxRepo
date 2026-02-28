// app/api/cpas/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendUpdateNotification } from "@/lib/email";

export async function POST(req: Request) {
  return handleUpdate(req);
}

export async function PUT(req: Request) {
  return handleUpdate(req);
}

async function handleUpdate(req: Request) {
  try {
    const body = await req.json();
    const { cpa_id, cpa_name, cpa_code, name, email } = body;

    if (!cpa_id) {
      return NextResponse.json(
        { success: false, message: "CPA ID is required" },
        { status: 400 }
      );
    }

    const actualName = cpa_name || name;

    // 1. CHECK FOR DUPLICATE CPA NAME (CASE-INSENSITIVE, EXCLUDING CURRENT)
    if (actualName) {
      const { data: existingName } = await supabase
        .from("cpa_centers")
        .select("cpa_id, cpa_name")
        .ilike("cpa_name", actualName.trim())
        .neq("cpa_id", cpa_id)
        .maybeSingle();

      if (existingName) {
        return NextResponse.json(
          {
            success: false,
            message: `A CPA named "${existingName.cpa_name}" already exists`
          },
          { status: 409 }
        );
      }
    }

    // 2. CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (EXCLUDING CURRENT CPA)
    if (email && email.trim()) {
      const searchEmail = email.trim().toLowerCase();

      // Check Clients
      const { data: existingClient } = await supabase
        .from("Clients")
        .select("client_name")
        .ilike("primary_contact_email", searchEmail)
        .maybeSingle();

      if (existingClient) {
        return NextResponse.json({ success: false, message: `This email is already used by client: "${existingClient.client_name}"` }, { status: 409 });
      }

      // Check CPAs
      const { data: existingCpa } = await supabase
        .from("cpa_centers")
        .select("cpa_name")
        .ilike("email", searchEmail)
        .neq("cpa_id", cpa_id)
        .maybeSingle();

      if (existingCpa) {
        return NextResponse.json({ success: false, message: `This email is already used by CPA: "${existingCpa.cpa_name}"` }, { status: 409 });
      }

      // Check Service Centers
      const { data: existingSC } = await supabase
        .from("service_centers")
        .select("center_name")
        .ilike("email", searchEmail)
        .maybeSingle();

      if (existingSC) {
        return NextResponse.json({ success: false, message: `This email is already used by service center: "${existingSC.center_name}"` }, { status: 409 });
      }
    }

    // 3. GET OLD EMAIL BEFORE UPDATE (for syncing Users table)
    const { data: cpaData } = await supabase
      .from("cpa_centers")
      .select("email")
      .eq("cpa_id", cpa_id)
      .maybeSingle();
    const oldEmail = cpaData?.email;

    // 4. UPDATE CPA CENTER
    const { error: updateError } = await supabase
      .from("cpa_centers")
      .update({
        cpa_name: actualName,
        cpa_code,
        email,
        updated_at: new Date().toISOString()
      })
      .eq("cpa_id", cpa_id);

    if (updateError) throw updateError;

    // 5. SYNC EMAIL TO USERS TABLE
    if (email && email.trim() && oldEmail && email.toLowerCase() !== oldEmail.toLowerCase()) {
      const { error: userError } = await supabase
        .from("Users")
        .update({ email: email.toLowerCase() })
        .eq("email", oldEmail.toLowerCase())
        .eq("role", "CPA");

      if (userError) console.error("⚠️ Failed to sync Users table email:", userError.message);
      else console.log(`✅ CPA login email updated from ${oldEmail} to ${email}`);
    }

    // 6. SEND NOTIFICATION
    if (email) {
      sendUpdateNotification({
        recipientEmail: email,
        recipientName: actualName,
        updateType: 'profile_updated',
        details: {
          title: 'Your CPA Profile Has Been Updated',
          description: `Your CPA profile "${actualName}" has been updated by the administrator.`,
          actionUrl: 'https://legacy.hubonesystems.net/login',
          actionLabel: 'View Your Profile',
        },
      }).catch(err => console.error("⚠️ Notification failed:", err));
    }

    return NextResponse.json({ success: true, message: "CPA updated successfully" });
  } catch (err: any) {
    console.error("CPA update error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to update CPA" },
      { status: 500 }
    );
  }
}
