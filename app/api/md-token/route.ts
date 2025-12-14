import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createReadScalingToken from "./createReadScalingToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isJwt = (s: unknown) => typeof s === "string" && s.split(".").length === 3;

export async function GET(request: NextRequest) {
  const wantReadScaling = request.nextUrl.searchParams.get("read_scaling") === "true";
  const canUseReadScaling = wantReadScaling && process.env.NODE_ENV !== "development";

  try {
    if (canUseReadScaling) {
      const rs = await createReadScalingToken(3600);

      // If it fails or returns a non-JWT, fall back instead of 500
      if (isJwt(rs?.token)) {
        return NextResponse.json(
          { mdToken: rs.token, expire_at: rs.expire_at ?? "" },
          { headers: { "cache-control": "no-store" } }
        );
      }

      console.warn("read_scaling token invalid; falling back to MOTHERDUCK_TOKEN", {
        sample: String(rs?.token).slice(0, 30),
      });
    }

    const token = process.env.MOTHERDUCK_TOKEN;

    if (!isJwt(token)) {
      return NextResponse.json(
        { error: "MOTHERDUCK_TOKEN is missing/invalid on the server" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json(
      { mdToken: token, expire_at: "" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to generate token", error);

    // Even on exception, fall back to env token if possible
    const token = process.env.MOTHERDUCK_TOKEN;
    if (isJwt(token)) {
      return NextResponse.json(
        { mdToken: token, expire_at: "", warning: "read_scaling failed; used fallback token" },
        { headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate token and no fallback token available" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
