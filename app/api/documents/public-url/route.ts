// /api/documents/public-url/route.ts
import { NextResponse } from "next/server";
import { getClientRootFolder } from "@/lib/storage-utils";
import { containerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        const clientId = searchParams.get("clientId");
        const fullPathRaw = searchParams.get("fullPath");

        if (!clientId || !fullPathRaw) {
            return NextResponse.json(
                { success: false, error: "Missing clientId or fullPath" },
                { status: 400 }
            );
        }

        // Normalize: decode and remove leading slashes
        const fullPath = decodeURIComponent(fullPathRaw).replace(/^\/+/, "");

        // Determine the blob name (path in storage)
        let blobName = fullPath;
        const rootFolder = await getClientRootFolder(clientId);

        const hasAnyPrefix =
            blobName.startsWith(`${rootFolder}/`) ||
            blobName.startsWith(`${clientId}/`) ||
            blobName.startsWith(`client-${clientId}/`);

        if (!hasAnyPrefix) {
            blobName = `${rootFolder}/${blobName}`;
        }

        console.log(`[PUBLIC-URL] clientId=${clientId}, blobName="${blobName}"`);

        // Use the shim to get the public URL
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const url = blockBlobClient.url;

        return NextResponse.json({ success: true, url });
    } catch (e: any) {
        console.error("Public URL Generation Error:", e);
        return NextResponse.json(
            { success: false, error: e?.message || "Failed to generate public URL" },
            { status: 500 }
        );
    }
}

