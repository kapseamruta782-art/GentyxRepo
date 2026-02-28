// /app/api/messages/upload-attachment/route.ts
import { NextResponse } from "next/server";
import { containerClient } from "@/lib/azure";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        const clientId = formData.get("clientId") as string;
        const file = formData.get("file") as File;

        if (!clientId || !file) {
            return NextResponse.json(
                { success: false, error: "Client ID and file are required" },
                { status: 400 }
            );
        }

        // Safety checks
        if (file.name === ".keep") {
            return NextResponse.json(
                { success: false, error: "Invalid file name" },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}-${file.name}`; // Unique filename
        const blobPath = `client-${clientId}/messages/${fileName}`;

        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

        // Upload file via shim (uses Supabase)
        await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: file.type },
        });

        // The shim's URL is the Supabase public URL
        const publicUrl = blockBlobClient.url;

        return NextResponse.json({
            success: true,
            attachmentUrl: publicUrl,
            attachmentName: file.name,
        });
    } catch (err: any) {
        console.error("MESSAGE ATTACHMENT UPLOAD ERROR:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
