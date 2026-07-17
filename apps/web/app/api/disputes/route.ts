import { NextResponse } from "next/server";
import { generateEnterpriseDisputeReport } from "@/lib/dispute-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_CASE_INPUT",
          message: "Request body must be valid JSON.",
          details: [],
        },
      },
      { status: 400 },
    );
  }

  const response = await generateEnterpriseDisputeReport(body);

  if (response.ok) {
    return NextResponse.json(response, { status: 200 });
  }

  return NextResponse.json(response, {
    status: response.error.code === "INVALID_CASE_INPUT" ? 400 : 500,
  });
}
