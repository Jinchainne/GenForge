import { randomUUID } from "node:crypto";
import {
  CreateReviewInputSchema,
  ReviewErrorSchema,
  ReviewSuccessSchema,
  normalizeGitHubRepositoryUrl,
  NormalizeRepositoryUrlError,
  type ReviewReport,
  type ReviewResponse,
} from "@genforge/domain";
import { calculateReviewConfidence } from "@genforge/confidence";
import { buildRepositoryEvidence } from "@genforge/evidence";
import {
  buildGenLayerJudgingRequest,
  rankAcceptedSubmission,
} from "@genforge/evaluations";
import {
  submitGenLayerReview,
  type GenLayerClientConfig,
} from "@genforge/genlayer-client";
import {
  GitHubAdapterError,
  scanGitHubRepository,
} from "@genforge/github-adapter";
import { generateReviewReport } from "@genforge/reports";
import { evaluatePreliminaryRules } from "@genforge/rules";

export interface ReviewServiceOptions {
  token?: string;
  genlayer?: GenLayerClientConfig;
}

function deriveReportState(
  baseState:
    | "partial_result"
    | "rejected"
    | "request_more_information"
    | "accepted_for_scoring"
    | "integration_unavailable",
  genlayerStatus: ReviewReport["genlayerResult"]["status"],
): ReviewReport["state"] {
  if (baseState === "rejected" || baseState === "request_more_information") {
    return baseState;
  }
  if (genlayerStatus === "CONSENSUS_PENDING") {
    return "consensus_pending";
  }
  if (
    genlayerStatus === "GENLAYER_NOT_CONFIGURED" ||
    genlayerStatus === "GENLAYER_UNAVAILABLE" ||
    genlayerStatus === "TRANSACTION_FAILED" ||
    genlayerStatus === "TRANSACTION_REJECTED" ||
    genlayerStatus === "UNEXPECTED_RESULT"
  ) {
    return "integration_unavailable";
  }
  if (genlayerStatus === "SKIPPED_BY_GATE") {
    return "partial_result";
  }
  return "accepted_for_scoring";
}

export async function runPreliminaryRepositoryReview(
  body: unknown,
  options: ReviewServiceOptions = {},
): Promise<ReviewResponse> {
  try {
    const input = CreateReviewInputSchema.parse(body);
    const normalized = normalizeGitHubRepositoryUrl(input.repositoryUrl);
    const snapshot = await scanGitHubRepository(normalized, {
      token: options.token,
    });
    const evidenceResult = buildRepositoryEvidence(snapshot);
    const ruleResult = evaluatePreliminaryRules(evidenceResult);
    const reviewId = randomUUID();
    const submissionId = randomUUID();
    const genlayerRequest = buildGenLayerJudgingRequest({
      submissionId,
      snapshot,
      gate: ruleResult.gate,
      evidence: evidenceResult.evidence,
      subjectiveQuestions: ruleResult.subjectiveQuestions,
    });
    const genlayerResult = await submitGenLayerReview(
      genlayerRequest,
      options.genlayer,
    );
    const confidence = calculateReviewConfidence({
      evidence: evidenceResult.evidence,
      missingInformationCount: evidenceResult.missingInformation.length,
      manualVerificationCount: evidenceResult.manualVerificationQueue.length,
      genlayerResult,
      deterministicDecision: ruleResult.decision,
    });

    const preliminaryReport = generateReviewReport({
      reviewId,
      submissionId,
      snapshot,
      evidenceResult,
      ruleResult,
      genlayerRequest,
      genlayerResult,
      confidence,
      ranking: {
        eligible: false,
        position: null,
        comparedSubmissionIds: [],
        rationale:
          "Ranking is computed after the final review report is assembled.",
      },
      state: deriveReportState(ruleResult.state, genlayerResult.status),
    });

    const ranking = rankAcceptedSubmission(preliminaryReport);
    const report = generateReviewReport({
      reviewId,
      submissionId,
      snapshot,
      evidenceResult,
      ruleResult,
      genlayerRequest,
      genlayerResult,
      confidence,
      ranking,
      state: preliminaryReport.state,
    });

    return ReviewSuccessSchema.parse({
      ok: true,
      report,
    });
  } catch (error) {
    if (error instanceof NormalizeRepositoryUrlError) {
      return ReviewErrorSchema.parse({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: [],
        },
      });
    }

    if (error instanceof GitHubAdapterError) {
      return ReviewErrorSchema.parse({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    if (error instanceof Error && error.name === "ZodError") {
      return ReviewErrorSchema.parse({
        ok: false,
        error: {
          code: "INVALID_REPOSITORY_URL",
          message: "Request body did not match the expected schema.",
          details: [error.message],
        },
      });
    }

    return ReviewErrorSchema.parse({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "GenForge could not complete the review.",
        details: error instanceof Error ? [error.message] : [],
      },
    });
  }
}
