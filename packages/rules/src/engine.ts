import type {
  DeterministicGate,
  EvidenceItem,
  Finding,
  ManualVerificationItem,
  MissingInformationItem,
  ReviewReport,
  ScoreOverview,
  SubjectiveQuestion,
} from "@genforge/domain";
import type { RepositorySignals } from "@genforge/evidence";

type Decision = ReviewReport["decision"];

const IMPLEMENTED_RULE_IDS = [
  "GL-GATE-001",
  "GL-GATE-002",
  "GL-GATE-003",
  "GL-GATE-004",
  "GL-GATE-005",
  "GL-GATE-006",
  "GL-GATE-007",
  "GL-CON-003",
  "GL-CON-004",
  "GL-FE-001",
  "GL-FE-002",
  "GL-FE-003",
  "GL-FE-005",
  "GL-FE-007",
  "GL-ENG-001",
  "GL-ENG-002",
];

export interface RuleEvaluationInput {
  evidence: EvidenceItem[];
  signals: RepositorySignals;
  missingInformation: MissingInformationItem[];
  manualVerificationQueue: ManualVerificationItem[];
  subjectiveQuestions: SubjectiveQuestion[];
}

export interface RuleEvaluationResult {
  decision: Decision;
  findings: Finding[];
  scores: ScoreOverview;
  gate: DeterministicGate;
  subjectiveQuestions: SubjectiveQuestion[];
  remediation: string[];
  summary: string;
  state:
    | "partial_result"
    | "rejected"
    | "request_more_information"
    | "accepted_for_scoring"
    | "integration_unavailable";
  limitations: string[];
}

function finding(
  partial: Omit<Finding, "id" | "manualVerification"> & {
    manualVerification?: string[];
  },
): Finding {
  return {
    id: partial.ruleId.toLowerCase(),
    manualVerification: partial.manualVerification ?? [],
    ...partial,
  };
}

function evidenceIdsFor(
  evidence: EvidenceItem[],
  matcher: (item: EvidenceItem) => boolean,
): string[] {
  const ids = evidence.filter(matcher).map((item) => item.id);
  if (ids.length > 0) {
    return ids;
  }
  return evidence.length > 0 ? [evidence[0].id] : ["rule-engine-fallback"];
}

function scoreSignals(signals: RepositorySignals): ScoreOverview {
  const genLayerFit = Math.min(
    5,
    (signals.likelyContractPaths.length > 0 ? 2 : 0) +
      (signals.mentionsGenLayer ? 1 : 0) +
      (signals.hasRealContractCallSignals ? 1 : 0),
  );
  const contractQuality = Math.min(
    5,
    (signals.likelyContractPaths.length > 0 ? 2 : 0) +
      (signals.hasShapeOnlyValidatorSignals ? 0 : 1) +
      (signals.hasDeploymentConfig ? 1 : 0),
  );
  const engineering = Math.min(
    5,
    (signals.manifests.length > 0 ? 2 : 0) +
      (signals.lockfiles.length > 0 ? 2 : 0),
  );
  const frontendUx = Math.min(
    5,
    (signals.frontendPaths.length > 0 ? 1 : 0) +
      (signals.hasRealContractCallSignals ? 2 : 0) +
      (signals.hasSimulatedWalletSignals ? 0 : 1),
  );
  const evidenceConfidence = Math.min(
    5,
    (signals.likelyContractPaths.length > 0 ? 2 : 1) +
      (signals.manifests.length > 0 ? 1 : 0) +
      (signals.lockfiles.length > 0 ? 1 : 0),
  );
  const total =
    Math.round(
      ((genLayerFit +
        contractQuality +
        engineering +
        frontendUx +
        evidenceConfidence) /
        5) *
        10,
    ) / 10;

  return {
    genLayerFit,
    contractQuality,
    engineering,
    frontendUx,
    evidenceConfidence,
    total: Math.min(5, total),
  };
}

