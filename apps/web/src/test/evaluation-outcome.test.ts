import { describe, expect, it } from "vitest";
import { buildRepositoryEvidence } from "@genforge/evidence";
import { generateReviewReport } from "@genforge/reports";
import {
  createDefaultEvaluationPlan,
  evaluateOutcomeChecks,
} from "@genforge/rules";
import type { EvidenceLink, ReviewTrajectory } from "@genforge/domain";
import { evaluatePreliminaryRules } from "@genforge/rules";
import {
  likelyGenLayerSnapshot,
  missingContractSourceSnapshot,
} from "./fixtures/github";

function minimalTrajectory(
  decision: "ACCEPT_FOR_SCORING" | "REQUEST_MORE_INFO" | "REJECT",
): ReviewTrajectory {
  return {
    reviewId: "review-outcome",
    submissionId: "submission-outcome",
    events: [
      {
        id: "d1",
        at: "2026-07-17T00:00:00.000Z",
        kind: "decision_made",
        stage: "decision_gate",
        actor: "agent",
        payload: { decision },
        evidenceIds: [],
      },
      {
        id: "s1",
        at: "2026-07-17T00:00:01.000Z",
        kind: "score_computed",
        stage: "scoring",
        actor: "agent",
        payload: { total: 3.2 },
        evidenceIds: [],
      },
    ],
  };
}

describe("outcome evaluation", () => {
  it("flags unsupported conclusions and evidence mismatches", () => {
    const evidenceResult = buildRepositoryEvidence(likelyGenLayerSnapshot);
    const ruleResult = evaluatePreliminaryRules(evidenceResult);
    const report = generateReviewReport({
      snapshot: likelyGenLayerSnapshot,
      evidenceResult,
      ruleResult,
    });
    report.findings[0] = {
      ...report.findings[0],
      evidenceIds: ["missing-evidence"],
    };

    const evidenceLinks: EvidenceLink[] = [
      {
        evidenceId: report.evidence[0].id,
        supports: "rule",
        targetId: report.findings[0].ruleId,
        strength: "contradictory",
      },
    ];

    const result = evaluateOutcomeChecks({
      report,
      trajectory: minimalTrajectory("ACCEPT_FOR_SCORING"),
      evidence: report.evidence,
      evidenceLinks,
      plan: createDefaultEvaluationPlan(),
    });

    expect(
      result.issues.some((item) => item.code === "FINDING_WITHOUT_EVIDENCE"),
    ).toBe(true);
    expect(
      result.issues.some((item) => item.code === "UNSUPPORTED_CONCLUSION"),
    ).toBe(true);
    expect(
      result.issues.some((item) => item.code === "EVIDENCE_RULE_MISMATCH"),
    ).toBe(true);
  });

  it("flags missing manual review escalation and scoring of non-scoring decisions", () => {
    const evidenceResult = buildRepositoryEvidence(
      missingContractSourceSnapshot,
    );
    const ruleResult = evaluatePreliminaryRules(evidenceResult);
    const report = generateReviewReport({
      snapshot: missingContractSourceSnapshot,
      evidenceResult,
      ruleResult,
    });
    report.manualVerificationQueue = [];
    report.decision = "REQUEST_MORE_INFO";

    const result = evaluateOutcomeChecks({
      report,
      trajectory: minimalTrajectory("REQUEST_MORE_INFO"),
      evidence: report.evidence,
      evidenceLinks: [],
      plan: createDefaultEvaluationPlan(),
    });

    expect(
      result.issues.some(
        (item) => item.code === "MISSING_MANUAL_REVIEW_ESCALATION",
      ),
    ).toBe(true);
    expect(
      result.issues.some((item) => item.code === "SCORED_REJECTED_SUBMISSION"),
    ).toBe(true);
  });
});
