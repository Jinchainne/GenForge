import { describe, expect, it } from "vitest";
import {
  submitBrowserContractJson,
  connectBrowserWallet,
  disconnectBrowserWallet,
  getBrowserWalletLabel,
  submitGenLayerReview,
  submitGenLayerReviewFromBrowser,
  trackBrowserContractJsonTransaction,
  trackGenLayerReviewTransaction,
} from "@genforge/genlayer-client";
import type { GenLayerReviewRequest } from "@genforge/domain";

const request: GenLayerReviewRequest = {
  submissionId: "submission-1",
  repository: {
    owner: "builder",
    name: "judge-dapp",
    commitSha: "abc1234def5678",
  },
  program: "genlayer-project-review-v1",
  gate: {
    decision: "ACCEPT_FOR_SCORING",
    passedRuleIds: ["GL-GATE-003"],
    failedRuleIds: [],
    missingRuleIds: [],
  },
  evidenceSummary: [
    {
      evidenceId: "ev-1",
      classification: "OBSERVED",
      summary: "Observed a real GenLayer contract path.",
      repositoryFileOrUrl: "contracts/genforge_judge/review_submission.py",
    },
  ],
  subjectiveQuestions: [
    {
      id: "genlayer-fit",
      prompt: "Does the project benefit from decentralized adjudication?",
      rationale: "Decorative GenLayer use should not pass.",
    },
  ],
  equivalencePrinciple:
    "Use non-comparative validation grounded in the bounded evidence package.",
  requestLimits: {
    maxEvidenceItems: 10,
    maxEvidenceChars: 220,
    maxSubjectiveQuestions: 3,
    maxOutputChars: 1800,
  },
};

