// app/api/help/admin/responsibilities/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// POST - Add new responsibility
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { role_id, description, display_order } = body;

        const { data, error } = await supabase
            .from("help_responsibilities")
            .insert({
                role_id,
                description,
                display_order: display_order || 0
            })
            .select("responsibility_id")
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            responsibility_id: data?.responsibility_id,
        });
    } catch (err: any) {
        console.error("POST /api/help/admin/responsibilities error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to add responsibility" },
            { status: 500 }
        );
    }
}

// PUT - Update responsibility
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { responsibility_id, description, display_order } = body;

        const { error } = await supabase
            .from("help_responsibilities")
            .update({
                description,
                display_order
            })
            .eq("responsibility_id", responsibility_id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("PUT /api/help/admin/responsibilities error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update responsibility" },
            { status: 500 }
        );
    }
}

// DELETE - Remove responsibility
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const responsibility_id = searchParams.get("id");

        if (!responsibility_id) {
            return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
        }

        const { error } = await supabase
            .from("help_responsibilities")
            .delete()
            .eq("responsibility_id", parseInt(responsibility_id));

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("DELETE /api/help/admin/responsibilities error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to delete responsibility" },
            { status: 500 }
        );
    }
}
