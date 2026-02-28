// app/api/help/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
    try {
        // Fetch all data in parallel
        const [rolesRes, respRes, flowsRes, faqsRes] = await Promise.all([
            supabase.from("help_roles").select("*").eq("is_active", true).order("display_order"),
            supabase.from("help_responsibilities").select("*").order("display_order"),
            supabase.from("help_flow_steps").select("*").order("display_order"),
            supabase.from("help_faqs").select("*").order("display_order")
        ]);

        if (rolesRes.error) throw rolesRes.error;
        if (respRes.error) throw respRes.error;
        if (flowsRes.error) throw flowsRes.error;
        if (faqsRes.error) throw faqsRes.error;

        // Helper to replace CPA with Preparer in text
        const updateText = (text: string) => {
            if (!text) return text;
            return text
                .replace(/\bCPA\b/g, "Preparer")
                .replace(/\bCPAs\b/g, "Preparers")
                .replace(/\bCPA's\b/g, "Preparer's");
        };

        const roles = (rolesRes.data || []).map((r: any) => ({
            ...r,
            title: r.role_key === 'CPA' ? 'Preparer' : updateText(r.title),
            description: updateText(r.description)
        }));

        const responsibilities = (respRes.data || []).map((r: any) => ({
            ...r,
            description: updateText(r.description)
        }));

        const flowSteps = (flowsRes.data || []).map((r: any) => ({
            ...r,
            title: updateText(r.title),
            description: updateText(r.description)
        }));

        const faqs = (faqsRes.data || []).map((r: any) => ({
            ...r,
            question: updateText(r.question),
            answer: updateText(r.answer)
        }));

        // Build structured response
        const helpContent = roles.map((role: any) => ({
            ...role,
            responsibilities: responsibilities
                .filter((r: any) => r.role_id === role.role_id)
                .map((r: any) => ({
                    id: r.responsibility_id,
                    description: r.description,
                    order: r.display_order,
                })),
            flow: flowSteps
                .filter((f: any) => f.role_id === role.role_id)
                .map((f: any) => ({
                    id: f.step_id,
                    title: f.title,
                    description: f.description,
                    icon: f.icon_name,
                    type: f.step_type,
                    order: f.display_order,
                })),
            faqs: faqs
                .filter((faq: any) => faq.role_id === role.role_id)
                .map((faq: any) => ({
                    id: faq.faq_id,
                    question: faq.question,
                    answer: faq.answer,
                    order: faq.display_order,
                })),
        }));

        return NextResponse.json({
            success: true,
            data: helpContent,
        });
    } catch (err: any) {
        console.error("GET /api/help error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to fetch help content" },
            { status: 500 }
        );
    }
}
