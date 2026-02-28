// app/api/admin/create/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const { currentPassword, newEmail, newPassword } = await req.json();

        if (!currentPassword || !newEmail || !newPassword) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
        }

        // 1. Get current master admin email (from AdminSettings)
        const { data: adminSettings, error: adminError } = await supabase
            .from("AdminSettings")
            .select("email")
            .maybeSingle();

        if (adminError) throw adminError;
        const adminEmail = adminSettings?.email;

        if (!adminEmail) {
            return NextResponse.json({ success: false, error: "Master admin profile not found" }, { status: 404 });
        }

        // 2. Verify current password against the Master Admin
        const { data: currentUser, error: userError } = await supabase
            .from("Users")
            .select("*")
            .eq("email", adminEmail)
            .eq("role", "ADMIN")
            .maybeSingle();

        if (userError) throw userError;

        if (!currentUser || currentUser.password !== currentPassword) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 401 });
        }

        // 3. Check if new email already exists in Users
        const { data: existingUser, error: checkUserError } = await supabase
            .from("Users")
            .select("id")
            .eq("email", newEmail)
            .maybeSingle();

        if (checkUserError) throw checkUserError;
        if (existingUser) {
            return NextResponse.json({ success: false, error: "Email already exists in Users" }, { status: 400 });
        }

        // Check if email already exists in AdminSettings
        const { data: existingAdmin, error: checkAdminError } = await supabase
            .from("AdminSettings")
            .select("id")
            .eq("email", newEmail)
            .maybeSingle();

        if (checkAdminError) throw checkAdminError;
        if (existingAdmin) {
            return NextResponse.json({ success: false, error: "Email already exists in Admin settings" }, { status: 400 });
        }

        // 4. Create new Admin user in Users table
        const { error: insertUserError } = await supabase
            .from("Users")
            .insert({
                email: newEmail,
                password: newPassword,
                role: 'ADMIN'
            });

        if (insertUserError) throw insertUserError;

        // 5. Add to AdminSettings with notifications enabled by default
        const { error: insertAdminError } = await supabase
            .from("AdminSettings")
            .insert({
                full_name: 'New Admin',
                email: newEmail,
                phone: '',
                role: 'Administrator',
                notifications_enabled: true,
                created_at: new Date().toISOString()
            });

        if (insertAdminError) throw insertAdminError;

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Create Admin Error:", err);
        return NextResponse.json({ success: false, error: err.message || "Failed to create admin" }, { status: 500 });
    }
}
