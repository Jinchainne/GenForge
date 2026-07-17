import { describe, expect, it } from "vitest";
import { normalizeGitHubRepositoryUrl } from "@genforge/domain";
import { scanGitHubRepository } from "@genforge/github-adapter";

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

describe("scanGitHubRepository", () => {
  it("collects metadata, tree, and selected files from GitHub API", async () => {
    const normalized = normalizeGitHubRepositoryUrl(
      "https://github.com/builder/judge-dapp",
    );

    const responses = new Map<string, Response>([
      [
        "https://api.github.com/repos/builder/judge-dapp",
        mockResponse({
          default_branch: "main",
          description: "Judge app",
          stargazers_count: 12,
          html_url: "https://github.com/builder/judge-dapp",
          private: false,
        }),
      ],
      [
        "https://api.github.com/repos/builder/judge-dapp/branches/main",
        mockResponse({
          commit: {
            sha: "abc1234def5678",
          },
        }),
      ],
      [
        "https://api.github.com/repos/builder/judge-dapp/git/trees/main?recursive=1",
        mockResponse({
          truncated: false,
          tree: [
            { path: "README.md", type: "blob", size: 100 },
            { path: "contracts/judge_contract.py", type: "blob", size: 200 },
            { path: "web/src/contractClient.ts", type: "blob", size: 200 },
            { path: "package.json", type: "blob", size: 100 },
            { path: "pnpm-lock.yaml", type: "blob", size: 120 },
          ],
        }),
      ],
      [
        "https://api.github.com/repos/builder/judge-dapp/contents/README.md?ref=main",
        mockResponse({
          path: "README.md",
          size: 100,
          type: "file",
          encoding: "base64",
          content: Buffer.from("GenLayer repository").toString("base64"),
        }),
      ],
      [
        "https://api.github.com/repos/builder/judge-dapp/contents/contracts%2Fjudge_contract.py?ref=main",
        mockResponse({
          path: "contracts/judge_contract.py",
          size: 200,
          type: "file",
          encoding: "base64",
          content: Buffer.from("from genlayer import *").toString("base64"),
        }),
      ],
      [
        "https://api.github.com/repos/builder/judge-dapp/contents/web%2Fsrc%2FcontractClient.ts?ref=main",
        mockResponse({
          path: "web/src/contractClient.ts",
          size: 200,
          type: "file",
          encoding: "base64",
          content: Buffer.from(
            "import { createClient } from 'genlayer-js';",
          ).toString("base64"),
        }),
      ],
      [
        "https://api.github.com/repos/builder/judge-dapp/contents/package.json?ref=main",
        mockResponse({
          path: "package.json",
          size: 100,
          type: "file",
          encoding: "base64",
          content: Buffer.from(
            '{"dependencies":{"genlayer-js":"1.0.0"}}',
          ).toString("base64"),
        }),
      ],
      [
        "https://api.github.com/repos/builder/judge-dapp/contents/pnpm-lock.yaml?ref=main",
        mockResponse({
          path: "pnpm-lock.yaml",
          size: 120,
          type: "file",
          encoding: "base64",
          content: Buffer.from("lockfileVersion: '9.0'").toString("base64"),
        }),
      ],
    ]);

    const snapshot = await scanGitHubRepository(normalized, {
      fetchImpl: async (input) => {
        const url = typeof input === "string" ? input : input.toString();
        const response = responses.get(url);
        if (!response) {
          throw new Error(`Unhandled URL ${url}`);
        }
        return response;
      },
    });

    expect(snapshot.metadata.defaultBranch).toBe("main");
    expect(snapshot.metadata.commitSha).toBe("abc1234def5678");
    expect(snapshot.filesRetrieved).toBeGreaterThan(3);
  });

  it("surfaces rate limit errors", async () => {
    const normalized = normalizeGitHubRepositoryUrl(
      "https://github.com/builder/judge-dapp",
    );

    await expect(
      scanGitHubRepository(normalized, {
        fetchImpl: async () =>
          new Response("{}", {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
            },
          }),
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
