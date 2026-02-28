// // app/api/documents/delete/route.ts
// import { NextResponse } from "next/server";
// import { deleteBlob } from "@/lib/azure";

// export async function POST(req: Request) {
//   try {
//     const { clientId, fileName, fileType } = await req.json();

//     if (!clientId || !fileName || !fileType) {
//       return NextResponse.json({ error: "Missing fields" }, { status: 400 });
//     }

//     // Correct blob path based on your Azure folder structure
//     const blobPath = `client-${clientId}/${fileType}/${fileName}`;

//     // Delete from Azure Blob Storage
//     await deleteBlob(blobPath);

//     return NextResponse.json({ success: true });
//   } catch (err) {
//     console.error("Delete Error:", err);
//     return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
//   }
// }

// app/api/documents/delete/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const { clientId, fullPath } = await req.json();

    if (!clientId || !fullPath) {
      return NextResponse.json(
        { success: false, error: "Missing clientId or fullPath" },
        { status: 400 }
      );
    }

    // 🔥 fullPath includes the complete path inside container:
    // Example:
    // client-2/image.png
    // client-2/IMG/pic1.jpg
    // client-2/test/folder/file.pdf

    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = "clienthub";

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr!);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const blobClient = containerClient.getBlobClient(fullPath);

    // Attempt delete
    const deleteResponse = await blobClient.deleteIfExists();

    if (!deleteResponse.succeeded) {
      return NextResponse.json(
        { success: false, error: "Blob not found or already deleted" },
        { status: 404 }
      );
    }

    // Audit log
    const fileName = fullPath.split('/').pop() || fullPath;
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.DOCUMENT_DELETED,
      actorRole: "ADMIN",
      details: fileName,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete File Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
