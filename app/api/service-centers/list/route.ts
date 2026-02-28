// app/api/service-centers/list/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    // 1. Get service centers with client count
    // In Supabase, we can use a select with a count relation or handle in JS
    const { data: centers, error: centersError } = await supabase
      .from("service_centers")
      .select(`
        center_id:service_center_id,
        center_name,
        center_code,
        email,
        Clients ( client_id )
      `)
      .order("center_name", { ascending: true });

    if (centersError) throw centersError;

    // 2. Get all associated users for service centers
    const { data: users, error: usersError } = await supabase
      .from("service_center_users")
      .select(`
        id,
        service_center_id,
        name:user_name,
        email,
        role,
        phone
      `)
      .order("id", { ascending: true });

    if (usersError) throw usersError;

    // 3. Map users to their service centers
    const usersByCenter: Record<number, any[]> = {};
    for (const user of (users || [])) {
      const centerId = user.service_center_id;
      if (!usersByCenter[centerId]) {
        usersByCenter[centerId] = [];
      }
      usersByCenter[centerId].push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      });
    }

    // 4. Attach users and client count to each service center
    const result = (centers || []).map((center: any) => ({
      center_id: center.center_id,
      center_name: center.center_name,
      center_code: center.center_code,
      email: center.email,
      clients_assigned: center.Clients?.length || 0,
      users: usersByCenter[center.center_id] || [],
    }));

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (err: any) {
    console.error("SERVICE CENTER LIST ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch service centers" },
      { status: 500 }
    );
  }
}
