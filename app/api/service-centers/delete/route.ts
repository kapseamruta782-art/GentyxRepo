// app/api/service-centers/delete/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    // 1. Get service center email for user credentials deletion
    const { data: scData, error: scError } = await supabase
      .from("service_centers")
      .select("email, center_name")
      .eq("service_center_id", id)
      .maybeSingle();

    if (scError) throw scError;

    const scEmail = scData?.email;
    const scName = scData?.center_name || "Unknown";

    console.log(`🗑️ Starting deletion of Service Center: ${scName} (ID: ${id})`);

    // 2. Delete user credentials from Users table
    if (scEmail) {
      const { error: userError } = await supabase
        .from("Users")
        .delete()
        .eq("email", scEmail.toLowerCase());

      if (userError) console.error("⚠️ Failed to delete user credentials:", userError.message);
      else console.log("  ✓ Deleted user credentials");
    }

    // 3. Delete the service center record
    const { error: deleteError } = await supabase
      .from("service_centers")
      .delete()
      .eq("service_center_id", id);

    if (deleteError) throw deleteError;
    console.log("  ✓ Deleted service center record");

    console.log(`✅ Successfully deleted Service Center: ${scName} (ID: ${id})`);

    return NextResponse.json({
      success: true,
      message: `Service Center "${scName}" and credentials deleted successfully`,
    });

  } catch (err: any) {
    console.error("DELETE SERVICE CENTER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete service center" },
      { status: 500 }
    );
  }
}
