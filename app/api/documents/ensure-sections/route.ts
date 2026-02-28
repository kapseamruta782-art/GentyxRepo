import { NextResponse } from "next/server";
import { containerClient } from "@/lib/azure";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

// The 3 physical section folders that live under each client root
export const SECTION_FOLDERS = ["Admin Restricted", "Legacy Uploaded", "Client Uploaded"] as const;

export async function POST(req: Request) {
    try {
        const { clientId } = await req.json();

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "clientId is required" },
                { status: 400 }
            );
        }

        const rootFolder = await getClientRootFolder(Number(clientId));
        const created: string[] = [];

        for (const section of SECTION_FOLDERS) {
            const keepPath = `${rootFolder}/${section}/.keep`;
            const blob = containerClient.getBlockBlobClient(keepPath);
            const exists = await blob.exists();

            if (!exists) {
                await blob.upload("", 0, {
                    blobHTTPHeaders: { blobContentType: "application/octet-stream" },
                });
                created.push(section);
            }
        }

        console.log(
            `[ENSURE-SECTIONS] Client ${clientId}: Root="${rootFolder}", Created=[${created.join(", ")}]`
        );

        return NextResponse.json({
            success: true,
            rootFolder,
            sections: SECTION_FOLDERS,
            created,
        });
    } catch (error: any) {
        console.error("ENSURE SECTIONS ERROR:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
