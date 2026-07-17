import { describe, expect, it } from "vitest";
import {
  ReviewEvaluationReportSchema,
  type ReviewTrajectory,
} from "@genforge/domain";
import {
  buildEvidenceLinksFromReviewReport,
  buildRepositoryEvidence,
} from "@genforge/evidence";
import {
  generateEvaluationReport,
  generateReviewReport,
} from "@genforge/reports";
import {
  createDefaultEvaluationPlan,
  evaluatePreliminaryRules,
  evaluateReviewExecution,
} from "@genforge/rules";
import { likelyGenLayerSnapshot } from "./fixtures/github";

describe("evaluation report", () => {
  it("builds a structured evaluation report", () => {
    const evidenceResult = buildRepositoryEvidence(likelyGenLayerSnapshot);
    const ruleResult = evaluatePreliminaryRules(evidenceResult);
    const reviewReport = generateReviewReport({
      snapshot: likelyGenLayerSnapshot,
      evidenceResult,
      ruleResult,
    });
    const links = buildEvidenceLinksFromReviewReport(reviewReport);
    const trajectory: ReviewTrajectory = {
      reviewId: "review-report",
      submissionId: "submission-report",
      events: [
        {
          id: "1",
          at: "2026-07-17T00:00:00.000Z",
          kind: "stage_completed",
          stage: "intake",
          actor: "agent",
          payload: {},
          evidenceIds: [],
        },
      ],
    };
    const plan = createDefaultEvaluationPlan();
    const verdict = evaluateReviewExecution({
      trajectory,
      report: reviewReport,
      evidenceLinks: links,
    });

    const evaluationReport = generateEvaluationReport({
      plan,
      trajectory,
      report: reviewReport,
      verdict,
    });

    expect(
      ReviewEvaluationReportSchema.parse(evaluationReport).verdict,
    ).toBeDefined();
    expect(evaluationReport.verdict.summary.length).toBeGreaterThan(0);
  });
});
