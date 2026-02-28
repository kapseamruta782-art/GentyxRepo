import { NextResponse } from "next/server";
import { containerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const blobName = "clienthub/client-14/PDF/AI_WebApp_Costing_Strategy_Report.pdf";
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const sasUrl = blockBlobClient.url;

    return NextResponse.json({
      test: "ok",
      sasUrl: sasUrl,
    });
  } catch (error: any) {
    console.error("TEST SAS error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
