// app/api/admin/profile/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { full_name, email, phone } = body;

        // 1. Get current admin email before update
        const { data: currentAdmin, error: fetchError } = await supabase
            .from("AdminSettings")
            .select("email")
            .maybeSingle();

        if (fetchError) throw fetchError;
        const oldEmail = currentAdmin?.email;

        // 2. Update AdminSettings
        // Since it's a single-row table, we update the row we find or the first one
        const { error: updateError } = await supabase
            .from("AdminSettings")
            .update({
                full_name,
                email,
                phone,
                updated_at: new Date().toISOString()
            })
            .eq("id", currentAdmin?.id || 1); // Fallback to id 1 if not found

        if (updateError) throw updateError;

        // 3. Sync email in Users table if changed
        if (oldEmail && oldEmail !== email) {
            const { error: syncError } = await supabase
                .from("Users")
                .update({ email: email })
                .eq("email", oldEmail)
                .eq("role", "ADMIN");

            if (syncError) {
                console.error("⚠️ Failed to sync admin email in Users table:", syncError.message);
                // We don't necessarily fail the whole request if sync fails, 
                // but for Admin it's fairly critical.
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Update Admin Profile Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to update admin profile" }, { status: 500 });
    }
}
