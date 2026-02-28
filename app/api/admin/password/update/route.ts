// app/api/admin/password/update/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const { currentPassword, newPassword } = await req.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
        }

        // 1. Get current admin email
        const { data: adminData, error: adminError } = await supabase
            .from("AdminSettings")
            .select("email")
            .maybeSingle();

        if (adminError) throw adminError;
        const adminEmail = adminData?.email;

        if (!adminEmail) {
            return NextResponse.json({ success: false, error: "Admin profile not found" }, { status: 404 });
        }

        // 2. Verify current password
        const { data: user, error: userError } = await supabase
            .from("Users")
            .select("*")
            .eq("email", adminEmail)
            .eq("role", "ADMIN")
            .maybeSingle();

        if (userError) throw userError;

        if (!user || user.password !== currentPassword) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 401 });
        }

        // 3. Update password
        const { error: updateError } = await supabase
            .from("Users")
            .update({ password: newPassword })
            .eq("email", adminEmail)
            .eq("role", "ADMIN");

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Update Password Error:", err);
        return NextResponse.json({ success: false, error: err.message || "Failed to update password" }, { status: 500 });
    }
}
