import { z } from "zod";
import { DecisionSchema, ReviewReportSchema } from "./review";
import { ReviewStageSchema, ReviewTrajectorySchema } from "./trajectory";

export const EvaluationSeveritySchema = z.enum(["low", "medium", "high"]);

export const EvaluationIssueCodeSchema = z.enum([
  "SKIPPED_MANDATORY_CHECK",
  "CHECK_ORDER_VIOLATION",
  "UNSUPPORTED_CONCLUSION",
  "FINDING_WITHOUT_EVIDENCE",
  "EVIDENCE_RULE_MISMATCH",
  "REPEATED_TOOL_CALL",
  "CIRCULAR_TOOL_PATH",
  "FAKE_SUCCESS_PATH",
  "PREMATURE_SCORING",
  "SCORED_REJECTED_SUBMISSION",
  "MISSING_MANUAL_REVIEW_ESCALATION",
  "DETERMINISTIC_JUDGMENT_DISAGREEMENT",
]);

export const EvidenceLinkStrengthSchema = z.enum([
  "direct",
  "indirect",
  "contradictory",
]);

export const EvidenceLinkTargetSchema = z.enum([
  "rule",
  "finding",
  "decision",
  "score",
]);

export const EvidenceLinkSchema = z.object({
  evidenceId: z.string().min(1),
  supports: EvidenceLinkTargetSchema,
  targetId: z.string().min(1),
  strength: EvidenceLinkStrengthSchema,
});

export const MandatoryCheckDefinitionSchema = z.object({
  id: z.string().min(1),
  stage: ReviewStageSchema,
  requiredRuleId: z.string().min(1).optional(),
  requiredEventKind: z
    .enum(["rule_evaluated", "manual_review_requested", "decision_made"])
    .default("rule_evaluated"),
  mustOccurAfter: z.array(ReviewStageSchema).default([]),
  mustOccurBefore: z.array(ReviewStageSchema).default([]),
  blocksScoringUntilComplete: z.boolean().default(true),
});

export const EvaluationPlanSchema = z.object({
  version: z.string().min(1),
  requiredStages: z.array(ReviewStageSchema).min(1),
  mandatoryChecks: z.array(MandatoryCheckDefinitionSchema),
  scoringRequiresStages: z
    .array(ReviewStageSchema)
    .default(["mandatory_checks", "manual_review_gate", "decision_gate"]),
  scoringAllowedDecisions: z
    .array(DecisionSchema)
    .default(["ACCEPT_FOR_SCORING"]),
});

export const EvaluationIssueSchema = z.object({
  code: EvaluationIssueCodeSchema,
  severity: EvaluationSeveritySchema,
  summary: z.string().min(1),
  eventIds: z.array(z.string().min(1)).default([]),
  evidenceIds: z.array(z.string().min(1)).default([]),
  ruleIds: z.array(z.string().min(1)).default([]),
  reasoning: z.string().optional(),
});

export const EvaluationScorecardSchema = z.object({
  passed: z.boolean(),
  gatePassed: z.boolean(),
  trajectoryIntegrity: z.number().min(0).max(1),
  outcomeIntegrity: z.number().min(0).max(1),
  agreementScore: z.number().min(0).max(1),
});

export const ReviewEvaluationVerdictSchema = z.object({
  evaluatorVersion: z.string().min(1),
  passed: z.boolean(),
  issues: z.array(EvaluationIssueSchema),
  scorecard: EvaluationScorecardSchema,
  summary: z.string().min(1),
  deterministicDecision: DecisionSchema,
});

export const ReviewEvaluationReportSchema = z.object({
  plan: EvaluationPlanSchema,
  trajectory: ReviewTrajectorySchema,
  report: ReviewReportSchema,
  verdict: ReviewEvaluationVerdictSchema,
});

export type EvaluationIssueCode = z.infer<typeof EvaluationIssueCodeSchema>;
export type EvaluationSeverity = z.infer<typeof EvaluationSeveritySchema>;
export type EvidenceLinkStrength = z.infer<typeof EvidenceLinkStrengthSchema>;
export type EvidenceLinkTarget = z.infer<typeof EvidenceLinkTargetSchema>;
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;
export type MandatoryCheckDefinition = z.infer<
  typeof MandatoryCheckDefinitionSchema
>;
export type EvaluationPlan = z.infer<typeof EvaluationPlanSchema>;
export type EvaluationIssue = z.infer<typeof EvaluationIssueSchema>;
export type EvaluationScorecard = z.infer<typeof EvaluationScorecardSchema>;
export type ReviewEvaluationVerdict = z.infer<
  typeof ReviewEvaluationVerdictSchema
>;
export type ReviewEvaluationReport = z.infer<
  typeof ReviewEvaluationReportSchema
>;
