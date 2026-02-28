// app/api/documents/get/route.ts
import { NextResponse } from "next/server";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const mode = searchParams.get("mode");        // "folders"
    const folder = searchParams.get("folder");    // e.g. "IMG"

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const key = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

    const sharedKeyCredential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const containerClient =
      blobServiceClient.getContainerClient(containerName);

    const prefix = `client-${clientId}/`;

    // ---------------------------------------------------------
    // MODE 1 → Return only folders
    // ---------------------------------------------------------
    if (mode === "folders") {
      const folderSet = new Set<string>();

      for await (const blob of containerClient.listBlobsByHierarchy("/", {
        prefix,
      })) {
        if (blob.kind === "prefix") {
          const name = blob.name.replace(prefix, "").replace("/", "");

          if (name !== ".keep" && name.length > 0) {
            folderSet.add(name);
          }
        }
      }

      return NextResponse.json({
        success: true,
        folders: Array.from(folderSet),
      });
    }

    // ---------------------------------------------------------
    // MODE 2 → Return files inside a specific folder
    // ---------------------------------------------------------
    if (folder) {
      const filePrefix = `${prefix}${folder}/`;

      const files: any[] = [];

      for await (const blob of containerClient.listBlobsFlat({
        prefix: filePrefix,
      })) {
        const fileName = blob.name.replace(filePrefix, "");

        if (fileName === ".keep" || fileName.endsWith("/")) continue;

        files.push({
          name: fileName,
          url: `${containerClient.url}/${blob.name}`,
          size: blob.properties.contentLength,
          type: blob.name.split(".").pop(),
          path: blob.name,
        });
      }

      return NextResponse.json({
        success: true,
        files,
      });
    }

    // Invalid usage
    return NextResponse.json(
      {
        success: false,
        error: "Missing mode=folders or folder parameter.",
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
