// app/api/cpas/delete/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { cpa_id } = await req.json();

    if (!cpa_id) {
      return NextResponse.json(
        { success: false, error: "CPA ID is required" },
        { status: 400 }
      );
    }

    // 1. Get CPA email for user credentials deletion
    const { data: cpaData, error: cpaError } = await supabase
      .from("cpa_centers")
      .select("email, cpa_name")
      .eq("cpa_id", cpa_id)
      .maybeSingle();

    if (cpaError) throw cpaError;

    const cpaEmail = cpaData?.email;
    const cpaName = cpaData?.cpa_name || "Unknown";

    console.log(`🗑️ Starting deletion of CPA: ${cpaName} (ID: ${cpa_id})`);

    // 2. Delete user credentials from Users table
    if (cpaEmail) {
      const { error: userError } = await supabase
        .from("Users")
        .delete()
        .eq("email", cpaEmail.toLowerCase());

      if (userError) console.error("⚠️ Failed to delete user credentials:", userError.message);
      else console.log("  ✓ Deleted user credentials");
    }

    // 3. Delete the CPA record
    const { error: deleteError } = await supabase
      .from("cpa_centers")
      .delete()
      .eq("cpa_id", cpa_id);

    if (deleteError) throw deleteError;
    console.log("  ✓ Deleted CPA record");

    console.log(`✅ Successfully deleted CPA: ${cpaName} (ID: ${cpa_id})`);

    return NextResponse.json({
      success: true,
      message: `CPA "${cpaName}" and credentials deleted successfully`
    });
  } catch (err: any) {
    console.error("DELETE CPA ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete CPA" },
      { status: 500 }
    );
  }
}
