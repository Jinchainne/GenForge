import {
  ReviewEvaluationReportSchema,
  type EvaluationPlan,
  type ReviewEvaluationReport,
  type ReviewEvaluationVerdict,
  type ReviewReport,
  type ReviewTrajectory,
} from "@genforge/domain";

export interface GenerateEvaluationReportInput {
  plan: EvaluationPlan;
  trajectory: ReviewTrajectory;
  report: ReviewReport;
  verdict: ReviewEvaluationVerdict;
}

export function generateEvaluationReport(
  input: GenerateEvaluationReportInput,
): ReviewEvaluationReport {
  return ReviewEvaluationReportSchema.parse(input);
}
