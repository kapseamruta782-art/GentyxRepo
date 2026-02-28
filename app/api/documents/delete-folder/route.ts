
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { getClientRootFolder } from "@/lib/storage-utils";

export async function POST(req: Request) {
  try {
    const { clientId, folderPath } = await req.json();

    if (!clientId || !folderPath) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME!
    );

    const rootFolder = await getClientRootFolder(clientId);

    // full path like: client-2/folderName
    const prefix = `${rootFolder}/${folderPath}`;
    const blobs = containerClient.listBlobsFlat({ prefix });

    for await (const blob of blobs) {
      await containerClient.deleteBlob(blob.name);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE FOLDER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
