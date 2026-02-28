// app/api/setup/migrate-messages/route.ts
import { NextResponse } from "next/server";

/**
 * MSSQL Schema Migration Tool (Legacy)
 * In Supabase, schema changes should be handled via the Supabase Dashboard 
 * or SQL editor.
 */
export async function GET() {
    return NextResponse.json({
        success: true,
        message: "Supabase migration handled via schema definition. No manual ALTER TABLE required in this environment."
    });
}
