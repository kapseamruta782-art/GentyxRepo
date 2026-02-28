// app/api/cpas/add/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendCpaWelcomeEmail } from "@/lib/email";

const DEFAULT_PASSWORD = "Cpa@12345";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    if (!name) {
      return NextResponse.json(
        { success: false, message: "CPA name is required" },
        { status: 400 }
      );
    }

    // 1. CHECK FOR DUPLICATE CPA NAME (CASE-INSENSITIVE)
    const { data: existingName } = await supabase
      .from("cpa_centers")
      .select("cpa_id, cpa_name")
      .ilike("cpa_name", name.trim())
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
        return NextResponse.json({ success: false, message: `This email is already used by client: "${existingClient.client_name}"` }, { status: 409 });
      }

      // Check CPAs
      const { data: existingCpa } = await supabase
        .from("cpa_centers")
        .select("cpa_name")
        .ilike("email", searchEmail)
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

    // 3. GENERATE CPA CODE
    const { data: countData, error: countError } = await supabase
      .from("cpa_centers")
      .select("cpa_id", { count: "exact" });

    if (countError) throw countError;
    const nextId = (countData?.length || 0) + 1;
    const nextCode = `CPA${String(nextId).padStart(3, "0")}`;

    // 4. INSERT INTO CPA CENTERS
    const { data: insertedCpa, error: insertError } = await supabase
      .from("cpa_centers")
      .insert({
        cpa_code: nextCode,
        cpa_name: name,
        email: email || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;
    const newCpaId = insertedCpa.cpa_id;

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
            password: DEFAULT_PASSWORD,
            role: "CPA"
          });

        if (userError) console.error("⚠️ Failed to create user credentials:", userError.message);
        else {
          console.log(`✅ Created CPA user credentials for ${email}`);
          // Send welcome email
          sendCpaWelcomeEmail(email, name, nextCode).catch(err => console.error("⚠️ Welcome email failed:", err));
        }
      }
    }

    return NextResponse.json({
      success: true,
      cpa_id: newCpaId,
      cpa_code: nextCode,
      message: `CPA created successfully. Login: ${email} / ${DEFAULT_PASSWORD}`,
    });
  } catch (err: any) {
    console.error("CREATE CPA ERROR:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to create CPA" },
      { status: 500 }
    );
  }
}
