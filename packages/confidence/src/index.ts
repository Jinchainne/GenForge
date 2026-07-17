import type {
  EvidenceItem,
  GenLayerExecutionResult,
  ReviewConfidence,
} from "@genforge/domain";
import { ReviewConfidenceSchema } from "@genforge/domain";

export interface ConfidenceInput {
  evidence: EvidenceItem[];
  missingInformationCount: number;
  manualVerificationCount: number;
  genlayerResult: GenLayerExecutionResult;
  deterministicDecision: "REJECT" | "REQUEST_MORE_INFO" | "ACCEPT_FOR_SCORING";
}

export function calculateReviewConfidence(
  input: ConfidenceInput,
): ReviewConfidence {
  let score = 0.82;
  const factors: ReviewConfidence["factors"] = [];

  const inferredCount = input.evidence.filter(
    (item) => item.classification === "INFERRED",
  ).length;
  const missingCount = input.evidence.filter(
    (item) => item.classification === "MISSING",
  ).length;

  if (inferredCount > 0) {
    const effect = Math.min(0.18, inferredCount * 0.03);
    score -= effect;
    factors.push({
      id: "heuristic-evidence",
      label: "Heuristic evidence",
      effect: -effect,
      summary: `${inferredCount} evidence item(s) rely on heuristics rather than direct proof.`,
    });
  }

  if (missingCount > 0 || input.missingInformationCount > 0) {
    const effect = Math.min(
      0.2,
      (missingCount + input.missingInformationCount) * 0.04,
    );
    score -= effect;
    factors.push({
      id: "missing-evidence",
      label: "Missing evidence",
      effect: -effect,
      summary:
        "Missing source, deployment, or verification evidence reduces deterministic confidence.",
    });
  }

  if (input.manualVerificationCount > 0) {
    const effect = Math.min(0.18, input.manualVerificationCount * 0.04);
    score -= effect;
    factors.push({
      id: "manual-verification",
      label: "Manual verification queue",
      effect: -effect,
      summary:
        "Studio, Explorer, wallet, or receipt verification is still pending manual review.",
    });
  }

  if (
    input.genlayerResult.status === "GENLAYER_NOT_CONFIGURED" ||
    input.genlayerResult.status === "GENLAYER_UNAVAILABLE"
  ) {
    score -= 0.2;
    factors.push({
      id: "genlayer-unavailable",
      label: "GenLayer unavailable",
      effect: -0.2,
      summary:
        "The GenLayer client could not submit or verify a real consensus judgment.",
    });
  }

  if (
    input.genlayerResult.status === "CONSENSUS_ACCEPTED" &&
    input.genlayerResult.judgment &&
    input.genlayerResult.judgment.decision !== input.deterministicDecision
  ) {
    score -= 0.16;
    factors.push({
      id: "decision-disagreement",
      label: "Decision disagreement",
      effect: -0.16,
      summary:
        "The GenLayer judgment disagreed with the deterministic gate decision and lowered confidence.",
    });
  }

  if (input.genlayerResult.status === "CONSENSUS_ACCEPTED") {
    score += 0.06;
    factors.push({
      id: "consensus-accepted",
      label: "Consensus accepted",
      effect: 0.06,
      summary: "A parsed GenLayer judgment was accepted and incorporated.",
    });
  }

  const normalizedScore = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const level =
    normalizedScore >= 0.75
      ? "high"
      : normalizedScore >= 0.45
        ? "medium"
        : "low";

  return ReviewConfidenceSchema.parse({
    score: normalizedScore,
    level,
    factors,
  });
}