export function evaluatePreliminaryRules(
  input: RuleEvaluationInput,
): RuleEvaluationResult {
  const {
    evidence,
    signals,
    missingInformation,
    manualVerificationQueue,
    subjectiveQuestions,
  } = input;
  const findings: Finding[] = [];
  const remediation = new Set<string>();
  const limitations = new Set<string>();
  const failedRuleIds = new Set<string>();
  const missingRuleIds = new Set<string>();
  let decision: Decision = "ACCEPT_FOR_SCORING";

  const fail = (ruleId: string) => failedRuleIds.add(ruleId);
  const markMissing = (ruleId: string) => missingRuleIds.add(ruleId);

  if (signals.likelyContractPaths.length === 0) {
    decision = "REJECT";
    fail("GL-GATE-001");
    findings.push(
      finding({
        ruleId: "GL-GATE-001",
        title: "No likely GenLayer Intelligent Contract",
        severity: "high",
        outcome: "triggered",
        classification: "INFERRED",
        confidence: "medium",
        summary:
          "The current scan did not identify a likely GenLayer Intelligent Contract candidate.",
        evidenceIds: evidenceIdsFor(
          evidence,
          (item) => item.title === "Repository metadata retrieved",
        ),
        remediation: [
          "Add or document the Intelligent Contract source path clearly.",
          "Surface contract files in the repository root or in a clearly named contracts directory.",
        ],
      }),
    );
    remediation.add(
      "Document the contract source path and include the contract source in the public repository.",
    );
  }

  if (signals.mentionsGenLayer && signals.likelyContractPaths.length === 0) {
    decision = "REJECT";
    fail("GL-GATE-002");
    findings.push(
      finding({
        ruleId: "GL-GATE-002",
        title: "GenLayer appears to be branding only",
        severity: "high",
        outcome: "triggered",
        classification: "INFERRED",
        confidence: "medium",
        summary:
          "The repository makes GenLayer-related claims, but the current scan did not find corresponding likely contract evidence.",
        evidenceIds: evidenceIdsFor(
          evidence,
          (item) =>
            item.title === "README contains GenLayer-related claims" ||
            item.title === "Repository metadata retrieved",
        ),
        remediation: [
          "Provide a concrete Intelligent Contract implementation.",
          "Link README claims to source files, deployment details, and frontend flows.",
        ],
      }),
    );
    remediation.add(
      "Tie GenLayer claims to visible source, deployment, and frontend interaction evidence.",
    );
  }

  if (signals.likelyContractPaths.length === 0) {
    fail("GL-GATE-006");
    markMissing("GL-GATE-006");
  } else if (signals.mentionsGenLayer && !signals.hasDeploymentConfig) {
    if (decision !== "REJECT") {
      decision = "REQUEST_MORE_INFO";
    }
    markMissing("GL-GATE-006");
    findings.push(
      finding({
        ruleId: "GL-GATE-006",
        title: "Contract source missing or unclear",
        severity: "medium",
        outcome: "triggered",
        classification: "MANUAL_REVIEW_REQUIRED",
        confidence: "low",
        summary:
          "A likely contract candidate exists, but the repository does not yet provide enough deployment or source mapping clarity for confident verification.",
        evidenceIds: evidenceIdsFor(
          evidence,
          (item) => item.classification === "INFERRED",
        ),
        remediation: [
          "Clarify which file is the authoritative contract source.",
          "Add deployment or load instructions that reference the exact contract file.",
        ],
        manualVerification: [
          "Confirm the contract path manually and match it against deployment instructions.",
        ],
      }),
    );
    remediation.add(
      "Clarify which repository file is the authoritative GenLayer contract source.",
    );
  }

  if (signals.candidateAddresses.length > 1) {
    const distinctAddresses = new Set(
      signals.candidateAddresses.map((item) => item.address),
    );
    if (distinctAddresses.size > 1) {
      if (decision !== "REJECT") {
        decision = "REQUEST_MORE_INFO";
      }
      markMissing("GL-GATE-007");
      fail("GL-FE-005");
      findings.push(
        finding({
          ruleId: "GL-GATE-007",
          title: "Deployment cannot be matched to source",
          severity: "medium",
          outcome: "triggered",
          classification: "MANUAL_REVIEW_REQUIRED",
          confidence: "low",
          summary:
            "Multiple address-like values were observed, but the current scan cannot safely determine which one corresponds to the intended contract deployment.",
          evidenceIds: evidenceIdsFor(
            evidence,
            (item) =>
              item.title === "Hard-coded contract-like addresses detected",
          ),
          remediation: [
            "Provide a single authoritative contract address with environment or deployment documentation.",
            "Document how the frontend address maps to the submitted contract source.",
          ],
          manualVerification: [
            "Verify deployment addresses in Studio or Explorer once available.",
          ],
        }),
      );
      findings.push(
        finding({
          ruleId: "GL-FE-005",
          title: "Contract address mismatch",
          severity: "medium",
          outcome: "triggered",
          classification: "INFERRED",
          confidence: "low",
          summary:
            "Different address-like values appear across retrieved files, so the current scan cannot confirm address consistency.",
          evidenceIds: evidenceIdsFor(
            evidence,
            (item) =>
              item.title === "Hard-coded contract-like addresses detected",
          ),
          remediation: [
            "Store the canonical contract address in one verified configuration source.",
            "Remove stale or conflicting hard-coded addresses.",
          ],
        }),
      );
      remediation.add(
        "Provide a single authoritative contract address and explain how it maps to source.",
      );
      remediation.add(
        "Remove stale or conflicting contract addresses from the codebase.",
      );
    }
  }

  if (signals.hasShapeOnlyValidatorSignals) {
    decision = "REJECT";
    fail("GL-CON-003");
    findings.push(
      finding({
        ruleId: "GL-CON-003",
        title: "Validator appears to check shape or format only",
        severity: "high",
        outcome: "triggered",
        classification: "INFERRED",
        confidence: "low",
        summary:
          "Current contract or validator candidates contain signals consistent with shape-only validation rather than meaningful adjudication.",
        evidenceIds: evidenceIdsFor(evidence, (item) =>
          item.title.startsWith("Shape-only validator signal"),
        ),
        remediation: [
          "Implement meaningful, evidence-based judging logic instead of format-only checks.",
          "Document the adjudication criteria and where non-deterministic judgment occurs.",
        ],
      }),
    );
    remediation.add(
      "Replace shape-only validation with meaningful judging criteria and documented evidence logic.",
    );
  }

  if (signals.hasSimulatedWalletSignals) {
    decision = "REJECT";
    fail("GL-FE-001");
    findings.push(
      finding({
        ruleId: "GL-FE-001",
        title: "Simulated or localStorage wallet detected",
        severity: "high",
        outcome: "triggered",
        classification: "INFERRED",
        confidence: "medium",
        summary:
          "Frontend files contain markers associated with simulated wallet or local-only transaction state.",
        evidenceIds: evidenceIdsFor(evidence, (item) =>
          item.title.startsWith("Simulated wallet signal"),
        ),
        remediation: [
          "Replace simulated wallet state with a real wallet integration.",
          "Show real pending, success, replacement, timeout, and error states from network interactions.",
        ],
      }),
    );
    remediation.add(
      "Replace local-only wallet or transaction simulation with a real wallet integration.",
    );
  }

  if (signals.frontendPaths.length > 0 && !signals.hasRealContractCallSignals) {
    decision = "REJECT";
    fail("GL-FE-002");
    findings.push(
      finding({
        ruleId: "GL-FE-002",
        title: "Static frontend metadata without real contract calls",
        severity: "high",
        outcome: "triggered",
        classification: "INFERRED",
        confidence: "medium",
        summary:
          "Frontend-related files were retrieved, but the current scan did not find strong contract-call markers.",
        evidenceIds: evidenceIdsFor(
          evidence,
          (item) => item.filePath !== undefined,
        ),
        remediation: [
          "Wire the frontend to real contract reads or writes.",
          "Document the contract interaction flow in the repository.",
        ],
      }),
    );
    remediation.add(
      "Wire the frontend to real contract reads or writes and document the flow.",
    );
  }

  if (signals.manifests.length === 0 || signals.lockfiles.length === 0) {
    if (decision === "ACCEPT_FOR_SCORING") {
      decision = "REQUEST_MORE_INFO";
    }
    markMissing("GL-ENG-001");
    findings.push(
      finding({
        ruleId: "GL-ENG-001",
        title: "Setup is not reproducible",
        severity: "medium",
        outcome: "triggered",
        classification: "INFERRED",
        confidence: "medium",
        summary:
          "The repository is missing either a manifest, a lockfile, or both, which weakens reproducible setup evidence.",
        evidenceIds: evidenceIdsFor(
          evidence,
          (item) => item.sourceType === "repository_file",
        ),
        remediation: [
          "Add or document the primary build manifest.",
          "Commit lockfiles for the main package or runtime dependency set.",
        ],
      }),
    );
    remediation.add(
      "Add the primary build manifest and commit lockfiles needed for reproducible setup.",
    );
  }

  if (!signals.dependencyPinsObserved) {
    if (decision === "ACCEPT_FOR_SCORING") {
      decision = "REQUEST_MORE_INFO";
    }
    markMissing("GL-ENG-002");
    findings.push(
      finding({
        ruleId: "GL-ENG-002",
        title: "Critical dependencies are not pinned",
        severity: "medium",
        outcome: "triggered",
        classification: "INFERRED",
        confidence: "medium",
        summary:
          "The current scan did not retrieve dependency lockfiles strong enough to support pinned critical dependencies.",
        evidenceIds: evidenceIdsFor(
          evidence,
          (item) => item.sourceType === "repository_file",
        ),
        remediation: [
          "Commit dependency lockfiles for the authoritative runtime.",
          "Pin critical dependencies in the manifest where lockfiles are not possible.",
        ],
      }),
    );
    remediation.add(
      "Commit lockfiles and pin critical dependencies for the authoritative runtime.",
    );
  }

  if (missingInformation.length > 0) {
    limitations.add(
      "Some decision inputs remain incomplete and are reflected in the missing-information queue.",
    );
  }
  if (manualVerificationQueue.length > 0) {
    limitations.add(
      "Studio, Explorer, wallet, transaction, state, and value-transfer verification are not yet automated.",
    );
  }

  const passedRuleIds = IMPLEMENTED_RULE_IDS.filter(
    (ruleId) => !failedRuleIds.has(ruleId) && !missingRuleIds.has(ruleId),
  );

  const scores = scoreSignals(signals);
  const summary =
    decision === "REJECT"
      ? "The repository does not yet provide enough evidence to pass deterministic GenLayer gating."
      : decision === "REQUEST_MORE_INFO"
        ? "The repository shows plausible GenLayer signals, but additional source, deployment, or verification clarity is still required."
        : "The repository passes deterministic gating and can move into GenLayer-backed scoring.";

  const state =
    decision === "REJECT"
      ? "rejected"
      : decision === "REQUEST_MORE_INFO"
        ? "request_more_information"
        : missingInformation.length > 0 || manualVerificationQueue.length > 0
          ? "partial_result"
          : "accepted_for_scoring";

  return {
    decision,
    findings,
    scores,
    gate: {
      decision,
      passedRuleIds,
      failedRuleIds: Array.from(failedRuleIds),
      missingRuleIds: Array.from(missingRuleIds),
    },
    subjectiveQuestions,
    remediation: Array.from(remediation),
    summary,
    state,
    limitations: Array.from(limitations),
  };
}
