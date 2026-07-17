import { z } from "zod";
import {
  DecisionSchema,
  GenLayerExecutionResultSchema,
} from "@genforge/domain";

export const DisputeTypeSchema = z.enum([
  "procurement",
  "services",
  "logistics",
  "insurance",
  "employment",
  "legal_ops",
  "other",
]);

export const DisputeIntakeInputSchema = z.object({
  caseTitle: z.string().min(6),
  disputeType: DisputeTypeSchema,
  claimantName: z.string().min(2),
  respondentName: z.string().min(2),
  contractReference: z.string().min(3),
  claimSummary: z.string().min(30),
  respondentPosition: z.string().min(10),
  requestedRemedy: z.string().min(10),
  governingTerms: z.string().min(3).optional().or(z.literal("")),
  amountClaimed: z.string().optional().or(z.literal("")),
  filingDate: z.string().min(1),
  evidenceItems: z.array(z.string().min(3)).min(1),
});

export const DisputeEvidenceItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  classification: z.enum(["OBSERVED", "MISSING"]),
  summary: z.string().min(1),
});

export const DisputeIssueSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  action: z.string().min(1),
});

export const DisputeReadinessSchema = z.object({
  status: z.enum([
    "ready_for_adjudication",
    "needs_more_information",
    "blocked",
  ]),
  satisfiedRequirements: z.array(z.string().min(1)),
  missingRequirements: z.array(z.string().min(1)),
});

export const DisputeTimelineStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["completed", "active", "pending"]),
  summary: z.string().min(1),
});

export const DisputeOperatingModelSchema = z.object({
  internalOwner: z.string().min(1),
  counterpartyChannel: z.string().min(1),
  appealPath: z.string().min(1),
  settlementArtifacts: z.array(z.string().min(1)).min(1),
});

export const DisputeResolutionSchema = z.object({
  disposition: z.enum([
    "claim_upheld",
    "claim_partially_upheld",
    "claim_denied",
    "request_more_information",
  ]),
  liability_split: z.enum([
    "claimant",
    "respondent",
    "shared",
    "undetermined",
  ]),
  payable_adjustment: z.string().min(1),
  resolution_summary: z.string().min(1),
  reasoning: z.array(z.string().min(1)),
  required_actions: z.array(z.string().min(1)),
  manual_review_required: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const EnterpriseDisputeRequestSchema = z.object({
  caseId: z.string().min(1),
  program: z.literal("enterprise-dispute-adjudication-v1"),
  disputeType: DisputeTypeSchema,
  parties: z.object({
    claimant: z.string().min(1),
    respondent: z.string().min(1),
  }),
  contractReference: z.string().min(1),
  claimSummary: z.string().min(1),
  respondentPosition: z.string().min(1),
  requestedRemedy: z.string().min(1),
  governingTerms: z.string().optional(),
  amountClaimed: z.string().optional(),
  filingDate: z.string().min(1),
  evidenceSummary: z.array(z.object({
    evidenceId: z.string().min(1),
    classification: z.enum(["OBSERVED", "MISSING"]),
    summary: z.string().min(1),
  })),
  adjudicationQuestions: z.array(z.string().min(1)),
  requestLimits: z.object({
    maxEvidenceItems: z.number().int().positive(),
    maxQuestionCount: z.number().int().positive(),
    maxOutputChars: z.number().int().positive(),
  }),
});

export const EnterpriseDisputeReportSchema = z.object({
  caseId: z.string().min(1),
  caseTitle: z.string().min(1),
  disputeType: DisputeTypeSchema,
  decision: DecisionSchema,
  generatedAt: z.string().min(1),
  parties: z.object({
    claimant: z.string().min(1),
    respondent: z.string().min(1),
  }),
  summary: z.string().min(1),
  readiness: DisputeReadinessSchema,
  evidencePack: z.array(DisputeEvidenceItemSchema),
  issues: z.array(DisputeIssueSchema),
  workflowTimeline: z.array(DisputeTimelineStepSchema),
  operatingModel: DisputeOperatingModelSchema,
  adjudicationQuestions: z.array(z.string().min(1)),
  recommendedActions: z.array(z.string().min(1)),
  resolutionPlaybook: z.array(z.string().min(1)),
  boundedRequest: EnterpriseDisputeRequestSchema,
  genlayerResult: GenLayerExecutionResultSchema,
  latestResolution: DisputeResolutionSchema.nullable().optional(),
});

export const EnterpriseDisputeSuccessSchema = z.object({
  ok: z.literal(true),
  report: EnterpriseDisputeReportSchema,
});

export const EnterpriseDisputeErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(["INVALID_CASE_INPUT", "INTERNAL_ERROR"]),
    message: z.string().min(1),
    details: z.array(z.string().min(1)).default([]),
  }),
});

export const EnterpriseDisputeResponseSchema = z.union([
  EnterpriseDisputeSuccessSchema,
  EnterpriseDisputeErrorSchema,
]);

export type DisputeIntakeInput = z.infer<typeof DisputeIntakeInputSchema>;
export type DisputeType = z.infer<typeof DisputeTypeSchema>;
export type DisputeEvidenceItem = z.infer<typeof DisputeEvidenceItemSchema>;
export type DisputeIssue = z.infer<typeof DisputeIssueSchema>;
export type DisputeReadiness = z.infer<typeof DisputeReadinessSchema>;
export type DisputeTimelineStep = z.infer<typeof DisputeTimelineStepSchema>;
export type DisputeOperatingModel = z.infer<typeof DisputeOperatingModelSchema>;
export type DisputeResolution = z.infer<typeof DisputeResolutionSchema>;
export type EnterpriseDisputeRequest = z.infer<
  typeof EnterpriseDisputeRequestSchema
>;
export type EnterpriseDisputeReport = z.infer<
  typeof EnterpriseDisputeReportSchema
>;
export type EnterpriseDisputeResponse = z.infer<
  typeof EnterpriseDisputeResponseSchema
>;
