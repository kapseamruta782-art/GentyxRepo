// app/api/documents/get/route.ts
import { NextResponse } from "next/server";
import { getClientRootFolder } from "@/lib/storage-utils";
import { containerClient } from "@/lib/supabase";

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

    const rootFolder = await getClientRootFolder(clientId);
    const prefix = `${rootFolder}/`;

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
        const fileName = (blob as any).name.replace(filePrefix, "");

        if (fileName === ".keep" || fileName.endsWith("/")) continue;

        files.push({
          name: fileName,
          url: `${(containerClient as any).getBlockBlobClient(blob.name).url}`,
          size: (blob as any).properties.contentLength,
          type: (blob as any).name.split(".").pop(),
          path: (blob as any).name,
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
    console.error("GET DOCUMENTS ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
