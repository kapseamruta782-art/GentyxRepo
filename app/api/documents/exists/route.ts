// // app/api/documents/exists/route.ts
// import { NextResponse } from "next/server";

// // ✅ Import the SAME blob helpers you already use in /api/documents/*
// // Example (change to your actual helper):
// // import { containerClient } from "@/lib/blob";

// export async function GET(req: Request) {
//     try {
//         const { searchParams } = new URL(req.url);
//         const clientId = searchParams.get("clientId");
//         const fullPath = searchParams.get("fullPath");

//         if (!clientId || !fullPath) {
//             return NextResponse.json(
//                 { success: false, error: "clientId and fullPath are required" },
//                 { status: 400 }
//             );
//         }

//         // ⚠️ IMPORTANT:
//         // Your backend often expects something like: `client-111/<folder>/<file>`
//         // If your system stores files under `client-${clientId}/`, enforce it here.
//         const normalizedPath =
//             fullPath.startsWith(`client-${clientId}/`)
//                 ? fullPath
//                 : `client-${clientId}/${fullPath}`;

//         // ✅ Replace this with your real blob call:
//         // const blobClient = containerClient.getBlobClient(normalizedPath);
//         // const exists = await blobClient.exists();

//         const exists = false; // <-- REMOVE after wiring real blob client

//         return NextResponse.json({ success: true, exists });
//     } catch (err: any) {
//         return NextResponse.json(
//             { success: false, error: err?.message || "Exists check failed" },
//             { status: 500 }
//         );
//     }
// }
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        const clientId = searchParams.get("clientId");
        const fullPath = searchParams.get("fullPath"); // e.g. "ClientHub_UAT_Test.xlsx" or "folder/file.xlsx"

        if (!clientId || !fullPath) {
            return NextResponse.json(
                { success: false, error: "clientId and fullPath are required" },
                { status: 400 }
            );
        }

        // Your storage uses: client-<id>/<path>
        const normalized = fullPath.replace(/^\/+/, "");
        const blobPath = normalized.startsWith(`client-${clientId}/`)
            ? normalized
            : `client-${clientId}/${normalized}`;

        const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

        const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        const blobClient = containerClient.getBlockBlobClient(blobPath);
        const exists = await blobClient.exists();

        return NextResponse.json({ success: true, exists, blobPath });
    } catch (err: any) {
        console.error("EXISTS ERROR:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
