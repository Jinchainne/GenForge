import {
  type GenLayerReviewRequest,
  type RepositorySnapshot,
  ReviewReportSchema,
  ReviewConfidenceSchema,
  type GenLayerExecutionResult,
  GenLayerExecutionResultSchema,
  GenLayerReviewRequestSchema,
  type RankingResult,
  RankingResultSchema,
  type ReviewConfidence,
  type ReviewReport,
} from "@genforge/domain";
import type { EvidenceBuildResult } from "@genforge/evidence";
import type { RuleEvaluationResult } from "@genforge/rules";

export interface GenerateReportInput {
  reviewId?: string;
  submissionId?: string;
  snapshot: RepositorySnapshot;
  evidenceResult: EvidenceBuildResult;
  ruleResult: RuleEvaluationResult;
  genlayerRequest?: GenLayerReviewRequest;
  genlayerResult?: GenLayerExecutionResult;
  confidence?: ReviewConfidence;
  ranking?: RankingResult;
  state?: ReviewReport["state"];
}

export function generateReviewReport(input: GenerateReportInput): ReviewReport {
  const {
    reviewId = "review-generated",
    submissionId = "submission-generated",
    snapshot,
    evidenceResult,
    ruleResult,
    state = ruleResult.state,
  } = input;

  const genlayerRequest =
    input.genlayerRequest ??
    GenLayerReviewRequestSchema.parse({
      submissionId,
      repository: {
        owner: snapshot.metadata.owner,
        name: snapshot.metadata.repo,
        commitSha: snapshot.metadata.commitSha,
      },
      program: "genlayer-project-review-v1",
      gate: ruleResult.gate,
      evidenceSummary: evidenceResult.evidence.slice(0, 5).map((item) => ({
        evidenceId: item.id,
        classification: item.classification,
        summary: item.summary,
        repositoryFileOrUrl: item.repositoryFileOrUrl,
      })),
      subjectiveQuestions: ruleResult.subjectiveQuestions,
      equivalencePrinciple:
        "Use normalized structured output with substantive validator checks.",
      requestLimits: {
        maxEvidenceItems: 10,
        maxEvidenceChars: 220,
        maxSubjectiveQuestions: 3,
        maxOutputChars: 1800,
      },
    });
  const genlayerResult =
    input.genlayerResult ??
    GenLayerExecutionResultSchema.parse({
      status: "SKIPPED_BY_GATE",
      judgment: null,
      parserMessage:
        "Report generated without an explicit GenLayer execution result.",
    });
  const confidence =
    input.confidence ??
    ReviewConfidenceSchema.parse({
      score: 0.5,
      level: "medium",
      factors: [],
    });
  const ranking =
    input.ranking ??
    RankingResultSchema.parse({
      eligible: false,
      position: null,
      comparedSubmissionIds: [],
      rationale: "Ranking was not computed for this report generation path.",
    });

  const judgment = genlayerResult.judgment;
  const mergedScores = judgment
    ? {
        genLayerFit: judgment.scores.genlayer_fit,
        contractQuality: judgment.scores.contract_quality,
        engineering: judgment.scores.engineering,
        frontendUx: judgment.scores.frontend_ux,
        evidenceConfidence: ruleResult.scores.evidenceConfidence,
        total: Number(
          (
            (judgment.scores.genlayer_fit +
              judgment.scores.contract_quality +
              judgment.scores.engineering +
              judgment.scores.frontend_ux +
              ruleResult.scores.evidenceConfidence) /
            5
          ).toFixed(1),
        ),
      }
    : ruleResult.scores;

  return ReviewReportSchema.parse({
    reviewId,
    submissionId,
    reviewKind: "GenLayer Project Review",
    program: "genlayer-project-review-v1",
    repository: snapshot.metadata,
    decision: judgment?.decision ?? ruleResult.decision,
    state,
    summary: judgment?.summary ?? ruleResult.summary,
    gate: ruleResult.gate,
    subjectiveQuestions: ruleResult.subjectiveQuestions,
    scores: mergedScores,
    evidence: evidenceResult.evidence,
    findings: ruleResult.findings,
    missingInformation: evidenceResult.missingInformation,
    manualVerificationQueue: evidenceResult.manualVerificationQueue,
    remediation: Array.from(
      new Set([
        ...ruleResult.remediation,
        ...(judgment?.required_actions ?? []),
      ]),
    ),
    sourceVerification: {
      repositoryUrl: snapshot.metadata.htmlUrl,
      defaultBranch: snapshot.metadata.defaultBranch,
      commitSha: snapshot.metadata.commitSha,
      fetchedAt: snapshot.fetchedAt,
      filesConsidered: snapshot.filesConsidered,
      filesRetrieved: snapshot.filesRetrieved,
      rateLimitRemaining: snapshot.rateLimitRemaining,
      limitations: snapshot.limitations,
    },
    genlayerRequest,
    genlayerResult,
    confidence,
    ranking,
    limitations: Array.from(
      new Set([
        ...snapshot.limitations,
        ...ruleResult.limitations,
        ...(genlayerResult.parserMessage ? [genlayerResult.parserMessage] : []),
      ]),
    ),
    generatedAt: new Date().toISOString(),
  });
}
