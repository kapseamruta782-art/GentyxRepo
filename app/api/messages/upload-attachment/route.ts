// /app/api/messages/upload-attachment/route.ts
import { NextResponse } from "next/server";
import {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
} from "@azure/storage-blob";

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

        const account = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
        const key = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

        // Create clients with shared key credential for SAS generation
        const sharedKeyCredential = new StorageSharedKeyCredential(account, key);
        const blobServiceClient = new BlobServiceClient(
            `https://${account}.blob.core.windows.net`,
            sharedKeyCredential
        );
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists();

        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

        // Upload file
        await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: file.type },
        });

        // Generate SAS URL for the file (valid for 1 year)
        const expiresOn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const sas = generateBlobSASQueryParameters(
            {
                containerName,
                blobName: blobPath,
                permissions: BlobSASPermissions.parse("r"),
                expiresOn,
            },
            sharedKeyCredential
        ).toString();

        const sasUrl = `${blockBlobClient.url}?${sas}`;

        return NextResponse.json({
            success: true,
            attachmentUrl: sasUrl,
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
