import type {
  EvaluationIssue,
  EvaluationScorecard,
  ReviewEvaluationVerdict,
} from "@genforge/domain";

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildEvaluationScorecard(
  trajectoryIssues: EvaluationIssue[],
  outcomeIssues: EvaluationIssue[],
  deterministicDecisionMatches: boolean,
): EvaluationScorecard {
  const trajectoryPenalty = trajectoryIssues.reduce(
    (total, current) => total + (current.severity === "high" ? 0.2 : 0.1),
    0,
  );
  const outcomePenalty = outcomeIssues.reduce(
    (total, current) => total + (current.severity === "high" ? 0.25 : 0.1),
    0,
  );

  const trajectoryIntegrity = clampScore(1 - trajectoryPenalty);
  const outcomeIntegrity = clampScore(1 - outcomePenalty);
  const agreementScore = deterministicDecisionMatches ? 1 : 0;
  const gatePassed = ![...trajectoryIssues, ...outcomeIssues].some(
    (item) => item.severity === "high",
  );

  return {
    passed:
      gatePassed &&
      trajectoryIntegrity >= 0.6 &&
      outcomeIntegrity >= 0.6 &&
      agreementScore >= 1,
    gatePassed,
    trajectoryIntegrity,
    outcomeIntegrity,
    agreementScore,
  };
}

export function buildEvaluationSummary(
  issues: EvaluationIssue[],
  passed: boolean,
): string {
  if (passed) {
    return "The review outcome and trajectory satisfy the current deterministic GenForge evaluation gates.";
  }

  const highSeverityCount = issues.filter(
    (item) => item.severity === "high",
  ).length;
  return `The review failed deterministic evaluation with ${highSeverityCount} high-severity issue(s) across trajectory and outcome checks.`;
}

export function buildEvaluationVerdict(input: {
  evaluatorVersion: string;
  issues: EvaluationIssue[];
  scorecard: EvaluationScorecard;
  deterministicDecision: ReviewEvaluationVerdict["deterministicDecision"];
}): ReviewEvaluationVerdict {
  return {
    evaluatorVersion: input.evaluatorVersion,
    passed: input.scorecard.passed,
    issues: input.issues,
    scorecard: input.scorecard,
    summary: buildEvaluationSummary(input.issues, input.scorecard.passed),
    deterministicDecision: input.deterministicDecision,
  };
}
