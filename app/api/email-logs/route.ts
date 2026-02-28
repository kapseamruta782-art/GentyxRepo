// app/api/email-logs/route.ts
// API endpoint for fetching email logs with filtering and pagination

import { NextResponse } from "next/server";
import { fetchEmailLogs } from "@/lib/email-logger";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);

        // Parse query parameters
        const page = parseInt(url.searchParams.get("page") || "1");
        const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
        const recipientRole = url.searchParams.get("recipientRole") || undefined;
        const status = url.searchParams.get("status") || undefined;
        const emailType = url.searchParams.get("emailType") || undefined;
        const dateFrom = url.searchParams.get("dateFrom") || undefined;
        const dateTo = url.searchParams.get("dateTo") || undefined;
        const search = url.searchParams.get("search") || undefined;

        const result = await fetchEmailLogs({
            page,
            pageSize,
            recipientRole,
            status,
            emailType,
            dateFrom,
            dateTo,
            search,
        });

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error("GET /api/email-logs error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch email logs" },
            { status: 500 }
        );
    }
}
