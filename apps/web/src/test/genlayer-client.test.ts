import { describe, expect, it } from "vitest";
import { submitGenLayerReview } from "@genforge/genlayer-client";
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
});
