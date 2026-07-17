import type {
  EvaluationIssue,
  EvaluationPlan,
  EvidenceItem,
  EvidenceLink,
  ReviewReport,
  ReviewTrajectory,
} from "@genforge/domain";

type Decision = ReviewReport["decision"];

function issue(partial: EvaluationIssue): EvaluationIssue {
  return partial;
}

function hasContradictoryEvidence(
  links: EvidenceLink[],
  targetId: string,
  supports: EvidenceLink["supports"],
): boolean {
  return links.some(
    (link) =>
      link.targetId === targetId &&
      link.supports === supports &&
      link.strength === "contradictory",
  );
}

function linkedEvidenceFor(
  links: EvidenceLink[],
  targetId: string,
  supports: EvidenceLink["supports"],
): EvidenceLink[] {
  return links.filter(
    (link) => link.targetId === targetId && link.supports === supports,
  );
}

function deriveDeterministicDecision(
  report: ReviewReport,
  trajectory: ReviewTrajectory,
): Decision {
  if (
    report.findings.some((finding) => finding.severity === "high") &&
    report.findings.some((finding) => finding.outcome === "triggered")
  ) {
    return "REJECT";
  }

  const requiresManualReview =
    report.manualVerificationQueue.length > 0 ||
    report.findings.some(
      (finding) =>
        finding.outcome === "manual_review_required" ||
        finding.classification === "MANUAL_REVIEW_REQUIRED",
    ) ||
    report.evidence.some(
      (item) => item.classification === "MANUAL_REVIEW_REQUIRED",
    );

  if (requiresManualReview) {
    return "REQUEST_MORE_INFO";
  }

  const rejectedByTrajectory = trajectory.events.some(
    (event) =>
      event.kind === "decision_made" && event.payload.decision === "REJECT",
  );

  if (rejectedByTrajectory) {
    return "REJECT";
  }

  return "ACCEPT_FOR_SCORING";
}

export interface OutcomeEvaluationInput {
  report: ReviewReport;
  trajectory: ReviewTrajectory;
  evidence: EvidenceItem[];
  evidenceLinks: EvidenceLink[];
  plan: EvaluationPlan;
}

export interface OutcomeEvaluationResult {
  issues: EvaluationIssue[];
  deterministicDecision: Decision;
}

export function evaluateOutcomeChecks(
  input: OutcomeEvaluationInput,
): OutcomeEvaluationResult {
  const { report, trajectory, evidence, evidenceLinks, plan } = input;
  const issues: EvaluationIssue[] = [];
  const evidenceIds = new Set(evidence.map((item) => item.id));

  for (const finding of report.findings) {
    const hasEvidenceIds = finding.evidenceIds.every((id) => evidenceIds.has(id));
    if (!hasEvidenceIds || finding.evidenceIds.length === 0) {
      issues.push(
        issue({
          code: "FINDING_WITHOUT_EVIDENCE",
          severity: "high",
          summary: `Finding "${finding.id}" does not reference valid evidence.`,
          eventIds: [],
          evidenceIds: finding.evidenceIds,
          ruleIds: [finding.ruleId],
        }),
      );
    }

    const ruleLinks = linkedEvidenceFor(evidenceLinks, finding.ruleId, "rule");
    const findingLinks = linkedEvidenceFor(
      evidenceLinks,
      finding.id,
      "finding",
    );

    if (ruleLinks.length === 0 || findingLinks.length === 0) {
      issues.push(
        issue({
          code: "UNSUPPORTED_CONCLUSION",
          severity: "high",
          summary: `Finding "${finding.id}" is not supported by linked evidence.`,
          eventIds: [],
          evidenceIds: finding.evidenceIds,
          ruleIds: [finding.ruleId],
        }),
      );
    }

    if (
      hasContradictoryEvidence(evidenceLinks, finding.ruleId, "rule") ||
      hasContradictoryEvidence(evidenceLinks, finding.id, "finding")
    ) {
      issues.push(
        issue({
          code: "EVIDENCE_RULE_MISMATCH",
          severity: "high",
          summary: `Linked evidence contradicts the rule or finding for "${finding.id}".`,
          eventIds: [],
          evidenceIds: finding.evidenceIds,
          ruleIds: [finding.ruleId],
        }),
      );
    }
  }

  const deterministicDecision = deriveDeterministicDecision(report, trajectory);

  if (report.decision === "REJECT" && report.scores.total > 0) {
    issues.push(
      issue({
        code: "SCORED_REJECTED_SUBMISSION",
        severity: "high",
        summary: "A rejected submission received non-zero scoring output.",
        eventIds: trajectory.events
          .filter((event) => event.kind === "score_computed")
          .map((event) => event.id),
        evidenceIds: [],
        ruleIds: [],
      }),
    );
  }

  const manualReviewExpected = deterministicDecision === "REQUEST_MORE_INFO";
  if (manualReviewExpected && report.manualVerificationQueue.length === 0) {
    issues.push(
      issue({
        code: "MISSING_MANUAL_REVIEW_ESCALATION",
        severity: "high",
        summary:
          "Deterministic review signals require manual review, but no manual-review escalation was recorded.",
        eventIds: trajectory.events
          .filter((event) => event.kind === "manual_review_requested")
          .map((event) => event.id),
        evidenceIds: report.evidence
          .filter((item) => item.classification === "MANUAL_REVIEW_REQUIRED")
          .map((item) => item.id),
        ruleIds: report.findings
          .filter((finding) => finding.outcome === "manual_review_required")
          .map((finding) => finding.ruleId),
      }),
    );
  }

  const scoringAllowed = plan.scoringAllowedDecisions.includes(report.decision);
  if (!scoringAllowed && trajectory.events.some((event) => event.kind === "score_computed")) {
    issues.push(
      issue({
        code: "SCORED_REJECTED_SUBMISSION",
        severity: "high",
        summary:
          "The review trajectory computed scores even though the final decision was not eligible for scoring.",
        eventIds: trajectory.events
          .filter((event) => event.kind === "score_computed")
          .map((event) => event.id),
        evidenceIds: [],
        ruleIds: [],
      }),
    );
  }

  if (report.decision !== deterministicDecision) {
    issues.push(
      issue({
        code: "DETERMINISTIC_JUDGMENT_DISAGREEMENT",
        severity: "high",
        summary: `Agent judgment "${report.decision}" disagrees with deterministic decision "${deterministicDecision}".`,
        eventIds: trajectory.events
          .filter((event) => event.kind === "decision_made")
          .map((event) => event.id),
        evidenceIds: [],
        ruleIds: [],
      }),
    );
  }

  return {
    issues,
    deterministicDecision,
  };
}
