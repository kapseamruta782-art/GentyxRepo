import { NextResponse } from "next/server";
import {
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const folder = searchParams.get("folder");
    const fileName = searchParams.get("fileName");

    if (!clientId || !folder || !fileName) {
      return NextResponse.json({ url: null });
    }

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const container = process.env.AZURE_STORAGE_CONTAINER_NAME!;

    const sharedKey = new StorageSharedKeyCredential(accountName, accountKey);

    const sas = generateBlobSASQueryParameters(
      {
        containerName: container,
        blobName: `clienthub/client-${clientId}/${folder}/${fileName}`,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      },
      sharedKey
    ).toString();

    const url = `https://${accountName}.blob.core.windows.net/${container}/clienthub/client-${clientId}/${folder}/${fileName}?${sas}`;

    return NextResponse.json({ url });

  } catch (err: any) {
    return NextResponse.json({ url: null, error: err.message });
  }
}
