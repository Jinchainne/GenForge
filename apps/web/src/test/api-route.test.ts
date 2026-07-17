// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reviews/route";

function mockResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-remaining": "42",
      ...init.headers,
    },
  });
}

describe("POST /api/reviews", () => {
  it("returns a schema-validated review report", async () => {
    process.env.GENLAYER_MODE = "mock";
    const fetchMock = vi.fn(async (input: string | URL | RequestInfo) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/repos/builder/judge-dapp")) {
        return mockResponse({
          default_branch: "main",
          description: "Judge app",
          stargazers_count: 12,
          html_url: "https://github.com/builder/judge-dapp",
          private: false,
        });
      }
      if (url.includes("/branches/main")) {
        return mockResponse({
          commit: {
            sha: "abc1234def5678",
          },
        });
      }
      if (url.includes("/git/trees/main")) {
        return mockResponse({
          truncated: false,
          tree: [
            { path: "README.md", type: "blob", size: 100 },
            { path: "contracts/judge_contract.py", type: "blob", size: 200 },
            { path: "web/src/contractClient.ts", type: "blob", size: 220 },
            { path: "package.json", type: "blob", size: 100 },
            { path: "pnpm-lock.yaml", type: "blob", size: 120 },
            { path: "vercel.json", type: "blob", size: 80 },
          ],
        });
      }
      if (url.includes("README.md")) {
        return mockResponse({
          path: "README.md",
          size: 100,
          type: "file",
          encoding: "base64",
          content: Buffer.from("GenLayer repository").toString("base64"),
        });
      }
      if (url.includes("judge_contract.py")) {
        return mockResponse({
          path: "contracts/judge_contract.py",
          size: 200,
          type: "file",
          encoding: "base64",
          content: Buffer.from("from genlayer import *").toString("base64"),
        });
      }
      if (url.includes("package.json")) {
        return mockResponse({
          path: "package.json",
          size: 100,
          type: "file",
          encoding: "base64",
          content: Buffer.from(
            '{"dependencies":{"genlayer-js":"1.0.0"}}',
          ).toString("base64"),
        });
      }
      if (url.includes("contractClient.ts")) {
        return mockResponse({
          path: "web/src/contractClient.ts",
          size: 220,
          type: "file",
          encoding: "base64",
          content: Buffer.from(
            "import { createClient } from 'genlayer-js'; export async function submitReview(){ return createClient({}).writeContract(); }",
          ).toString("base64"),
        });
      }
      if (url.includes("vercel.json")) {
        return mockResponse({
          path: "vercel.json",
          size: 80,
          type: "file",
          encoding: "base64",
          content: Buffer.from('{"framework":"nextjs"}').toString("base64"),
        });
      }
      return mockResponse({
        path: "pnpm-lock.yaml",
        size: 120,
        type: "file",
        encoding: "base64",
        content: Buffer.from("lockfileVersion: '9.0'").toString("base64"),
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/builder/judge-dapp",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.report.reviewKind).toBe("GenLayer Project Review");
    expect(payload.report.genlayerResult.status).toBe("CONSENSUS_ACCEPTED");
  });

  it("returns rate-limited responses", async () => {
    process.env.GENLAYER_MODE = "mock";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("{}", {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
            },
          }),
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/builder/judge-dapp",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(429);
    expect(payload.error.code).toBe("RATE_LIMITED");
  });
});
