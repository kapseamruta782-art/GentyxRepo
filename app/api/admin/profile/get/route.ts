// app/api/admin/profile/get/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("AdminSettings")
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // If no admin settings exist, return a default object or handle accordingly
      return NextResponse.json({
        success: true,
        data: {
          full_name: "Admin User",
          email: "admin@mail.com",
          phone: "",
          role: "Administrator"
        }
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Fetch Admin Profile Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch admin profile" }, { status: 500 });
  }
}
