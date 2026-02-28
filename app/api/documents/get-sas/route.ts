// app/api/documents/get-sas/route.ts
import { NextResponse } from "next/server";
import { containerClient } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path"); // client-14/PDF/file.pdf

    if (!path) {
      return NextResponse.json(
        { error: "Missing file path" },
        { status: 400 }
      );
    }

    const blockBlobClient = containerClient.getBlockBlobClient(path);
    const sasUrl = blockBlobClient.url;

    return NextResponse.json({ sasUrl });

  } catch (err: any) {
    console.error("GET SAS error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
