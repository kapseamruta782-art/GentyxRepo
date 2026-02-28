// app/api/help/admin/faqs/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// POST - Add new FAQ
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { role_id, question, answer, display_order } = body;

        const { data, error } = await supabase
            .from("help_faqs")
            .insert({
                role_id,
                question,
                answer,
                display_order: display_order || 0
            })
            .select("faq_id")
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            faq_id: data?.faq_id,
        });
    } catch (err: any) {
        console.error("POST /api/help/admin/faqs error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to add FAQ" },
            { status: 500 }
        );
    }
}

// PUT - Update FAQ
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { faq_id, question, answer, display_order } = body;

        const { error } = await supabase
            .from("help_faqs")
            .update({
                question,
                answer,
                display_order
            })
            .eq("faq_id", faq_id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("PUT /api/help/admin/faqs error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update FAQ" },
            { status: 500 }
        );
    }
}

// DELETE - Remove FAQ
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const faq_id = searchParams.get("id");

        if (!faq_id) {
            return NextResponse.json({ success: false, error: "Missing FAQ ID" }, { status: 400 });
        }

        const { error } = await supabase
            .from("help_faqs")
            .delete()
            .eq("faq_id", parseInt(faq_id));

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("DELETE /api/help/admin/faqs error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to delete FAQ" },
            { status: 500 }
        );
    }
}
