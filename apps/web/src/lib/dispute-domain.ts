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
  adjudicationQuestions: z.array(z.string().min(1)),
  recommendedActions: z.array(z.string().min(1)),
  boundedRequest: EnterpriseDisputeRequestSchema,
  genlayerResult: GenLayerExecutionResultSchema,
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
export type EnterpriseDisputeRequest = z.infer<
  typeof EnterpriseDisputeRequestSchema
>;
export type EnterpriseDisputeReport = z.infer<
  typeof EnterpriseDisputeReportSchema
>;
export type EnterpriseDisputeResponse = z.infer<
  typeof EnterpriseDisputeResponseSchema
>;
