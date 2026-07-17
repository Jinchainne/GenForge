import { NextResponse } from "next/server";
import {
  attemptOperatorDeploy,
  getGenLayerCliStatus,
} from "@/lib/genlayer-ops";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const status = await getGenLayerCliStatus();
  return NextResponse.json({ ok: true, status }, { status: 200 });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  const contract =
    body &&
    typeof body === "object" &&
    "contract" in body &&
    (body.contract === "review" || body.contract === "dispute")
      ? body.contract
      : null;

  if (!contract) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_CONTRACT_TARGET",
          message: 'Body must include contract: "review" or "dispute".',
        },
      },
      { status: 400 },
    );
  }

  const result = await attemptOperatorDeploy(contract);
  return NextResponse.json(
    {
      ok: result.ok,
      result,
    },
    { status: result.ok ? 200 : 409 },
  );
}
