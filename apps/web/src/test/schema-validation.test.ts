import { describe, expect, it } from "vitest";
import {
  CreateReviewInputSchema,
  ReviewReportSchema,
  ReviewSuccessSchema,
} from "@genforge/domain";
import { buildRepositoryEvidence } from "@genforge/evidence";
import { generateReviewReport } from "@genforge/reports";
import { evaluatePreliminaryRules } from "@genforge/rules";
import { likelyGenLayerSnapshot } from "./fixtures/github";

describe("schema validation", () => {
  it("validates create review input", () => {
    expect(
      CreateReviewInputSchema.parse({
        repositoryUrl: "https://github.com/example/repo",
      }),
    ).toBeTruthy();
  });

  it("validates generated review reports", () => {
    const evidenceResult = buildRepositoryEvidence(likelyGenLayerSnapshot);
    const ruleResult = evaluatePreliminaryRules(evidenceResult);
    const report = generateReviewReport({
      snapshot: likelyGenLayerSnapshot,
      evidenceResult,
      ruleResult,
    });

    expect(ReviewReportSchema.parse(report).decision).toBeDefined();
    expect(
      ReviewSuccessSchema.parse({
        ok: true,
        report,
      }).ok,
    ).toBe(true);
  });
});
