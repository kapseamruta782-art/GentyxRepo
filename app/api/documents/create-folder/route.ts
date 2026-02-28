// app/api/documents/create-folder/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { logAudit, AuditActions } from "@/lib/audit";
import { queueFolderCreatedNotification } from "@/lib/notification-batcher";
import { supabase } from "@/lib/db";
import { getClientRootFolder } from "@/lib/storage-utils";

export async function POST(req: Request) {
  try {
    const { clientId, folderName, parentFolder, role = "ADMIN" } = await req.json();

    if (!clientId || !folderName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME!
    );
    await containerClient.createIfNotExists();

    const rootFolder = await getClientRootFolder(clientId);

    // Support sub-folders
    const finalFolderPath = parentFolder
      ? `${rootFolder}/${parentFolder}/${folderName}/`
      : `${rootFolder}/${folderName}/`;

    // Case-insensitive duplicate protection
    const parentPath = parentFolder
      ? `${rootFolder}/${parentFolder}/`
      : `${rootFolder}/`;

    const existingFolders = containerClient.listBlobsByHierarchy("/", {
      prefix: parentPath,
    });

    const normalizedNewName = folderName.toLowerCase().trim();

    for await (const item of existingFolders) {
      if (item.kind === "prefix") {
        const existingName = item.name
          .replace(parentPath, "")
          .replace(/\/$/, "");

        if (existingName.toLowerCase() === normalizedNewName) {
          return NextResponse.json(
            { success: false, error: `A folder named "${existingName}" already exists (case-insensitive match)` },
            { status: 409 }
          );
        }
      }
    }

    // Real folder creation (.keep file)
    const blockBlobClient = containerClient.getBlockBlobClient(
      `${finalFolderPath}.keep`
    );

    await blockBlobClient.upload("", 0);

    // Audit log
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.FOLDER_CREATED,
      actorRole: role,
      details: folderName,
    });

    // Notification
    const isAdminOnlySection =
      parentFolder === "Admin Only" ||
      parentFolder === "Admin Restricted" ||
      (parentFolder && (parentFolder.startsWith("Admin Only/") || parentFolder.startsWith("Admin Restricted/"))) ||
      folderName === "Admin Only" ||
      folderName === "Admin Restricted";

    if (!isAdminOnlySection) {
      (async () => {
        try {
          const { data: client, error: clientError } = await supabase
            .from("Clients")
            .select("client_name")
            .eq("client_id", Number(clientId))
            .maybeSingle();

          if (clientError) throw clientError;
          const clientName = client?.client_name || `Client ${clientId}`;

          queueFolderCreatedNotification({
            clientId: Number(clientId),
            clientName: clientName,
            creatorName: role === 'ADMIN' ? 'Admin' : clientName,
            creatorRole: role as any,
            folderName: folderName,
            parentPath: parentFolder || undefined,
          });
        } catch (emailErr) {
          console.error("Failed to queue admin notification:", emailErr);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message: "Folder created successfully",
      path: finalFolderPath,
    });
  } catch (err: any) {
    console.error("CREATE FOLDER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create folder" },
      { status: 500 }
    );
  }
}
