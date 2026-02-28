import { NextResponse } from "next/server";
import { containerClient } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const folder = searchParams.get("folder");
    const fileName = searchParams.get("fileName");

    if (!clientId || !folder || !fileName) {
      return NextResponse.json({ url: null });
    }

    const blobName = `clienthub/client-${clientId}/${folder}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const url = blockBlobClient.url;

    return NextResponse.json({ url });

  } catch (err: any) {
    console.error("GET URL error:", err);
    return NextResponse.json({ url: null, error: err.message });
  }
}
