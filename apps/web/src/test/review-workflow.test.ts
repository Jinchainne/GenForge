import { describe, expect, it } from "vitest";
import type { ReviewReport } from "@genforge/domain";
import {
  applyLiveGenLayerResult,
  buildFixChecklist,
  canRequestOnchainAdjudication,
  deriveOnchainWorkflowState,
} from "@/lib/review-workflow";

const report: ReviewReport = {
  reviewId: "review-1",
  submissionId: "submission-1",
  reviewKind: "GenLayer Project Review",
  program: "genlayer-project-review-v1",
  repository: {
    owner: "builder",
    repo: "judge-dapp",
    defaultBranch: "main",
    commitSha: "abc1234def5678",
    description: "Review workflow fixture",
    visibility: "public",
    stars: 1,
    htmlUrl: "https://github.com/builder/judge-dapp",
  },
  decision: "ACCEPT_FOR_SCORING",
  state: "accepted_for_scoring",
  summary: "Report is eligible for scoring.",
  gate: {
    decision: "ACCEPT_FOR_SCORING",
    passedRuleIds: ["GL-GATE-001"],
    failedRuleIds: [],
    missingRuleIds: [],
  },
  subjectiveQuestions: [],
  scores: {
    genLayerFit: 4,
    contractQuality: 3,
    engineering: 3,
    frontendUx: 4,
    evidenceConfidence: 4,
    total: 3.6,
  },
  evidence: [],
  findings: [
    {
      id: "finding-1",
      ruleId: "GL-CON-003",
      title: "Validator logic needs more depth",
      severity: "high",
      outcome: "triggered",
      classification: "INFERRED",
      confidence: "medium",
      summary: "Current validator logic still looks too shallow.",
      evidenceIds: ["e1"],
      remediation: ["Add richer evidence-based validator criteria."],
      manualVerification: ["Confirm live validator disagreement handling."],
    },
  ],
  missingInformation: [],
  manualVerificationQueue: [],
  remediation: ["Add richer evidence-based validator criteria."],
  sourceVerification: {
    repositoryUrl: "https://github.com/builder/judge-dapp",
    defaultBranch: "main",
    commitSha: "abc1234def5678",
    fetchedAt: new Date().toISOString(),
    filesConsidered: 10,
    filesRetrieved: 6,
    rateLimitRemaining: 42,
    limitations: [],
  },
  genlayerRequest: {
    submissionId: "submission-1",
    repository: {
      owner: "builder",
      name: "judge-dapp",
      commitSha: "abc1234def5678",
    },
    program: "genlayer-project-review-v1",
    gate: {
      decision: "ACCEPT_FOR_SCORING",
      passedRuleIds: ["GL-GATE-001"],
      failedRuleIds: [],
      missingRuleIds: [],
    },
    evidenceSummary: [],
    subjectiveQuestions: [],
    equivalencePrinciple: "Use bounded evidence.",
    requestLimits: {
      maxEvidenceItems: 10,
      maxEvidenceChars: 220,
      maxSubjectiveQuestions: 3,
      maxOutputChars: 1800,
    },
  },
  genlayerResult: {
    status: "GENLAYER_NOT_CONFIGURED",
    judgment: null,
    parserMessage: "Missing runtime config.",
  },
  confidence: {
    score: 0.6,
    level: "medium",
    factors: [],
  },
  ranking: {
    eligible: true,
    position: 1,
    comparedSubmissionIds: [],
    rationale: "Fixture report.",
  },
  limitations: [],
  generatedAt: new Date().toISOString(),
};

describe("review workflow helpers", () => {
  it("builds a severity-sorted fix checklist", () => {
    const checklist = buildFixChecklist(report);

    expect(checklist).toHaveLength(1);
    expect(checklist[0].ruleId).toBe("GL-CON-003");
    expect(checklist[0].actions[0]).toContain("validator");
  });

  it("detects when a report can be submitted for on-chain adjudication", () => {
    expect(canRequestOnchainAdjudication(report)).toBe(true);
  });

  it("maps pending and finalized GenLayer results into workflow state", () => {
    const pending = deriveOnchainWorkflowState({
      status: "CONSENSUS_PENDING",
      network: "studionet",
      contractAddress: "0x123",
      transactionHash: "0xabc",
      receiptStatus: "ACCEPTED",
      judgment: null,
      parserMessage: "Pending",
    });
    const finalized = deriveOnchainWorkflowState({
      status: "CONSENSUS_ACCEPTED",
      network: "studionet",
      contractAddress: "0x123",
      transactionHash: "0xabc",
      receiptStatus: "FINALIZED",
      judgment: {
        decision: "ACCEPT_FOR_SCORING",
        scores: {
          genlayer_fit: 4,
          contract_quality: 4,
          engineering: 3,
          frontend_ux: 3,
        },
        confidence: 0.8,
        summary: "Accepted.",
        strengths: [],
        findings: [],
        required_actions: [],
        manual_review_required: false,
      },
    });

    expect(pending.status).toBe("tracking");
    expect(finalized.status).toBe("finalized");
  });

  it("applies a live GenLayer result back into the displayed report", () => {
    const nextReport = applyLiveGenLayerResult(report, {
      status: "CONSENSUS_ACCEPTED",
      network: "studionet",
      contractAddress: "0x123",
      transactionHash: "0xabc",
      receiptStatus: "FINALIZED",
      judgment: {
        decision: "ACCEPT_FOR_SCORING",
        scores: {
          genlayer_fit: 4,
          contract_quality: 4,
          engineering: 3,
          frontend_ux: 3,
        },
        confidence: 0.8,
        summary: "Live judgment accepted the request.",
        strengths: [],
        findings: [],
        required_actions: [],
        manual_review_required: false,
      },
      parserMessage: "Live receipt parsed successfully.",
    });

    expect(nextReport.genlayerResult.status).toBe("CONSENSUS_ACCEPTED");
    expect(nextReport.summary).toContain("Live judgment");
  });
});
