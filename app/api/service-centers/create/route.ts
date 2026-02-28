// app/api/service-centers/create/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendServiceCenterWelcomeEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, users } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Center name is required" },
        { status: 400 }
      );
    }

    // 1. CHECK FOR DUPLICATE SERVICE CENTER NAME (CASE-INSENSITIVE)
    const { data: existingName } = await supabase
      .from("service_centers")
      .select("service_center_id, center_name")
      .ilike("center_name", name.trim())
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

    // 2. CHECK FOR DUPLICATE EMAIL ACROSS ALL ENTITIES (if email provided)
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
        .maybeSingle();

      if (existingSC) {
        return NextResponse.json({ success: false, error: `This email is already used by service center: "${existingSC.center_name}"` }, { status: 409 });
      }
    }

    // 3. GENERATE CENTER CODE
    const { data: countData, error: countError } = await supabase
      .from("service_centers")
      .select("service_center_id", { count: "exact" });

    if (countError) throw countError;
    const nextId = (countData?.length || 0) + 1;
    const centerCode = `SC${String(nextId).padStart(3, "0")}`;

    // 4. INSERT INTO SERVICE CENTERS
    const { data: insertedCenter, error: insertError } = await supabase
      .from("service_centers")
      .insert({
        center_name: name,
        email: email || null,
        center_code: centerCode
      })
      .select()
      .single();

    if (insertError) throw insertError;
    const centerId = insertedCenter.service_center_id;

    // 5. CREATE USER ENTRY
    if (email) {
      const { data: existingUser } = await supabase
        .from("Users")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();

      if (!existingUser) {
        const { error: userError } = await supabase
          .from("Users")
          .insert({
            email: email.trim().toLowerCase(),
            password: "ServiceCenter@2025",
            role: "SERVICE_CENTER"
          });

        if (userError) console.error("⚠️ Failed to create user credentials:", userError.message);
        else {
          console.log(`✅ Created Service Center user credentials for ${email}`);
          // Send welcome email
          sendServiceCenterWelcomeEmail(email, name, centerCode).catch(err => console.error("⚠️ Welcome email failed:", err));
        }
      }
    }

    // 6. INSERT ASSOCIATED USERS
    if (Array.isArray(users) && users.length > 0) {
      const usersToInsert = users
        .filter(u => u.name && u.email)
        .map(u => ({
          service_center_id: centerId,
          user_name: u.name,
          email: u.email,
          role: u.role || "User",
          phone: u.phone || null,
          created_at: new Date().toISOString()
        }));

      if (usersToInsert.length > 0) {
        const { error: assocError } = await supabase
          .from("service_center_users")
          .insert(usersToInsert);

        if (assocError) console.error("⚠️ Failed to insert associated users:", assocError.message);
      }
    }

    return NextResponse.json({
      success: true,
      center_id: centerId,
      center_code: centerCode,
      message: "Service Center created successfully",
    });

  } catch (err: any) {
    console.error("CREATE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create service center" },
      { status: 500 }
    );
  }
}
