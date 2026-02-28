
import { NextResponse } from "next/server";
import { containerClient } from "@/lib/supabase";
import { logAudit, AuditActions, AuditActorRole } from "@/lib/audit";
import { queueDocumentUploadNotification } from "@/lib/notification-batcher";
import { supabase } from "@/lib/db";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

type DuplicateAction = "ask" | "replace" | "skip";

function cleanSegment(input: string) {
  // Prevent weird paths like "../" and remove leading/trailing slashes
  return input
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "." && s !== "..")
    .join("/");
}

function splitName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) return { base: fileName, ext: "" };
  return {
    base: fileName.slice(0, lastDot),
    ext: fileName.slice(lastDot), // includes "."
  };
}

async function getNextAvailablePath(
  containerClient: any,
  initialPath: string
) {
  const { base, ext } = splitName(initialPath.split("/").pop() || initialPath);

  const folder = initialPath.includes("/")
    ? initialPath.slice(0, initialPath.lastIndexOf("/"))
    : "";

  // If "file.xlsx" exists, try: "file (1).xlsx", "file (2).xlsx", ...
  for (let i = 1; i <= 999; i++) {
    const candidateName = `${base} (${i})${ext}`;
    const candidatePath = folder ? `${folder}/${candidateName}` : candidateName;

    const candidateBlob = containerClient.getBlockBlobClient(candidatePath);
    const exists = await candidateBlob.exists();
    if (!exists) return candidatePath;
  }

  throw new Error("Too many duplicates. Please rename the file and try again.");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const clientId = (formData.get("clientId") as string)?.trim();
    const rawFolderName = (formData.get("folderName") as string | null) || null;
    const file = formData.get("file") as File | null;

    // "ask" | "replace" | "skip"
    const duplicateActionRaw = (formData.get("duplicateAction") as string | null)?.trim() || "ask";
    const duplicateAction = (["ask", "replace", "skip"].includes(duplicateActionRaw)
      ? duplicateActionRaw
      : "ask") as DuplicateAction;

    const role = ((formData.get("role") as string)?.trim() || "ADMIN") as AuditActorRole;

    // "shared" | "private" - determines if admin can see this document
    // FORCE "shared" for non-admins (Clients can't hide docs from Admin)
    let visibility = ((formData.get("visibility") as string)?.trim() || "shared") as "shared" | "private";
    if (role !== "ADMIN") {
      visibility = "shared";
    }

    if (!clientId || !file) {
      return NextResponse.json(
        { success: false, error: "Client and file are required" },
        { status: 400 }
      );
    }

    // never allow manual .keep upload
    if (file.name === ".keep") {
      return NextResponse.json(
        { success: false, error: "Invalid file name" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;

    const safeFolder = rawFolderName ? cleanSegment(rawFolderName) : null;

    // Build blob path
    const rootFolder = await getClientRootFolder(clientId);

    const initialPath = safeFolder
      ? `${rootFolder}/${safeFolder}/${fileName}`
      : `${rootFolder}/${fileName}`;

    // We use the imported containerClient shim from @/lib/azure

    // Check if exact path already exists
    const initialBlob = containerClient.getBlockBlobClient(initialPath);
    const exists = await initialBlob.exists();

    // If duplicate & ask → tell frontend to show Replace/Skip dialog
    if (exists && duplicateAction === "ask") {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          message: "File already exists. Choose Replace or Skip.",
          existingPath: initialPath,
          fileName,
        },
        { status: 409 }
      );
    }

    let finalPath = initialPath;
    let finalBlob = initialBlob;

    // ✅ If duplicate & skip → DO NOT UPLOAD (Cancel behavior)
    if (exists && duplicateAction === "skip") {
      logAudit({
        clientId: Number(clientId),
        action: AuditActions.DOCUMENT_UPLOADED, // ✅ if you don't have this enum, see note below
        actorRole: role,
        details: `Skipped (duplicate): ${fileName}`,
      });

      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Upload skipped (duplicate)",
        path: initialPath,
        fileName,
      });
    }

    // If replace OR not exists → upload to same path (overwrite happens by default)
    // NOTE: NO "overwrite: true" — Azure overwrites when uploading same blob name.
    await finalBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type },
      metadata: {
        visibility: visibility, // "shared" or "private"
        uploadedBy: role,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Audit log (use existing enum)
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.DOCUMENT_UPLOADED,
      actorRole: role,
      details: exists
        ? duplicateAction === "replace"
          ? `Replaced: ${fileName}`
          : `Saved as: ${finalPath.split("/").pop() || fileName}`
        : fileName,
    });

    // Queue email notification to admin (batched - will wait 30s for more uploads)
    // ✅ SKIP notification for:
    //   - Private docs (visibility === "private")
    //   - Anything in the "Admin Only" section folder — client shouldn't know
    const isAdminOnlyFolder =
      safeFolder === "Admin Only" || safeFolder === "Admin Restricted" ||
      (safeFolder && (safeFolder.startsWith("Admin Only/") || safeFolder.startsWith("Admin Restricted/")));

    if (visibility !== "private" && !isAdminOnlyFolder) {
      (async () => {
        try {
          // Get client name
          const { data: client, error: clientError } = await supabase
            .from("Clients")
            .select("client_name")
            .eq("client_id", Number(clientId))
            .maybeSingle();

          if (clientError) throw clientError;

          const clientName = client?.client_name || `Client ${clientId}`;

          // Queue the notification (will batch multiple uploads together)
          queueDocumentUploadNotification({
            clientId: Number(clientId),
            clientName: clientName,
            uploaderName: role === 'ADMIN' ? 'Admin' : clientName,
            uploaderRole: role as any,
            documentName: fileName,
            folderPath: safeFolder || undefined,
          });
        } catch (emailErr) {
          console.error("Failed to queue admin notification:", emailErr);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message:
        exists && duplicateAction === "skip"
          ? "File uploaded (renamed to avoid duplicate)"
          : exists && duplicateAction === "replace"
            ? "File replaced successfully"
            : "File uploaded successfully",
      path: finalPath,
      url: finalBlob.url,
      finalFileName: finalPath.split("/").pop() || fileName,
      replaced: exists && duplicateAction === "replace",
      renamed: exists && duplicateAction === "skip",
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
