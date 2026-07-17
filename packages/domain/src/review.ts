import { z } from "zod";

export const EvidenceClassificationSchema = z.enum([
  "OBSERVED",
  "INFERRED",
  "MISSING",
  "MANUAL_REVIEW_REQUIRED",
]);

export const DecisionSchema = z.enum([
  "REJECT",
  "REQUEST_MORE_INFO",
  "ACCEPT_FOR_SCORING",
]);

export const FindingSeveritySchema = z.enum(["low", "medium", "high"]);
export const FindingOutcomeSchema = z.enum([
  "triggered",
  "not_triggered",
  "manual_review_required",
]);
export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const ReviewErrorCodeSchema = z.enum([
  "INVALID_REPOSITORY_URL",
  "UNSUPPORTED_HOST",
  "REPOSITORY_NOT_FOUND",
  "RATE_LIMITED",
  "PRIVATE_REPOSITORY",
  "GITHUB_UNAVAILABLE",
  "RESPONSE_TOO_LARGE",
  "INTERNAL_ERROR",
]);

export const ReviewStateSchema = z.enum([
  "idle",
  "validating_url",
  "collecting_evidence",
  "applying_deterministic_rules",
  "waiting_for_genlayer_transaction",
  "consensus_pending",
  "partial_result",
  "rejected",
  "request_more_information",
  "accepted_for_scoring",
  "integration_unavailable",
  "rate_limited",
  "error",
]);

export const RepositoryFileSchema = z.object({
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  purpose: z.enum([
    "readme",
    "manifest",
    "lockfile",
    "contract_candidate",
    "frontend_candidate",
    "deployment_candidate",
    "configuration_candidate",
  ]),
  textExcerpt: z.string().optional(),
});

export const RepositoryTreeEntrySchema = z.object({
  path: z.string().min(1),
  type: z.enum(["blob", "tree"]),
  size: z.number().int().nonnegative().nullable(),
});

export const RepositorySnapshotSchema = z.object({
  metadata: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    defaultBranch: z.string().min(1),
    commitSha: z.string().min(7),
    description: z.string().nullable(),
    visibility: z.enum(["public", "private"]),
    stars: z.number().int().nonnegative(),
    htmlUrl: z.string().min(1),
  }),
  tree: z.array(RepositoryTreeEntrySchema),
  files: z.array(RepositoryFileSchema),
  fetchedAt: z.string().min(1),
  filesConsidered: z.number().int().nonnegative(),
  filesRetrieved: z.number().int().nonnegative(),
  rateLimitRemaining: z.number().int().nullable(),
  limitations: z.array(z.string().min(1)),
});

export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  classification: EvidenceClassificationSchema,
  sourceType: z.enum([
    "github_api",
    "repository_file",
    "heuristic",
    "rule_engine",
    "genlayer",
  ]),
  repositoryFileOrUrl: z.string().min(1),
  exactLocation: z.string().min(1),
  commitSha: z.string().min(1),
  summary: z.string().min(1),
  confidence: ConfidenceSchema,
  filePath: z.string().optional(),
  sourceUrl: z.string().optional(),
  observedValue: z.string().optional(),
  limitation: z.string().optional(),
  integrityHash: z.string().optional(),
});

export const FindingSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  title: z.string().min(1),
  severity: FindingSeveritySchema,
  outcome: FindingOutcomeSchema,
  classification: EvidenceClassificationSchema,
  confidence: ConfidenceSchema,
  summary: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  remediation: z.array(z.string().min(1)).min(1),
  manualVerification: z.array(z.string().min(1)).default([]),
});

export const MissingInformationItemSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  reason: z.string().min(1),
});

export const ManualVerificationItemSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
});

export const ScoreOverviewSchema = z.object({
  genLayerFit: z.number().min(0).max(5),
  contractQuality: z.number().min(0).max(5),
  engineering: z.number().min(0).max(5),
  frontendUx: z.number().min(0).max(5),
  evidenceConfidence: z.number().min(0).max(5),
  total: z.number().min(0).max(5),
});

export const DeterministicGateSchema = z.object({
  decision: DecisionSchema,
  passedRuleIds: z.array(z.string().min(1)),
  failedRuleIds: z.array(z.string().min(1)),
  missingRuleIds: z.array(z.string().min(1)),
});

export const SubjectiveQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  rationale: z.string().min(1),
});

export const SourceVerificationSchema = z.object({
  repositoryUrl: z.string().min(1),
  defaultBranch: z.string().min(1),
  commitSha: z.string().min(1),
  fetchedAt: z.string().min(1),
  filesConsidered: z.number().int().nonnegative(),
  filesRetrieved: z.number().int().nonnegative(),
  rateLimitRemaining: z.number().int().nullable(),
  limitations: z.array(z.string().min(1)),
});

export const RepositoryMetadataSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  defaultBranch: z.string().min(1),
  commitSha: z.string().min(1),
  description: z.string().nullable(),
  visibility: z.enum(["public", "private"]),
  stars: z.number().int().nonnegative(),
  htmlUrl: z.string().min(1),
});

export const CreateReviewInputSchema = z.object({
  repositoryUrl: z.string().min(1),
});

export const ReviewErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: ReviewErrorCodeSchema,
    message: z.string().min(1),
    details: z.array(z.string().min(1)).default([]),
  }),
});

export const ReviewSuccessSchema = z.object({
  ok: z.literal(true),
  report: z.lazy(() => ReviewReportSchema),
});

export const ReviewResponseSchema = z.union([
  ReviewSuccessSchema,
  ReviewErrorSchema,
]);

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type MissingInformationItem = z.infer<
  typeof MissingInformationItemSchema
