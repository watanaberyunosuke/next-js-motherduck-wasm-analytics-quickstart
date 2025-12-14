import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createReadScalingToken from "./createReadScalingToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isJwt = (s: string) => typeof s === "string" && s.split(".").length === 3;

export async function GET(request: NextRequest) {
  try {
    const readScaling =
      request.nextUrl.searchParams.get("read_scaling") === "true" &&
      process.env.NODE_ENV !== "development";

    if (readScaling) {
      const { token, expire_at } = await createReadScalingToken(3600);

      if (!isJwt(token)) {
        return NextResponse.json(
          { error: "read_scaling token is not a JWT", sample: String(token).slice(0, 30) },
          { status: 500, headers: { "cache-control": "no-store" } }
        );
      }

      return NextResponse.json(
        { mdToken: token, expire_at },
        { headers: { "cache-control": "no-store" } }
      );
    }

    const token = process.env.MOTHERDUCK_TOKEN ?? "";
    if (!isJwt(token)) {
      return NextResponse.json(
        { error: "MOTHERDUCK_TOKEN is missing/invalid", sample: token.slice(0, 30) },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json(
      { mdToken: token, expire_at: "" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to generate token", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
