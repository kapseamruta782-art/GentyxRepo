// app/api/user/change-password/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, currentPassword, newPassword } = body;

        if (!email) {
            return NextResponse.json(
                { success: false, message: "Email is required" },
                { status: 400 }
            );
        }

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json(
                { success: false, message: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        // Verify current password if provided
        if (currentPassword) {
            const { data: user, error: userError } = await supabase
                .from("Users")
                .select("password")
                .eq("email", email)
                .maybeSingle();

            if (userError) throw userError;

            if (!user) {
                return NextResponse.json(
                    { success: false, message: "User not found" },
                    { status: 404 }
                );
            }

            if (user.password !== currentPassword) {
                return NextResponse.json(
                    { success: false, message: "Current password is incorrect" },
                    { status: 401 }
                );
            }
        }

        // Update the password
        const { error: updateError } = await supabase
            .from("Users")
            .update({ password: newPassword })
            .eq("email", email);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err: any) {
        console.error("POST /api/user/change-password error:", err);
        return NextResponse.json(
            { success: false, message: err.message || "Failed to update password" },
            { status: 500 }
        );
    }
}
