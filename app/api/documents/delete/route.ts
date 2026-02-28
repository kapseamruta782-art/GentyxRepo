// app/api/documents/delete/route.ts
import { NextResponse } from "next/server";
import { logAudit, AuditActions } from "@/lib/audit";
import { containerClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { clientId, fullPath } = await req.json();

    if (!clientId || !fullPath) {
      return NextResponse.json(
        { success: false, error: "Missing clientId or fullPath" },
        { status: 400 }
      );
    }

    const blockBlobClient = containerClient.getBlockBlobClient(fullPath);

    // Attempt delete
    const exists = await blockBlobClient.exists();
    if (!exists) {
      return NextResponse.json(
        { success: false, error: "Blob not found or already deleted" },
        { status: 404 }
      );
    }

    await blockBlobClient.deleteIfExists();

    // Audit log
    const fileName = fullPath.split('/').pop() || fullPath;
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.DOCUMENT_DELETED,
      actorRole: "ADMIN",
      details: fileName,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete File Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
