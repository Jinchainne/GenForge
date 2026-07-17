import { describe, expect, it } from "vitest";
import type { ReviewTrajectory, ReviewTrajectoryEvent } from "@genforge/domain";
import { buildRepositoryEvidence } from "@genforge/evidence";
import { generateReviewReport } from "@genforge/reports";
import {
  evaluatePreliminaryRules,
  evaluateReviewExecution,
} from "@genforge/rules";
import { likelyGenLayerSnapshot } from "./fixtures/github";

function createBaseReport() {
  const evidenceResult = buildRepositoryEvidence(likelyGenLayerSnapshot);
  const ruleResult = evaluatePreliminaryRules(evidenceResult);
  const report = generateReviewReport({
    snapshot: likelyGenLayerSnapshot,
    evidenceResult,
    ruleResult,
  });

  return { evidenceResult, report };
}

function event(
  id: string,
  kind: ReviewTrajectoryEvent["kind"],
  stage: ReviewTrajectoryEvent["stage"],
  payload: Record<string, unknown> = {},
): ReviewTrajectoryEvent {
  const numericId = Number.parseInt(id.replace(/\D/g, ""), 10) || 0;
  return {
    id,
    at: new Date(
      Date.UTC(2026, 6, 17, 0, 0, Math.min(numericId, 59)),
    ).toISOString(),
    kind,
    stage,
    actor: kind === "rule_evaluated" ? "rule_engine" : "agent",
    payload,
    evidenceIds: [],
  };
}

function createHappyTrajectory(): ReviewTrajectory {
  return {
    reviewId: "review-1",
    submissionId: "submission-1",
    events: [
      event("01", "stage_entered", "intake"),
      event("02", "stage_completed", "intake"),
      event("03", "stage_entered", "repository_fetch"),
      event("04", "tool_called", "repository_fetch", { url: "repo" }),
      event("05", "tool_succeeded", "repository_fetch", { url: "repo" }),
      event("06", "stage_completed", "repository_fetch"),
      event("07", "stage_entered", "evidence_build"),
      event("08", "stage_completed", "evidence_build"),
      event("09", "stage_entered", "mandatory_checks"),
      event("10", "rule_evaluated", "mandatory_checks", {
        outcome: "triggered",
        ruleId: "GL-GATE-001",
      }),
      event("11", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-GATE-002",
      }),
      event("12", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-GATE-006",
      }),
      event("13", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-GATE-007",
      }),
      event("14", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-CON-003",
      }),
      event("15", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-FE-001",
      }),
      event("16", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-FE-002",
      }),
      event("17", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-FE-005",
      }),
      event("18", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-ENG-001",
      }),
      event("19", "rule_evaluated", "mandatory_checks", {
        outcome: "not_triggered",
        ruleId: "GL-ENG-002",
      }),
      event("20", "stage_completed", "mandatory_checks"),
      event("21", "stage_entered", "manual_review_gate"),
      event("22", "stage_completed", "manual_review_gate"),
      event("23", "stage_entered", "decision_gate"),
      event("24", "decision_made", "decision_gate", {
        decision: "ACCEPT_FOR_SCORING",
      }),
      event("25", "stage_completed", "decision_gate"),
      event("26", "stage_entered", "scoring"),
      event("27", "score_computed", "scoring", { total: 4.2 }),
      event("28", "stage_completed", "scoring"),
      event("29", "stage_entered", "reporting"),
      event("30", "report_emitted", "reporting"),
      event("31", "stage_completed", "reporting"),
    ].map((item) =>
      item.kind === "rule_evaluated" && "ruleId" in item.payload
        ? { ...item, ruleId: item.payload.ruleId as string }
        : item,
    ),
  };
}

describe("trajectory evaluation", () => {
  it("flags skipped mandatory checks and premature scoring", () => {
    const { report } = createBaseReport();
    const trajectory = createHappyTrajectory();
    trajectory.events = trajectory.events.filter(
      (item) => item.ruleId !== "GL-FE-002",
    );
    trajectory.events.splice(
      10,
      0,
      event("10b", "score_computed", "scoring", { total: 2.5 }),
    );

    const verdict = evaluateReviewExecution({
      trajectory,
      report,
    });

    expect(
      verdict.issues.some((item) => item.code === "SKIPPED_MANDATORY_CHECK"),
    ).toBe(true);
    expect(
      verdict.issues.some((item) => item.code === "PREMATURE_SCORING"),
    ).toBe(true);
    expect(verdict.passed).toBe(false);
  });

  it("flags repeated and fake-success tool paths", () => {
    const { report } = createBaseReport();
    const trajectory = createHappyTrajectory();
    trajectory.events.splice(
      4,
      0,
      {
        ...event("04b", "tool_called", "repository_fetch", { url: "repo" }),
        toolName: "fetch_repository",
      },
      {
        ...event("04c", "tool_called", "repository_fetch", { url: "repo" }),
        toolName: "fetch_repository",
        parentEventId: "04b",
      },
      {
        ...event("04d", "tool_failed", "repository_fetch", { url: "repo" }),
        toolName: "fetch_repository",
      },
    );
    trajectory.events = trajectory.events.map((item) =>
      item.id === "04"
        ? { ...item, toolName: "fetch_repository" }
        : item.id === "05"
          ? { ...item, toolName: "inspect_repository" }
          : item,
    );

    const verdict = evaluateReviewExecution({
      trajectory,
      report,
    });

    expect(
      verdict.issues.some((item) => item.code === "REPEATED_TOOL_CALL"),
    ).toBe(true);
    expect(
      verdict.issues.some((item) => item.code === "CIRCULAR_TOOL_PATH"),
    ).toBe(true);
    expect(
      verdict.issues.some((item) => item.code === "FAKE_SUCCESS_PATH"),
    ).toBe(true);
  });
});
