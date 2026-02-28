// app/api/users/suggestions/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

/**
 * GET /api/users/suggestions
 * Returns unique users from client_users and service_center_users tables
 * for autocomplete suggestions
 */
export async function GET() {
  try {
    // Get unique users from both client_users and service_center_users
    // We'll fetch both and combine in JS to simulate the UNION
    const [clientUsersRes, scUsersRes] = await Promise.all([
      supabase.from("client_users").select("user_name, email, role, phone"),
      supabase.from("service_center_users").select("user_name, email, role, phone")
    ]);

    if (clientUsersRes.error) throw clientUsersRes.error;
    if (scUsersRes.error) throw scUsersRes.error;

    const combined = [...(clientUsersRes.data || []), ...(scUsersRes.data || [])];

    // Remove duplicates and filter out empty names
    const uniqueMap = new Map();
    for (const user of combined) {
      const name = (user.user_name || "").trim();
      if (name && !uniqueMap.has(name)) {
        uniqueMap.set(name, {
          name: name,
          email: user.email,
          role: user.role,
          phone: user.phone
        });
      }
    }

    const result = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (err: any) {
    console.error("USERS SUGGESTIONS ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch user suggestions" },
      { status: 500 }
    );
  }
}
