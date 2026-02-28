import { NextResponse } from "next/server";
import { calculateClientProgress } from "@/lib/progress";

export async function POST(req: Request) {
  try {
    const { clientId } = await req.json();

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId required" },
        { status: 400 }
      );
    }

    const result = await calculateClientProgress(clientId);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("Progress Recalculation Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to recompute progress" },
      { status: 500 }
    );
  }
}
