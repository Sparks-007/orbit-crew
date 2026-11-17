import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/health — liveness + database connectivity probe. Unauthenticated.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "orbit-crew",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "orbit-crew" },
      { status: 503 }
    );
  }
}
