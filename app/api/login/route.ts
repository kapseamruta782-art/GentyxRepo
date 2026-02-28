// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    console.log("🔍 LOGIN API - Attempting login for email:", email);
    const { data: user, error: userError } = await supabase
      .from("Users")
      .select("id, email, password, role")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      console.error("🔍 LOGIN API - Supabase Error:", userError);
      throw userError;
    }

    console.log("🔍 LOGIN API - User found:", user ? "YES" : "NO");
    if (user) {
      console.log("🔍 LOGIN API - DB Password matches input:", user.password === password);
      // CAUTION: Only logging for debugging during migration. Remove later.
      // console.log("🔍 DB PWD:", user.password, "INPUT PWD:", password);
    }

    if (!user || user.password !== password) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    // --- CREATE COOKIES ---
    let clientId: number | null = null;
    let serviceCenterId: number | null = null;
    let cpaId: number | null = null;

    // Handle CLIENT role
    if (user.role === "CLIENT") {
      console.log("🔍 LOGIN API - Looking up client for email:", user.email);

      const { data: client, error: clientError } = await supabase
        .from("Clients")
        .select("client_id")
        .eq("primary_contact_email", user.email)
        .maybeSingle();

      if (clientError) throw clientError;

      if (client) {
        clientId = client.client_id;
        console.log("🔍 LOGIN API - Found clientId:", clientId);
      }

      if (!clientId) {
        console.log("🔍 LOGIN API - No client found for email:", user.email);
        return NextResponse.json(
          { success: false, message: "Client record not linked to this user." },
          { status: 403 }
        );
      }
    }

    // Handle SERVICE_CENTER role
    if (user.role === "SERVICE_CENTER") {
      console.log("🔍 LOGIN API - Looking up service center for email:", user.email);

      const { data: sc, error: scError } = await supabase
        .from("service_centers")
        .select("service_center_id")
        .eq("email", user.email)
        .maybeSingle();

      if (scError) throw scError;

      if (sc) {
        serviceCenterId = sc.service_center_id;
        console.log("🔍 LOGIN API - Found serviceCenterId:", serviceCenterId);
      }

      if (!serviceCenterId) {
        console.log("🔍 LOGIN API - No service center found for email:", user.email);
        return NextResponse.json(
          { success: false, message: "Service Center record not linked to this user." },
          { status: 403 }
        );
      }
    }

    // Handle CPA role
    if (user.role === "CPA") {
      console.log("🔍 LOGIN API - Looking up CPA for email:", user.email);

      const { data: cpa, error: cpaError } = await supabase
        .from("cpa_centers")
        .select("cpa_id")
        .eq("email", user.email)
        .maybeSingle();

      if (cpaError) throw cpaError;

      if (cpa) {
        cpaId = cpa.cpa_id;
        console.log("🔍 LOGIN API - Found cpaId:", cpaId);
      }

      if (!cpaId) {
        console.log("🔍 LOGIN API - No CPA found for email:", user.email);
        return NextResponse.json(
          { success: false, message: "CPA record not linked to this user." },
          { status: 403 }
        );
      }
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId,
        serviceCenterId,
        cpaId,
      },
    });

    // Cookie: Token (use user.id for now)
    response.cookies.set("clienthub_token", user.id.toString(), {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("clienthub_role", user.role, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("clienthub_issuedAt", Date.now().toString(), {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    if (clientId) {
      console.log("🔍 LOGIN API - Setting clienthub_clientId cookie to:", clientId);
      response.cookies.set("clienthub_clientId", clientId.toString(), {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
    }

    if (serviceCenterId) {
      console.log("🔍 LOGIN API - Setting clienthub_serviceCenterId cookie to:", serviceCenterId);
      response.cookies.set("clienthub_serviceCenterId", serviceCenterId.toString(), {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
    }

    if (cpaId) {
      console.log("🔍 LOGIN API - Setting clienthub_cpaId cookie to:", cpaId);
      response.cookies.set("clienthub_cpaId", cpaId.toString(), {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
    }

    return response;

  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
