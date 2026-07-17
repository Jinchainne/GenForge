import { describe, expect, it } from "vitest";
import { buildRepositoryEvidence } from "@genforge/evidence";
import { evaluatePreliminaryRules } from "@genforge/rules";
import {
  likelyGenLayerSnapshot,
  missingContractSourceSnapshot,
  noGenLayerSnapshot,
  simulatedWalletSnapshot,
} from "./fixtures/github";

describe("evaluatePreliminaryRules", () => {
  it("rejects repositories with no likely GenLayer evidence", () => {
    const result = evaluatePreliminaryRules(
      buildRepositoryEvidence(noGenLayerSnapshot),
    );

    expect(result.decision).toBe("REJECT");
    expect(
      result.findings.some((finding) => finding.ruleId === "GL-GATE-001"),
    ).toBe(true);
  });

  it("accepts likely GenLayer repositories for scoring", () => {
    const result = evaluatePreliminaryRules(
      buildRepositoryEvidence(likelyGenLayerSnapshot),
    );

    expect(result.decision).toBe("ACCEPT_FOR_SCORING");
  });

  it("rejects simulated wallet patterns", () => {
    const result = evaluatePreliminaryRules(
      buildRepositoryEvidence(simulatedWalletSnapshot),
    );

    expect(
      result.findings.some((finding) => finding.ruleId === "GL-FE-001"),
    ).toBe(true);
    expect(result.decision).toBe("REJECT");
  });

  it("requests more info when contract source is unclear", () => {
    const result = evaluatePreliminaryRules(
      buildRepositoryEvidence(missingContractSourceSnapshot),
    );

    expect(
      result.findings.some((finding) => finding.ruleId === "GL-GATE-006"),
    ).toBe(true);
  });
});