>;
export type ManualVerificationItem = z.infer<
  typeof ManualVerificationItemSchema
>;
export type ScoreOverview = z.infer<typeof ScoreOverviewSchema>;
export type ReviewErrorCode = z.infer<typeof ReviewErrorCodeSchema>;
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
export type RepositoryFile = z.infer<typeof RepositoryFileSchema>;
export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>;
export type RepositoryTreeEntry = z.infer<typeof RepositoryTreeEntrySchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;
export type DeterministicGate = z.infer<typeof DeterministicGateSchema>;
export type SubjectiveQuestion = z.infer<typeof SubjectiveQuestionSchema>;

export const ReviewReportSchema = z.object({
  reviewId: z.string().min(1),
  submissionId: z.string().min(1),
  reviewKind: z.literal("GenLayer Project Review"),
  program: z.literal("genlayer-project-review-v1"),
  repository: RepositoryMetadataSchema,
  decision: DecisionSchema,
  state: ReviewStateSchema,
  summary: z.string().min(1),
  gate: DeterministicGateSchema,
  subjectiveQuestions: z.array(SubjectiveQuestionSchema),
  scores: ScoreOverviewSchema,
  evidence: z.array(EvidenceItemSchema),
  findings: z.array(FindingSchema),
  missingInformation: z.array(MissingInformationItemSchema),
  manualVerificationQueue: z.array(ManualVerificationItemSchema),
  remediation: z.array(z.string().min(1)),
  sourceVerification: SourceVerificationSchema,
  genlayerRequest: z.lazy(() => GenLayerReviewRequestSchema),
  genlayerResult: z.lazy(() => GenLayerExecutionResultSchema),
  confidence: z.lazy(() => ReviewConfidenceSchema),
  ranking: z.lazy(() => RankingResultSchema),
  limitations: z.array(z.string().min(1)),
  generatedAt: z.string().min(1),
});

export type ReviewReport = z.infer<typeof ReviewReportSchema>;

export const GenLayerExecutionStatusSchema = z.enum([
  "SKIPPED_BY_GATE",
  "GENLAYER_NOT_CONFIGURED",
  "GENLAYER_UNAVAILABLE",
  "TRANSACTION_REJECTED",
  "TRANSACTION_FAILED",
  "CONSENSUS_PENDING",
  "CONSENSUS_ACCEPTED",
  "CONSENSUS_REJECTED",
  "UNEXPECTED_RESULT",
]);

export const GenLayerReviewRepositorySchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  commitSha: z.string().min(1),
});

export const BoundedEvidenceSummaryItemSchema = z.object({
  evidenceId: z.string().min(1),
  classification: EvidenceClassificationSchema,
  summary: z.string().min(1),
  repositoryFileOrUrl: z.string().min(1),
});

export const RequestLimitsSchema = z.object({
  maxEvidenceItems: z.number().int().positive(),
  maxEvidenceChars: z.number().int().positive(),
  maxSubjectiveQuestions: z.number().int().positive(),
  maxOutputChars: z.number().int().positive(),
});

export const GenLayerReviewRequestSchema = z.object({
  submissionId: z.string().min(1),
  repository: GenLayerReviewRepositorySchema,
  program: z.literal("genlayer-project-review-v1"),
  gate: DeterministicGateSchema,
  evidenceSummary: z.array(BoundedEvidenceSummaryItemSchema),
  subjectiveQuestions: z.array(SubjectiveQuestionSchema),
  equivalencePrinciple: z.string().min(1),
  requestLimits: RequestLimitsSchema,
});

export const GenLayerJudgmentSchema = z.object({
  decision: DecisionSchema,
  scores: z.object({
    genlayer_fit: z.number().min(0).max(5),
    contract_quality: z.number().min(0).max(5),
    engineering: z.number().min(0).max(5),
    frontend_ux: z.number().min(0).max(5),
  }),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)),
  findings: z.array(z.string().min(1)),
  required_actions: z.array(z.string().min(1)),
  manual_review_required: z.boolean(),
});

export const GenLayerExecutionResultSchema = z.object({
  status: GenLayerExecutionStatusSchema,
  network: z.string().min(1).optional(),
  contractAddress: z.string().min(1).optional(),
  transactionHash: z.string().min(1).optional(),
  receiptStatus: z.string().min(1).optional(),
  errorClassification: z.string().min(1).optional(),
  parserMessage: z.string().min(1).optional(),
  judgment: GenLayerJudgmentSchema.nullable(),
});

export const ConfidenceFactorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  effect: z.number().min(-1).max(1),
  summary: z.string().min(1),
});

export const ReviewConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  level: ConfidenceSchema,
  factors: z.array(ConfidenceFactorSchema),
});

export const RankingResultSchema = z.object({
  eligible: z.boolean(),
  position: z.number().int().positive().nullable(),
  comparedSubmissionIds: z.array(z.string().min(1)),
  rationale: z.string().min(1),
});

export type GenLayerExecutionStatus = z.infer<
  typeof GenLayerExecutionStatusSchema
>;
export type GenLayerReviewRequest = z.infer<typeof GenLayerReviewRequestSchema>;
export type GenLayerJudgment = z.infer<typeof GenLayerJudgmentSchema>;
export type GenLayerExecutionResult = z.infer<
  typeof GenLayerExecutionResultSchema
>;
export type ConfidenceFactor = z.infer<typeof ConfidenceFactorSchema>;
export type ReviewConfidence = z.infer<typeof ReviewConfidenceSchema>;
export type RankingResult = z.infer<typeof RankingResultSchema>;
