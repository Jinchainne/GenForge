// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const getGenLayerCliStatusMock = vi.fn();
const attemptOperatorDeployMock = vi.fn();

vi.mock("@/lib/genlayer-ops", () => ({
  getGenLayerCliStatus: getGenLayerCliStatusMock,
  attemptOperatorDeploy: attemptOperatorDeployMock,
}));

describe("GET /api/ops/genlayer", () => {
  beforeEach(() => {
    getGenLayerCliStatusMock.mockReset();
    attemptOperatorDeployMock.mockReset();
  });

  it("returns the observed operator status", async () => {
    getGenLayerCliStatusMock.mockResolvedValue({
      cliAvailable: true,
      observedAt: "2026-07-17T12:00:00.000Z",
      network: {
        alias: "studionet",
        name: "Genlayer Studio Network",
        chainId: "61999",
        rpc: "https://studio.genlayer.com/api",
        mainContract: "0xabc",
        explorer: "https://genlayer-explorer.vercel.app",
      },
      account: {
        name: "codexdeploy",
        address: "0x123",
        balance: "0 GEN",
        network: "Genlayer Studio Network",
        status: "unlocked",
        active: true,
      },
      publicRuntime: {
        network: "studionet",
        rpcUrl: "https://studio.genlayer.com/api",
      },
      deployReadiness: {
        status: "blocked",
        blockers: ["The active GenLayer account has 0 GEN."],
        commands: [],
      },
    });

    const { GET } = await import("@/app/api/ops/genlayer/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status.cliAvailable).toBe(true);
    expect(payload.status.account.balance).toBe("0 GEN");
  });
});

describe("POST /api/ops/genlayer", () => {
  beforeEach(() => {
    getGenLayerCliStatusMock.mockReset();
    attemptOperatorDeployMock.mockReset();
  });

  it("rejects unknown contract targets", async () => {
    const { POST } = await import("@/app/api/ops/genlayer/route");
    const response = await POST(
      new Request("http://localhost/api/ops/genlayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract: "unknown" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns a blocked deploy result when operator deployment fails", async () => {
    attemptOperatorDeployMock.mockResolvedValue({
      ok: false,
      contract: "review",
      command: "genlayer deploy --contract contracts/genforge_judge/review_submission.py",
      stdout: "",
      stderr: "Operator deployment is disabled.",
      observedAt: "2026-07-17T12:05:00.000Z",
    });

    const { POST } = await import("@/app/api/ops/genlayer/route");
    const response = await POST(
      new Request("http://localhost/api/ops/genlayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract: "review" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.result.stderr).toContain("disabled");
  });
});
