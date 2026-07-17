import type {
  DeterministicGate,
  EvidenceItem,
  GenLayerReviewRequest,
  RankingResult,
  RepositorySnapshot,
  ReviewReport,
  SubjectiveQuestion,
} from "@genforge/domain";
import {
  GenLayerReviewRequestSchema,
  RankingResultSchema,
} from "@genforge/domain";

const REQUEST_LIMITS = {
  maxEvidenceItems: 10,
  maxEvidenceChars: 220,
  maxSubjectiveQuestions: 3,
  maxOutputChars: 1800,
};

function bounded(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

export function buildGenLayerJudgingRequest(input: {
  submissionId: string;
  snapshot: RepositorySnapshot;
  gate: DeterministicGate;
  evidence: EvidenceItem[];
  subjectiveQuestions: SubjectiveQuestion[];
}): GenLayerReviewRequest {
  return GenLayerReviewRequestSchema.parse({
    submissionId: input.submissionId,
    repository: {
      owner: input.snapshot.metadata.owner,
      name: input.snapshot.metadata.repo,
      commitSha: input.snapshot.metadata.commitSha,
    },
    program: "genlayer-project-review-v1",
    gate: input.gate,
    evidenceSummary: input.evidence
      .slice(0, REQUEST_LIMITS.maxEvidenceItems)
      .map((item) => ({
        evidenceId: item.id,
        classification: item.classification,
        summary: bounded(item.summary, REQUEST_LIMITS.maxEvidenceChars),
        repositoryFileOrUrl: item.repositoryFileOrUrl,
      })),
    subjectiveQuestions: input.subjectiveQuestions.slice(
      0,
      REQUEST_LIMITS.maxSubjectiveQuestions,
    ),
    equivalencePrinciple:
      "Use normalized structured output with substantive validator checks over gate adherence, evidence grounding, rubric consistency, and unsupported claims rather than strict text equality.",
    requestLimits: REQUEST_LIMITS,
  });
}

export function rankAcceptedSubmission(
  report: Pick<
    ReviewReport,
    "submissionId" | "decision" | "scores" | "confidence"
  >,
): RankingResult {
  const eligible = report.decision === "ACCEPT_FOR_SCORING";
  return RankingResultSchema.parse({
    eligible,
    position: eligible ? 1 : null,
    comparedSubmissionIds: eligible ? [report.submissionId] : [],
    rationale: eligible
      ? `Single-submission ranking based on total score ${report.scores.total.toFixed(1)} and confidence ${report.confidence.score.toFixed(2)}.`
      : "Rejected or incomplete submissions are not ranked.",
  });
}
