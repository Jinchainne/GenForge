import type {
  EvaluationIssue,
  EvaluationPlan,
  ReviewStage,
  ReviewTrajectory,
  ReviewTrajectoryEvent,
} from "@genforge/domain";

const stageOrder: ReviewStage[] = [
  "intake",
  "repository_fetch",
  "evidence_build",
  "mandatory_checks",
  "manual_review_gate",
  "decision_gate",
  "scoring",
  "reporting",
];

function issue(partial: EvaluationIssue): EvaluationIssue {
  return partial;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${key}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function firstEventIndex(
  events: ReviewTrajectoryEvent[],
  predicate: (event: ReviewTrajectoryEvent) => boolean,
): number {
  return events.findIndex(predicate);
}

function completedStageIndices(
  trajectory: ReviewTrajectory,
): Map<ReviewStage, number> {
  const indices = new Map<ReviewStage, number>();
  trajectory.events.forEach((event, index) => {
    if (event.kind === "stage_completed" && !indices.has(event.stage)) {
      indices.set(event.stage, index);
    }
  });
  return indices;
}

export interface TrajectoryCheckResult {
  issues: EvaluationIssue[];
  completedStages: Map<ReviewStage, number>;
}

export function evaluateTrajectoryChecks(
  trajectory: ReviewTrajectory,
  plan: EvaluationPlan,
): TrajectoryCheckResult {
  const issues: EvaluationIssue[] = [];
  const completedStages = completedStageIndices(trajectory);

  for (const stage of plan.requiredStages) {
    if (!completedStages.has(stage)) {
      issues.push(
        issue({
          code: "SKIPPED_MANDATORY_CHECK",
          severity: "high",
          summary: `Required stage "${stage}" was not completed.`,
          eventIds: [],
          evidenceIds: [],
          ruleIds: [],
        }),
      );
    }
  }

  for (let index = 1; index < trajectory.events.length; index += 1) {
    const previous = trajectory.events[index - 1];
    const current = trajectory.events[index];
    if (
      stageOrder.indexOf(current.stage) < stageOrder.indexOf(previous.stage) &&
      current.kind !== "tool_succeeded" &&
      current.kind !== "tool_failed"
    ) {
      issues.push(
        issue({
          code: "CHECK_ORDER_VIOLATION",
          severity: "high",
          summary: `Event "${current.id}" moved from stage "${previous.stage}" back to "${current.stage}" out of order.`,
          eventIds: [previous.id, current.id],
          evidenceIds: [],
          ruleIds: current.ruleId ? [current.ruleId] : [],
        }),
      );
    }
  }

  for (const mandatoryCheck of plan.mandatoryChecks) {
    const matchingEvent = trajectory.events.find((event) => {
      if (event.kind !== mandatoryCheck.requiredEventKind) {
        return false;
      }
      if (event.stage !== mandatoryCheck.stage) {
        return false;
      }
      return mandatoryCheck.requiredRuleId
        ? event.ruleId === mandatoryCheck.requiredRuleId
        : true;
    });

    if (!matchingEvent) {
      issues.push(
        issue({
          code: "SKIPPED_MANDATORY_CHECK",
          severity: "high",
          summary: `Mandatory check "${mandatoryCheck.id}" did not run.`,
          eventIds: [],
          evidenceIds: [],
          ruleIds: mandatoryCheck.requiredRuleId
            ? [mandatoryCheck.requiredRuleId]
            : [],
        }),
      );
      continue;
    }

    const eventIndex = trajectory.events.findIndex(
      (event) => event.id === matchingEvent.id,
    );

    for (const requiredStage of mandatoryCheck.mustOccurAfter) {
      const stageIndex = completedStages.get(requiredStage);
      if (stageIndex === undefined || stageIndex > eventIndex) {
        issues.push(
          issue({
            code: "CHECK_ORDER_VIOLATION",
            severity: "high",
            summary: `Mandatory check "${mandatoryCheck.id}" ran before "${requiredStage}" completed.`,
            eventIds: [matchingEvent.id],
            evidenceIds: matchingEvent.evidenceIds,
            ruleIds: matchingEvent.ruleId ? [matchingEvent.ruleId] : [],
          }),
        );
      }
    }

    for (const blockedStage of mandatoryCheck.mustOccurBefore) {
      const blockedStageIndex = firstEventIndex(
        trajectory.events,
        (event) => event.stage === blockedStage,
      );
      if (blockedStageIndex !== -1 && blockedStageIndex < eventIndex) {
        issues.push(
          issue({
            code: "CHECK_ORDER_VIOLATION",
            severity: "high",
            summary: `Mandatory check "${mandatoryCheck.id}" ran after "${blockedStage}" began.`,
            eventIds: [matchingEvent.id, trajectory.events[blockedStageIndex].id],
            evidenceIds: matchingEvent.evidenceIds,
            ruleIds: matchingEvent.ruleId ? [matchingEvent.ruleId] : [],
          }),
        );
      }
    }
  }

  let previousToolSignature: string | null = null;
  let previousToolEvent: ReviewTrajectoryEvent | null = null;
  const observedToolSignatures = new Map<string, ReviewTrajectoryEvent>();

  for (const event of trajectory.events) {
    if (event.kind !== "tool_called" || !event.toolName) {
      continue;
    }

    const signature = `${event.toolName}:${stableStringify(event.payload)}`;
    if (previousToolSignature === signature && previousToolEvent) {
      issues.push(
        issue({
          code: "REPEATED_TOOL_CALL",
          severity: "medium",
          summary: `Tool "${event.toolName}" was called repeatedly with the same payload.`,
          eventIds: [previousToolEvent.id, event.id],
          evidenceIds: event.evidenceIds,
          ruleIds: event.ruleId ? [event.ruleId] : [],
        }),
      );
    }

    const firstSeen = observedToolSignatures.get(signature);
    if (
      firstSeen &&
      firstSeen.parentEventId === event.parentEventId &&
      firstSeen.stage === event.stage
    ) {
      issues.push(
        issue({
          code: "CIRCULAR_TOOL_PATH",
          severity: "medium",
          summary: `Tool "${event.toolName}" re-entered the same path without new state.`,
          eventIds: [firstSeen.id, event.id],
          evidenceIds: event.evidenceIds,
          ruleIds: event.ruleId ? [event.ruleId] : [],
        }),
      );
    } else {
      observedToolSignatures.set(signature, event);
    }

    previousToolSignature = signature;
    previousToolEvent = event;
  }

  const scoringEvents = trajectory.events.filter(
    (event) => event.kind === "score_computed",
  );
  for (const scoreEvent of scoringEvents) {
    const scoreIndex = trajectory.events.findIndex(
      (event) => event.id === scoreEvent.id,
    );
    const missingStages = plan.scoringRequiresStages.filter((stage) => {
      const stageIndex = completedStages.get(stage);
      return stageIndex === undefined || stageIndex > scoreIndex;
    });
    if (missingStages.length > 0) {
      issues.push(
        issue({
          code: "PREMATURE_SCORING",
          severity: "high",
          summary: `Scoring occurred before required stages completed: ${missingStages.join(", ")}.`,
          eventIds: [scoreEvent.id],
          evidenceIds: scoreEvent.evidenceIds,
          ruleIds: [],
        }),
      );
    }
  }

  const failedTools = new Set(
    trajectory.events
      .filter((event) => event.kind === "tool_failed" && event.toolName)
      .map((event) => event.toolName as string),
  );
  const successTools = new Set(
    trajectory.events
      .filter((event) => event.kind === "tool_succeeded" && event.toolName)
      .map((event) => event.toolName as string),
  );

  const decisionAcceptEvent = trajectory.events.find(
    (event) =>
      event.kind === "decision_made" &&
      event.payload.decision === "ACCEPT_FOR_SCORING",
  );

  if (
    decisionAcceptEvent &&
    Array.from(failedTools).some((toolName) => !successTools.has(toolName))
  ) {
    issues.push(
      issue({
        code: "FAKE_SUCCESS_PATH",
        severity: "high",
        summary:
          "The trajectory accepted the submission after tool failures without a successful recovery path.",
        eventIds: [decisionAcceptEvent.id],
        evidenceIds: decisionAcceptEvent.evidenceIds,
        ruleIds: [],
      }),
    );
  }

  return {
    issues,
    completedStages,
  };
}
