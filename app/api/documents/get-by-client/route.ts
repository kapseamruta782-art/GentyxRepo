import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "documents";

// These are the admin-managed section folders — clients should never see them directly
const SECTION_FOLDERS = [
  "Admin Only", "Client Only", "Shared",
  "Admin Restricted", "Client Uploaded", "Legacy Uploaded"
];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("id");
    const folder = url.searchParams.get("folder");
    const rawRole = url.searchParams.get("role");
    const role = (rawRole || "ADMIN").toUpperCase();

    console.log(`[DOCS] Fetching for Client: ${clientId}, Role: ${role}`);

    if (!clientId) {
      return NextResponse.json({ success: false, error: "Missing clientId" });
    }

    const rootFolder = await getClientRootFolder(clientId);

    if (role === "CLIENT") {
      return await handleClientView(rootFolder, folder);
    }

    const prefix = folder ? `${rootFolder}/${folder}` : rootFolder;

    const items: any[] = [];

    // Supabase list returns all items in the folder (no hierarchy like Azure's listBlobsByHierarchy unless we recurse)
    // But original code used "/" delimiter which means 1 level.
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(prefix);

    if (error) throw error;

    for (const item of data || []) {
      if (item.name === ".keep") continue;

      const isFolder = !item.id;
      const fullPath = `${prefix}/${item.name}`;

      if (isFolder) {
        items.push({
          type: "folder",
          name: item.name,
        });
      } else {
        // For files, generate a signed URL (matching SAS behavior)
        const { data: signedData, error: signedError } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(fullPath, 3600); // 1 hour

        if (signedError) {
          console.error("Signed URL Error:", signedError);
          continue;
        }

        // Supabase doesn't have custom metadata in the same way. 
        // We'll treat all as shared/unknown for now unless we have a metadata table.
        items.push({
          type: "file",
          name: item.name,
          url: signedData.signedUrl,
          size: item.metadata?.size || 0,
          fullPath: fullPath,
          visibility: "shared",
          uploadedBy: "unknown",
        });
      }
    }

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    console.error("LIST ERROR:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}

async function handleClientView(rootFolder: string, folder: string | null) {
  const items: any[] = [];
  const clientVisibleSections = [
    "Legacy Uploaded", "Client Uploaded",
    "Shared", "Client Only"
  ];

  if (!folder) {
    for (const section of clientVisibleSections) {
      const sectionPrefix = `${rootFolder}/${section}`;
      const { data, error } = await supabase.storage.from(BUCKET_NAME).list(sectionPrefix);

      if (error) {
        console.error(`Error listing section ${section}:`, error);
        continue;
      }

      for (const item of data || []) {
        if (item.name === ".keep") continue;
        const isFolder = !item.id;
        const fullPath = `${sectionPrefix}/${item.name}`;

        if (isFolder) {
          const exists = items.find((i) => i.type === "folder" && i.name === item.name);
          if (!exists) {
            items.push({ type: "folder", name: item.name, _section: section });
          }
        } else {
          const { data: signedData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fullPath, 3600);

          if (signedData) {
            items.push({
              type: "file",
              name: item.name,
              url: signedData.signedUrl,
              size: item.metadata?.size || 0,
              fullPath: fullPath,
              visibility: "shared",
              uploadedBy: "unknown",
              _section: section,
            });
          }
        }
      }
    }

    // Legacy items at root
    const { data: rootItems } = await supabase.storage.from(BUCKET_NAME).list(rootFolder);
    for (const item of rootItems || []) {
      if (item.name === ".keep" || SECTION_FOLDERS.includes(item.name)) continue;
      const isFolder = !item.id;
      const fullPath = `${rootFolder}/${item.name}`;

      if (isFolder) {
        const exists = items.find((i) => i.type === "folder" && i.name === item.name);
        if (!exists) items.push({ type: "folder", name: item.name, _section: "legacy" });
      } else {
        const exists = items.find((i) => i.type === "file" && i.name === item.name);
        if (exists) continue;

        const { data: signedData } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(fullPath, 3600);
        if (signedData) {
          items.push({
            type: "file",
            name: item.name,
            url: signedData.signedUrl,
            size: item.metadata?.size || 0,
            fullPath: fullPath,
            visibility: "shared",
            uploadedBy: "unknown",
            _section: "legacy",
          });
        }
      }
    }
  } else {
    // Subfolder view
    const searchPrefixes = [
      `${rootFolder}/Client Uploaded/${folder}`,
      `${rootFolder}/Legacy Uploaded/${folder}`,
      `${rootFolder}/Client Only/${folder}`,
      `${rootFolder}/Shared/${folder}`,
      `${rootFolder}/${folder}`,
    ];

    for (const tryPrefix of searchPrefixes) {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).list(tryPrefix);
      if (error || !data || data.length === 0) continue;

      for (const item of data) {
        if (item.name === ".keep") continue;
        const isFolder = !item.id;
        const fullPath = `${tryPrefix}/${item.name}`;

        if (isFolder) {
          const exists = items.find((i) => i.type === "folder" && i.name === item.name);
          if (!exists) items.push({ type: "folder", name: item.name });
        } else {
          const exists = items.find((i) => i.type === "file" && i.name === item.name);
          if (exists) continue;

          const { data: signedData } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(fullPath, 3600);
          if (signedData) {
            items.push({
              type: "file",
              name: item.name,
              url: signedData.signedUrl,
              size: item.metadata?.size || 0,
              fullPath: fullPath,
              visibility: "shared",
              uploadedBy: "unknown",
            });
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, data: items });
}
