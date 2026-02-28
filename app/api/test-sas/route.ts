import { NextResponse } from "next/server";
import { BlobServiceClient, BlobSASPermissions, SASProtocol, generateBlobSASQueryParameters } from "@azure/storage-blob";
import { StorageSharedKeyCredential } from "@azure/storage-blob";

export async function GET() {
  try {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

    const blobUrl =
      "https://clienthubstorage.blob.core.windows.net/clienthub/client-14/PDF/AI_WebApp_Costing_Strategy_Report.pdf";

    const urlParts = blobUrl.split("/");
    const blobName = urlParts.slice(4).join("/"); // clienthub/.../file.pdf

    const sas = generateBlobSASQueryParameters(
      {
        containerName: "clienthub",
        blobName: blobName,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(Date.now() + 60 * 60 * 1000),
        protocol: SASProtocol.Https,
      },
      sharedKeyCredential
    ).toString();

    return NextResponse.json({
      test: "ok",
      sasUrl: `${blobUrl}?${sas}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
