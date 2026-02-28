// // /api/documents/public-url/route.ts
// import { NextResponse } from "next/server";
// import {
//     StorageSharedKeyCredential,
//     generateBlobSASQueryParameters,
//     BlobSASPermissions,
//     SASProtocol,
// } from "@azure/storage-blob";

// export const dynamic = "force-dynamic";

// export async function GET(req: Request) {
//     try {
//         const { searchParams } = new URL(req.url);

//         const clientId = searchParams.get("clientId");
//         const fullPathRaw = searchParams.get("fullPath");

//         if (!clientId || !fullPathRaw) {
//             return NextResponse.json(
//                 { success: false, error: "Missing clientId or fullPath" },
//                 { status: 400 }
//             );
//         }

//         const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
//         const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
//         const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

//         if (!accountName || !accountKey || !containerName) {
//             return NextResponse.json(
//                 { success: false, error: "Missing Azure storage environment variables" },
//                 { status: 500 }
//             );
//         }

//         // ✅ Normalize: remove leading slashes
//         const fullPath = decodeURIComponent(fullPathRaw).replace(/^\/+/, "");

//         /**
//          * ✅ IMPORTANT:
//          * - Your list API / UI already gives fullPath like: "client-2/folder/file.docx"
//          * - So DO NOT auto-prefix with `${clientId}/`
//          * - Only prefix if caller sends just a filename or folder relative path.
//          */
//         let blobName = fullPath;

//         const hasAnyPrefix =
//             blobName.startsWith(`${clientId}/`) ||
//             blobName.startsWith(`client-${clientId}/`);

//         if (!hasAnyPrefix) {
//             // ✅ Use the prefix style your system uses: client-<id>/
//             blobName = `client-${clientId}/${blobName}`;
//         }

//         // Detect content type (helps inline preview)
//         const ext = blobName.split(".").pop()?.toLowerCase();
//         const contentTypeMap: Record<string, string> = {
//             pdf: "application/pdf",
//             png: "image/png",
//             jpg: "image/jpeg",
//             jpeg: "image/jpeg",
//             webp: "image/webp",
//             doc: "application/msword",
//             docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//             xls: "application/vnd.ms-excel",
//             xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//             ppt: "application/vnd.ms-powerpoint",
//             pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
//             csv: "text/csv",
//         };

//         const contentType = (ext && contentTypeMap[ext]) || "application/octet-stream";

//         const credential = new StorageSharedKeyCredential(accountName, accountKey);

//         // ✅ Give a little skew for clock drift
//         const startsOn = new Date(Date.now() - 5 * 60 * 1000);
//         const expiresOn = new Date(Date.now() + 30 * 60 * 1000);

//         const sas = generateBlobSASQueryParameters(
//             {
//                 containerName,
//                 blobName,
//                 permissions: BlobSASPermissions.parse("r"),
//                 startsOn,
//                 expiresOn,
//                 protocol: SASProtocol.Https,
//                 contentDisposition: "inline",
//                 contentType,
//             },
//             credential
//         ).toString();

//         // Keep slashes readable in URL path
//         const encodedBlobPath = encodeURIComponent(blobName).replace(/%2F/g, "/");

//         const url = `https://${accountName}.blob.core.windows.net/${containerName}/${encodedBlobPath}?${sas}`;

//         return NextResponse.json({ success: true, url });
//     } catch (e: any) {
//         return NextResponse.json(
//             { success: false, error: e?.message || "Failed to generate SAS URL" },
//             { status: 500 }
//         );
//     }
// }

// /api/documents/public-url/route.ts
import { NextResponse } from "next/server";
import {
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
    SASProtocol,
} from "@azure/storage-blob";
import { getClientRootFolder } from "@/lib/storage-utils";

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

        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
        const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

        if (!accountName || !accountKey || !containerName) {
            return NextResponse.json(
                { success: false, error: "Missing Azure storage environment variables" },
                { status: 500 }
            );
        }

        // ✅ Normalize: decode and remove leading slashes
        const fullPath = decodeURIComponent(fullPathRaw).replace(/^\/+/, "");

        /**
         * ✅ IMPORTANT:
         * - The list API returns fullPath like: "ClientName-123/folder/file.docx"
         * - So DO NOT auto-prefix if it already has one.
         * - Only prefix if caller sends just a filename or relative path.
         */
        let blobName = fullPath;

        // ✅ Use getClientRootFolder to get the correct root folder name (e.g., "SumitMetal-158")
        const rootFolder = await getClientRootFolder(clientId);

        const hasAnyPrefix =
            blobName.startsWith(`${rootFolder}/`) ||
            blobName.startsWith(`${clientId}/`) ||
            blobName.startsWith(`client-${clientId}/`);

        if (!hasAnyPrefix) {
            // ✅ Use the dynamically resolved root folder name
            blobName = `${rootFolder}/${blobName}`;
        }

        console.log(`[PUBLIC-URL] clientId=${clientId}, rootFolder="${rootFolder}", fullPath="${fullPath}", blobName="${blobName}"`);

        // ✅ Detect content type (helps inline preview + fixes CSV)
        const ext = blobName.split(".").pop()?.toLowerCase();
        const contentTypeMap: Record<string, string> = {
            pdf: "application/pdf",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            webp: "image/webp",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ppt: "application/vnd.ms-powerpoint",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

            // ✅ CSV fix
            csv: "text/csv",
            // (optional but fine)
            txt: "text/plain",
            json: "application/json",
        };

        const contentType =
            (ext && contentTypeMap[ext]) || "application/octet-stream";

        // ✅ Provide a clean filename (helps Office viewer + browsers)
        const fileName = blobName.split("/").pop() || "file";
        const contentDisposition = `inline; filename="${fileName}"`;

        const credential = new StorageSharedKeyCredential(accountName, accountKey);

        // ✅ Give a little skew for clock drift
        const startsOn = new Date(Date.now() - 5 * 60 * 1000);
        const expiresOn = new Date(Date.now() + 30 * 60 * 1000);

        const sas = generateBlobSASQueryParameters(
            {
                containerName,
                blobName,
                permissions: BlobSASPermissions.parse("r"),
                startsOn,
                expiresOn,
                protocol: SASProtocol.Https,
                contentDisposition, // ✅ important
                contentType,        // ✅ important (CSV fix)
            },
            credential
        ).toString();

        // Keep slashes readable in URL path
        const encodedBlobPath = encodeURIComponent(blobName).replace(/%2F/g, "/");

        const url = `https://${accountName}.blob.core.windows.net/${containerName}/${encodedBlobPath}?${sas}`;

        return NextResponse.json({ success: true, url });
    } catch (e: any) {
        return NextResponse.json(
            { success: false, error: e?.message || "Failed to generate SAS URL" },
            { status: 500 }
        );
    }
}