describe("submitGenLayerReview", () => {
  it("returns not configured when live secrets are missing", async () => {
    const result = await submitGenLayerReview(request, {
      mode: "sdk",
      network: "studionet",
      contractAddress: "0x123",
    });

    expect(result.status).toBe("GENLAYER_NOT_CONFIGURED");
  });

  it("parses a finalized live receipt through the real SDK contract flow", async () => {
    const fakeSdk = {
      createAccount: () => ({ address: "0xabc" }),
      createClient: () => ({
        writeContract: async () => "0xlivehash",
        waitForTransactionReceipt: async () => ({
          statusName: "FINALIZED",
          txExecutionResultName: "FINISHED_WITH_RETURN",
          result: JSON.stringify({
            decision: "ACCEPT_FOR_SCORING",
            scores: {
              genlayer_fit: 4,
              contract_quality: 4,
              engineering: 3,
              frontend_ux: 3,
            },
            confidence: 0.81,
            summary: "Live receipt returned a valid judgment.",
            strengths: ["Receipt contained structured output."],
            findings: [],
            required_actions: [],
            manual_review_required: false,
          }),
        }),
      }),
    };

    const result = await submitGenLayerReview(request, {
      mode: "sdk",
      network: "studionet",
      contractAddress: "0x123",
      rpcUrl: "https://rpc.example",
      privateKey:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      sdkOverride: fakeSdk,
      chainsOverride: {
        studionet: { id: 101, isStudio: true },
      },
      typesOverride: {
        TransactionStatus: {
          FINALIZED: "FINALIZED",
        },
      },
    });

    expect(result.status).toBe("CONSENSUS_ACCEPTED");
    expect(result.transactionHash).toBe("0xlivehash");
    expect(result.judgment?.summary).toContain("Live receipt");
  });

  it("connects a browser wallet and switches to the configured network", async () => {
    const provider = {
      request: async ({ method }: { method: string }) =>
        method === "eth_requestAccounts"
          ? ["0xabc0000000000000000000000000000000000000"]
          : [],
    };
    let connectedNetwork = "";
    const fakeSdk = {
      createClient: (options: Record<string, unknown>) => ({
        ...options,
        connect: async (network: string) => {
          connectedNetwork = network;
        },
      }),
    };

    const connection = await connectBrowserWallet({
      network: "studionet",
      contractAddress: "0x123",
      rpcUrl: "https://rpc.example",
      provider,
      sdkOverride: fakeSdk,
      chainsOverride: {
        studionet: { id: 101, isStudio: true },
      },
      typesOverride: {
        TransactionStatus: {
          ACCEPTED: "ACCEPTED",
          FINALIZED: "FINALIZED",
        },
      },
    });

    expect(connection.address).toBe("0xabc0000000000000000000000000000000000000");
    expect(connectedNetwork).toBe("studionet");
  });

  it("labels common wallet providers without requiring MetaMask", () => {
    expect(getBrowserWalletLabel({ request: async () => [], isRabby: true })).toBe(
      "Rabby Wallet",
    );
    expect(getBrowserWalletLabel({ request: async () => [] })).toBe(
      "Browser Wallet",
    );
  });

  it("disconnects by revoking permissions when the provider supports it", async () => {
    let revokeCalled = false;
    const result = await disconnectBrowserWallet({
      request: async ({ method }: { method: string }) => {
        if (method === "wallet_revokePermissions") {
          revokeCalled = true;
        }
        return null;
      },
    });

    expect(revokeCalled).toBe(true);
    expect(result.revoked).toBe(true);
  });

  it("falls back to local session clearing when wallet revoke is unavailable", async () => {
    const result = await disconnectBrowserWallet({
      request: async () => {
        throw new Error("unsupported method");
      },
    });

    expect(result.revoked).toBe(false);
    expect(result.message).toContain("cleared the local wallet session");
  });

  it("submits through a browser wallet and returns a pending consensus state after acceptance", async () => {
    const provider = {
      request: async () => ["0xabc0000000000000000000000000000000000000"],
    };
    const fakeSdk = {
      createClient: (options: Record<string, unknown>) => ({
        ...options,
        connect: async () => undefined,
        writeContract: async () => "0xwallettx",
        waitForTransactionReceipt: async () => ({
          statusName: "ACCEPTED",
          txExecutionResultName: "NOT_VOTED",
        }),
      }),
    };

    const result = await submitGenLayerReviewFromBrowser(request, {
      network: "studionet",
      contractAddress: "0x123",
      rpcUrl: "https://rpc.example",
      provider,
      sdkOverride: fakeSdk,
      chainsOverride: {
        studionet: { id: 101, isStudio: true },
      },
      typesOverride: {
        TransactionStatus: {
          ACCEPTED: "ACCEPTED",
          FINALIZED: "FINALIZED",
        },
      },
    });

    expect(result.status).toBe("CONSENSUS_PENDING");
    expect(result.transactionHash).toBe("0xwallettx");
  });

  it("tracks a previously submitted transaction to a finalized judgment", async () => {
    const provider = {
      request: async () => ["0xabc0000000000000000000000000000000000000"],
    };
    const fakeSdk = {
      createClient: (options: Record<string, unknown>) => ({
        ...options,
        connect: async () => undefined,
        waitForTransactionReceipt: async () => ({
          statusName: "FINALIZED",
          txExecutionResultName: "FINISHED_WITH_RETURN",
          result: JSON.stringify({
            decision: "REJECT",
            scores: {
              genlayer_fit: 2,
              contract_quality: 2,
              engineering: 1,
              frontend_ux: 1,
            },
            confidence: 0.61,
            summary: "Consensus finalized with a rejection.",
            strengths: [],
            findings: ["The requested judgment rejected the submission."],
            required_actions: ["Address the findings and resubmit."],
            manual_review_required: true,
          }),
        }),
        readContract: async () => null,
      }),
    };

    const result = await trackGenLayerReviewTransaction(request, "0xwallettx", {
      network: "studionet",
      contractAddress: "0x123",
      rpcUrl: "https://rpc.example",
      provider,
      sdkOverride: fakeSdk,
      chainsOverride: {
        studionet: { id: 101, isStudio: true },
      },
      typesOverride: {
        TransactionStatus: {
          ACCEPTED: "ACCEPTED",
          FINALIZED: "FINALIZED",
        },
      },
    });

    expect(result.status).toBe("CONSENSUS_REJECTED");
    expect(result.judgment?.summary).toContain("rejection");
  });

  it("submits a generic browser contract call and parses finalized JSON output", async () => {
    const provider = {
      request: async () => ["0xabc0000000000000000000000000000000000000"],
    };
    const fakeSdk = {
      createClient: (options: Record<string, unknown>) => ({
        ...options,
        connect: async () => undefined,
        writeContract: async () => "0xgeneric",
        waitForTransactionReceipt: async () => ({
          statusName: "FINALIZED",
          txExecutionResultName: "FINISHED_WITH_RETURN",
          result: JSON.stringify({
            disposition: "claim_partially_upheld",
            liability_split: "shared",
          }),
        }),
      }),
    };

    const result = await submitBrowserContractJson(
      {
        functionName: "resolve_dispute",
        args: ['{"caseId":"case-1"}'],
      },
      {
        network: "studionet",
        contractAddress: "0x123",
        rpcUrl: "https://rpc.example",
        provider,
        sdkOverride: fakeSdk,
        chainsOverride: {
          studionet: { id: 101, isStudio: true },
        },
        typesOverride: {
          TransactionStatus: {
            ACCEPTED: "ACCEPTED",
            FINALIZED: "FINALIZED",
          },
        },
      },
    );

    expect(result.status).toBe("FINALIZED");
    expect(result.transactionHash).toBe("0xgeneric");
    expect(result.result).toMatchObject({
      disposition: "claim_partially_upheld",
    });
  });

  it("tracks a generic browser contract call via readback when receipt result is not parseable", async () => {
    const provider = {
      request: async () => ["0xabc0000000000000000000000000000000000000"],
    };
    const fakeSdk = {
      createClient: (options: Record<string, unknown>) => ({
        ...options,
        connect: async () => undefined,
        waitForTransactionReceipt: async () => ({
          statusName: "FINALIZED",
          txExecutionResultName: "FINISHED_WITH_RETURN",
          result: undefined,
        }),
        readContract: async () =>
          JSON.stringify({
            disposition: "request_more_information",
            liability_split: "undetermined",
          }),
      }),
    };

    const result = await trackBrowserContractJsonTransaction(
      "0xgeneric",
      {
        readback: {
          functionName: "get_resolution_judgment",
          args: ["case-001"],
        },
      },
      {
        network: "studionet",
        contractAddress: "0x123",
        rpcUrl: "https://rpc.example",
        provider,
        sdkOverride: fakeSdk,
        chainsOverride: {
          studionet: { id: 101, isStudio: true },
        },
        typesOverride: {
          TransactionStatus: {
            ACCEPTED: "ACCEPTED",
            FINALIZED: "FINALIZED",
          },
        },
      },
    );

    expect(result.status).toBe("FINALIZED");
    expect(result.result).toMatchObject({
      disposition: "request_more_information",
    });
  });
});
