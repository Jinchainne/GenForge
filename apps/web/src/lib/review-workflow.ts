import type { GenLayerExecutionResult, ReviewReport } from "@genforge/domain";

export interface FixChecklistItem {
  id: string;
  severity: "high" | "medium" | "low";
  ruleId: string;
  title: string;
  summary: string;
  actions: string[];
  manualChecks: string[];
}

export interface WalletConnectionState {
  status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "missing_provider"
    | "error";
  address?: string;
  network?: string;
  message?: string;
}

export interface OnchainWorkflowState {
  status:
    | "idle"
    | "submitting"
    | "tracking"
    | "finalized"
    | "failed"
    | "blocked";
  message: string;
  walletAddress?: string;
  result?: GenLayerExecutionResult;
  updatedAt?: string;
}

export interface ReviewAttempt {
  id: string;
  repositoryUrl: string;
  report: ReviewReport;
  reviewedAt: string;
  onchain: OnchainWorkflowState;
}

function severityWeight(severity: FixChecklistItem["severity"]): number {
  if (severity === "high") {
    return 0;
  }
  if (severity === "medium") {
    return 1;
  }
  return 2;
}

export function buildFixChecklist(report: ReviewReport): FixChecklistItem[] {
  return [...report.findings]
    .sort((left, right) => {
      const bySeverity =
        severityWeight(left.severity) - severityWeight(right.severity);
      if (bySeverity !== 0) {
        return bySeverity;
      }
      return left.ruleId.localeCompare(right.ruleId);
    })
    .map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      ruleId: finding.ruleId,
      title: finding.title,
      summary: finding.summary,
      actions: finding.remediation,
      manualChecks: finding.manualVerification,
    }));
}

export function canRequestOnchainAdjudication(report: ReviewReport): boolean {
  return report.decision === "ACCEPT_FOR_SCORING";
}

export function deriveOnchainWorkflowState(
  result: GenLayerExecutionResult,
  walletAddress?: string,
): OnchainWorkflowState {
  const updatedAt = new Date().toISOString();

  if (result.status === "CONSENSUS_ACCEPTED") {
    return {
      status: "finalized",
      message: "Validator consensus accepted the review request.",
      walletAddress,
      result,
      updatedAt,
    };
  }

  if (result.status === "CONSENSUS_REJECTED") {
    return {
      status: "finalized",
      message: "Validator consensus finalized with a rejection judgment.",
      walletAddress,
      result,
      updatedAt,
    };
  }

  if (result.status === "CONSENSUS_PENDING") {
    return {
      status: "tracking",
      message:
        result.parserMessage ??
        "The transaction was accepted, but final validator agreement is still pending.",
      walletAddress,
      result,
      updatedAt,
    };
  }

  if (result.status === "SKIPPED_BY_GATE") {
    return {
      status: "blocked",
      message:
        result.parserMessage ??
        "Deterministic gate issues must be fixed before on-chain adjudication.",
      walletAddress,
      result,
      updatedAt,
    };
  }

  return {
    status: "failed",
    message:
      result.parserMessage ??
      "GenLayer submission did not complete successfully.",
    walletAddress,
    result,
    updatedAt,
  };
}

export function applyLiveGenLayerResult(
  report: ReviewReport,
  result: GenLayerExecutionResult,
): ReviewReport {
  const nextState =
    result.status === "CONSENSUS_PENDING"
      ? "consensus_pending"
      : result.status === "CONSENSUS_ACCEPTED" ||
          result.status === "CONSENSUS_REJECTED"
        ? "accepted_for_scoring"
        : result.status === "SKIPPED_BY_GATE"
          ? report.state
          : "integration_unavailable";

  const nextSummary =
    result.judgment?.summary ??
    result.parserMessage ??
    report.summary;

  return {
    ...report,
    state: nextState,
    summary: nextSummary,
    genlayerResult: result,
  };
}
