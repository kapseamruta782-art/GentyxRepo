// app/api/clients/add/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendClientWelcomeEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      clientName,
      code,
      slaNumber,
      primaryContactFirstName,
      primaryContactLastName,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone,
      serviceCenterId,
      cpaId,
      stageId,
      associatedUsers,
    } = body;

    const fullContactName = primaryContactName || `${primaryContactFirstName || ''} ${primaryContactLastName || ''}`.trim();
    const trimmedClientName = clientName?.trim();
    const finalClientName = trimmedClientName || fullContactName;

    if (!finalClientName || !primaryContactEmail) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Check for Duplicate Client Name
    const { data: existingClient, error: checkError } = await supabase
      .from("Clients")
      .select("client_id, client_name")
      .ilike("client_name", finalClientName)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingClient) {
      return NextResponse.json(
        { success: false, error: `A client named "${existingClient.client_name}" already exists` },
        { status: 409 }
      );
    }

    // 2. Check for Duplicate Email across entities
    const trimmedEmail = primaryContactEmail.trim().toLowerCase();
    const [cMatch, cpaMatch, scMatch] = await Promise.all([
      supabase.from("Clients").select("client_name").ilike("primary_contact_email", trimmedEmail).maybeSingle(),
      supabase.from("cpa_centers").select("cpa_name").ilike("email", trimmedEmail).maybeSingle(),
      supabase.from("service_centers").select("center_name").ilike("email", trimmedEmail).maybeSingle()
    ]);

    if (cMatch.data) return NextResponse.json({ success: false, error: `This email is already used by client: "${cMatch.data.client_name}"` }, { status: 409 });
    if (cpaMatch.data) return NextResponse.json({ success: false, error: `This email is already used by CPA: "${cpaMatch.data.cpa_name}"` }, { status: 409 });
    if (scMatch.data) return NextResponse.json({ success: false, error: `This email is already used by service center: "${scMatch.data.center_name}"` }, { status: 409 });

    // 3. Insert Client
    const { data: insertedClient, error: insertError } = await supabase
      .from("Clients")
      .insert({
        client_name: finalClientName,
        code: code || null,
        client_status: 'Active',
        sla_number: slaNumber || null,
        primary_contact_first_name: primaryContactFirstName || null,
        primary_contact_last_name: primaryContactLastName || null,
        primary_contact_name: fullContactName,
        primary_contact_email: primaryContactEmail,
        primary_contact_phone: primaryContactPhone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stage_id: stageId || null,
        progress: 0,
        status: 'Active',
        cpa_id: cpaId || null,
        service_center_id: serviceCenterId || null,
        is_archived: false
      })
      .select("client_id")
      .single();

    if (insertError) throw insertError;
    const clientId = insertedClient.client_id;

    // 4. Insert User for Login
    const { data: existingUser } = await supabase
      .from("Users")
      .select("id")
      .eq("email", primaryContactEmail)
      .maybeSingle();

    if (!existingUser) {
      const { error: userError } = await supabase
        .from("Users")
        .insert({
          email: primaryContactEmail,
          password: "ClientHub@2025",
          role: "CLIENT"
        });

      if (!userError) {
        try {
          await sendClientWelcomeEmail(primaryContactEmail, fullContactName, finalClientName, code || undefined);
        } catch (e) { console.error("Welcome email fail", e); }
      }
    }

    // 5. Seed Default Tasks for Stage
    if (stageId) {
      const { data: stageTasks } = await supabase
        .from("stage_tasks")
        .select("*")
        .eq("stage_id", stageId);

      if (stageTasks && stageTasks.length > 0) {
        const tasksToInsert = stageTasks.map(t => ({
          stage_id: t.stage_id,
          client_id: clientId,
          task_title: t.task_title,
          assigned_to_role: t.assigned_to_role,
          status: 'Pending',
          order_number: t.order_number,
          created_at: new Date().toISOString()
        }));
        await supabase.from("onboarding_tasks").insert(tasksToInsert);
      }
    }

    // 6. Insert Associated Users
    if (Array.isArray(associatedUsers) && associatedUsers.length > 0) {
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
        await supabase.from("client_users").insert(usersToInsert);
      }
    }

    return NextResponse.json({ success: true, clientId });

  } catch (err: any) {
    console.error("POST /api/clients/add error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create client" },
      { status: 500 }
    );
  }
}
