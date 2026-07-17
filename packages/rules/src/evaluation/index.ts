import type {
  EvaluationPlan,
  EvidenceItem,
  EvidenceLink,
  ReviewEvaluationVerdict,
  ReviewReport,
  ReviewTrajectory,
} from "@genforge/domain";
import { createDefaultEvaluationPlan } from "./plan";
import { evaluateTrajectoryChecks } from "./trajectory-checks";
import { evaluateOutcomeChecks } from "./outcome-checks";
import { buildEvaluationScorecard, buildEvaluationVerdict } from "./conflicts";

export interface ReviewExecutionEvaluationInput {
  trajectory: ReviewTrajectory;
  report: ReviewReport;
  evidence?: EvidenceItem[];
  evidenceLinks?: EvidenceLink[];
  plan?: EvaluationPlan;
}

export function evaluateReviewExecution(
  input: ReviewExecutionEvaluationInput,
): ReviewEvaluationVerdict {
  const plan = input.plan ?? createDefaultEvaluationPlan();
  const evidence = input.evidence ?? input.report.evidence;
  const evidenceLinks = input.evidenceLinks ?? [];

  const trajectoryResult = evaluateTrajectoryChecks(input.trajectory, plan);
  const outcomeResult = evaluateOutcomeChecks({
    report: input.report,
    trajectory: input.trajectory,
    evidence,
    evidenceLinks,
    plan,
  });

  const scorecard = buildEvaluationScorecard(
    trajectoryResult.issues,
    outcomeResult.issues,
    input.report.decision === outcomeResult.deterministicDecision,
  );

  return buildEvaluationVerdict({
    evaluatorVersion: plan.version,
    issues: [...trajectoryResult.issues, ...outcomeResult.issues],
    scorecard,
    deterministicDecision: outcomeResult.deterministicDecision,
  });
}

export * from "./plan";
export * from "./trajectory-checks";
export * from "./outcome-checks";
export * from "./conflicts";
