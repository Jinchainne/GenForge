import { z } from "zod";

export const ReviewStageSchema = z.enum([
  "intake",
  "repository_fetch",
  "evidence_build",
  "mandatory_checks",
  "manual_review_gate",
  "decision_gate",
  "scoring",
  "reporting",
]);

export const ReviewEventKindSchema = z.enum([
  "stage_entered",
  "stage_completed",
  "tool_called",
  "tool_succeeded",
  "tool_failed",
  "rule_evaluated",
  "finding_drafted",
  "finding_revised",
  "manual_review_requested",
  "decision_made",
  "score_computed",
  "report_emitted",
]);

export const ReviewActorSchema = z.enum(["agent", "system", "rule_engine"]);

export const ReviewTrajectoryEventSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  kind: ReviewEventKindSchema,
  stage: ReviewStageSchema,
  actor: ReviewActorSchema,
  toolName: z.string().min(1).optional(),
  ruleId: z.string().min(1).optional(),
  findingId: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
  evidenceIds: z.array(z.string().min(1)).default([]),
  parentEventId: z.string().min(1).optional(),
});

export const ReviewTrajectorySchema = z.object({
  reviewId: z.string().min(1),
  submissionId: z.string().min(1),
  events: z.array(ReviewTrajectoryEventSchema),
});

export type ReviewStage = z.infer<typeof ReviewStageSchema>;
export type ReviewEventKind = z.infer<typeof ReviewEventKindSchema>;
export type ReviewActor = z.infer<typeof ReviewActorSchema>;
export type ReviewTrajectoryEvent = z.infer<typeof ReviewTrajectoryEventSchema>;
export type ReviewTrajectory = z.infer<typeof ReviewTrajectorySchema>;
