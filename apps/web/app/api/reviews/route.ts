import { NextResponse } from "next/server";
import { runPreliminaryRepositoryReview } from "@/lib/review-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_REPOSITORY_URL",
          message: "Request body must be valid JSON.",
          details: [],
        },
      },
      { status: 400 },
    );
  }

  const response = await runPreliminaryRepositoryReview(body, {
    token: process.env.GITHUB_TOKEN,
    genlayer: {
      mode: process.env.GENLAYER_MODE === "mock" ? "mock" : "sdk",
      network: process.env.GENLAYER_NETWORK,
      contractAddress: process.env.GENLAYER_CONTRACT_ADDRESS,
      rpcUrl: process.env.GENLAYER_RPC_URL,
    },
  });

  if (response.ok) {
    return NextResponse.json(response, { status: 200 });
  }

  const status =
    response.error.code === "INVALID_REPOSITORY_URL"
      ? 400
      : response.error.code === "UNSUPPORTED_HOST"
        ? 400
        : response.error.code === "REPOSITORY_NOT_FOUND"
          ? 404
          : response.error.code === "PRIVATE_REPOSITORY"
            ? 403
            : response.error.code === "RATE_LIMITED"
              ? 429
              : response.error.code === "RESPONSE_TOO_LARGE"
                ? 413
                : response.error.code === "GITHUB_UNAVAILABLE"
                  ? 503
                  : 500;

  return NextResponse.json(response, { status });
}
