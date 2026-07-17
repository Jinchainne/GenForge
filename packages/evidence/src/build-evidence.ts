import { createHash } from "node:crypto";
import type {
  EvidenceItem,
  ManualVerificationItem,
  MissingInformationItem,
  RepositoryFile,
  RepositorySnapshot,
  SubjectiveQuestion,
} from "@genforge/domain";

export interface RepositorySignals {
  hasReadme: boolean;
  mentionsGenLayer: boolean;
  likelyContractPaths: string[];
  likelyContractMarkers: string[];
  frontendPaths: string[];
  hasRealContractCallSignals: boolean;
  hasSimulatedWalletSignals: boolean;
  hasShapeOnlyValidatorSignals: boolean;
  hasDeploymentConfig: boolean;
  lockfiles: string[];
  manifests: string[];
  candidateAddresses: Array<{ path: string; address: string }>;
  dependencyPinsObserved: boolean;
}

export interface EvidenceBuildResult {
  evidence: EvidenceItem[];
  signals: RepositorySignals;
  missingInformation: MissingInformationItem[];
  manualVerificationQueue: ManualVerificationItem[];
  subjectiveQuestions: SubjectiveQuestion[];
}

const GENLAYER_MARKERS = [
  /from\s+genlayer\s+import/gi,
  /@gl\.public/gi,
  /\bgl\.Contract\b/gi,
  /\bgl\.nondet\b/gi,
  /\bgl\.eq_principle\b/gi,
  /\bgenlayer-js\b/gi,
  /\bgenlayer\b/gi,
  /\bintelligent contract\b/gi,
];

const REAL_CALL_MARKERS = [
  /\bgenlayer-js\b/gi,
  /\bcreateClient\b/gi,
  /\breadContract\b/gi,
  /\bwriteContract\b/gi,
  /\bwaitForTransactionReceipt\b/gi,
];

const SIMULATED_WALLET_MARKERS = [
  /\blocalStorage\b/gi,
  /\bmockWallet\b/gi,
  /\bfakeTransaction\b/gi,
  /\bsimulatedWallet\b/gi,
  /\bdemoAddress\b/gi,
];

const SHAPE_ONLY_MARKERS = [
  /\bjsonschema\b/gi,
  /\bregex\b/gi,
  /\bstartswith\(/gi,
  /\bendswith\(/gi,
  /\blen\(/gi,
  /\benum\b/gi,
  /\bformat check\b/gi,
];

const NON_DETERMINISTIC_MARKERS = [
  /\bgl\.nondet\b/gi,
  /\bexec_prompt\b/gi,
  /\bweb\.render\b/gi,
  /\beq_principle\b/gi,
  /\bllm\b/gi,
  /\brequests\b/gi,
];

function evidenceId(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;
}

function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function createEvidence(
  snapshot: RepositorySnapshot,
  partial: Omit<EvidenceItem, "id" | "commitSha"> & {
    id?: string;
  },
): EvidenceItem {
  return {
    id:
      partial.id ??
      evidenceId(
        partial.sourceType,
        `${partial.title}-${partial.filePath ?? partial.summary}`,
      ),
    commitSha: snapshot.metadata.commitSha,
    ...partial,
  };
}

function matchMarkers(text: string, patterns: RegExp[]): string[] {
  const matches = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[0]) {
        matches.add(match[0]);
      }
    }
  }
  return Array.from(matches);
}

function extractAddresses(file: RepositoryFile): string[] {
  if (!file.textExcerpt) {
    return [];
  }
  const matches = file.textExcerpt.match(/\b0x[a-fA-F0-9]{40}\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function fileReference(snapshot: RepositorySnapshot, path: string): string {
  return `${snapshot.metadata.htmlUrl}/blob/${snapshot.metadata.commitSha}/${path}`;
}

export function buildRepositoryEvidence(
  snapshot: RepositorySnapshot,
): EvidenceBuildResult {
  const evidence: EvidenceItem[] = [];
  const missingInformation: MissingInformationItem[] = [];
  const manualVerificationQueue: ManualVerificationItem[] = [];
  const subjectiveQuestions: SubjectiveQuestion[] = [];

  evidence.push(
    createEvidence(snapshot, {
      title: "Repository metadata retrieved",
      classification: "OBSERVED",
      sourceType: "github_api",
      repositoryFileOrUrl: snapshot.metadata.htmlUrl,
      exactLocation: "repository metadata",
      summary: `Fetched public repository metadata for ${snapshot.metadata.owner}/${snapshot.metadata.repo} at commit ${snapshot.metadata.commitSha}.`,
      confidence: "high",
      sourceUrl: snapshot.metadata.htmlUrl,
      observedValue: `defaultBranch=${snapshot.metadata.defaultBranch}; commitSha=${snapshot.metadata.commitSha}; stars=${snapshot.metadata.stars}`,
    }),
  );

  const readmeFiles = snapshot.files.filter(
    (file) => file.purpose === "readme",
  );
  const manifestFiles = snapshot.files.filter(
    (file) => file.purpose === "manifest",
  );
  const lockfiles = snapshot.files.filter(
    (file) => file.purpose === "lockfile",
  );
  const contractCandidates = snapshot.files.filter(
    (file) => file.purpose === "contract_candidate",
  );
  const frontendCandidates = snapshot.files.filter(
    (file) => file.purpose === "frontend_candidate",
  );
  const deploymentCandidates = snapshot.files.filter(
    (file) => file.purpose === "deployment_candidate",
  );

  for (const file of snapshot.files) {
    evidence.push(
      createEvidence(snapshot, {
        title: `Repository file retrieved: ${file.path}`,
        classification: "OBSERVED",
        sourceType: "repository_file",
        repositoryFileOrUrl: file.path,
        exactLocation: `${file.path}:excerpt`,
        summary: `Fetched ${file.path} for GenForge evaluation.`,
        confidence: "high",
        filePath: file.path,
        sourceUrl: fileReference(snapshot, file.path),
        integrityHash: hashText(file.textExcerpt ?? ""),
      }),
    );
  }

  const mentionsGenLayer = readmeFiles.some((file) =>
    /genlayer|intelligent contract|validator|studio/i.test(
      file.textExcerpt ?? "",
    ),
  );
  if (mentionsGenLayer) {
    const readme = readmeFiles[0];
    evidence.push(
      createEvidence(snapshot, {
        title: "README contains GenLayer-related claims",
        classification: "OBSERVED",
        sourceType: "repository_file",
        repositoryFileOrUrl: readme?.path ?? "README",
        exactLocation: `${readme?.path ?? "README"}:excerpt`,
        summary:
          "Repository README includes GenLayer-related claims. Those claims remain untrusted until corroborated by source or deployment evidence.",
        confidence: "medium",
        filePath: readme?.path,
        sourceUrl: readme ? fileReference(snapshot, readme.path) : undefined,
        integrityHash: readme?.textExcerpt
          ? hashText(readme.textExcerpt)
          : undefined,
      }),
    );
  }

  const likelyContractMarkers = new Set<string>();
  const likelyContractPaths: string[] = [];
  let hasShapeOnlyValidatorSignals = false;
  let hasRealContractCallSignals = false;
  let hasSimulatedWalletSignals = false;

  for (const file of contractCandidates) {
    const text = file.textExcerpt ?? "";
    const contractMarkers = matchMarkers(text, GENLAYER_MARKERS);
    if (contractMarkers.length > 0) {
      likelyContractPaths.push(file.path);
      contractMarkers.forEach((marker) => likelyContractMarkers.add(marker));
      evidence.push(
        createEvidence(snapshot, {
          title: `Likely GenLayer contract candidate: ${file.path}`,
          classification: "INFERRED",
          sourceType: "heuristic",
          repositoryFileOrUrl: file.path,
          exactLocation: `${file.path}:excerpt`,
          summary:
            "File path and retrieved contents contain markers consistent with a likely GenLayer Intelligent Contract candidate.",
          confidence: "medium",
          filePath: file.path,
          sourceUrl: fileReference(snapshot, file.path),
          observedValue: contractMarkers.join(", "),
          limitation:
            "This is a heuristic classification based on filenames and source markers, not proof of a deployable Intelligent Contract.",
          integrityHash: hashText(text),
        }),
      );
    }

    const shapeOnlyMarkers = matchMarkers(text, SHAPE_ONLY_MARKERS);
    const nonDeterministicMarkers = matchMarkers(
      text,
      NON_DETERMINISTIC_MARKERS,
    );
    if (shapeOnlyMarkers.length > 0 && nonDeterministicMarkers.length === 0) {
      hasShapeOnlyValidatorSignals = true;
      evidence.push(
        createEvidence(snapshot, {
          title: `Shape-only validator signal: ${file.path}`,
          classification: "INFERRED",
          sourceType: "heuristic",
          repositoryFileOrUrl: file.path,
          exactLocation: `${file.path}:excerpt`,
          summary:
            "Validator or contract candidate appears to rely on shape or formatting markers without clear non-deterministic or evidence-based adjudication logic.",
          confidence: "low",
          filePath: file.path,
          sourceUrl: fileReference(snapshot, file.path),
          observedValue: shapeOnlyMarkers.join(", "),
          limitation:
            "This inference is heuristic. Manual review is still required before treating it as a hard fact.",
          integrityHash: hashText(text),
        }),
      );
    }
  }

  for (const file of frontendCandidates) {
    const text = file.textExcerpt ?? "";
    const callMarkers = matchMarkers(text, REAL_CALL_MARKERS);
    const simulatedMarkers = matchMarkers(text, SIMULATED_WALLET_MARKERS);

    if (callMarkers.length > 0) {
      hasRealContractCallSignals = true;
      evidence.push(
        createEvidence(snapshot, {
          title: `Frontend contract-call signal: ${file.path}`,
          classification: "INFERRED",
          sourceType: "heuristic",
          repositoryFileOrUrl: file.path,
          exactLocation: `${file.path}:excerpt`,
          summary:
            "Frontend candidate contains SDK or transaction markers that may indicate real contract interaction.",
          confidence: "medium",
          filePath: file.path,
          sourceUrl: fileReference(snapshot, file.path),
          observedValue: callMarkers.join(", "),
          limitation:
            "This remains heuristic until network configuration, wallet flow, and transaction receipt evidence are verified.",
          integrityHash: hashText(text),
        }),
      );
    }

    if (simulatedMarkers.length > 0) {
      hasSimulatedWalletSignals = true;
      evidence.push(
        createEvidence(snapshot, {
          title: `Simulated wallet signal: ${file.path}`,
          classification: "INFERRED",
          sourceType: "heuristic",
          repositoryFileOrUrl: file.path,
          exactLocation: `${file.path}:excerpt`,
          summary:
            "Frontend candidate contains markers associated with simulated wallet, fake transaction state, or local-only persistence behavior.",
          confidence: "medium",
          filePath: file.path,
          sourceUrl: fileReference(snapshot, file.path),
          observedValue: simulatedMarkers.join(", "),
          limitation:
            "This inference is based on source markers and must be manually verified against a live UI flow.",
          integrityHash: hashText(text),
        }),
      );
    }
  }

  const candidateAddresses = snapshot.files.flatMap((file) =>
    extractAddresses(file).map((address) => ({ path: file.path, address })),
  );
  if (candidateAddresses.length > 0) {
    evidence.push(
      createEvidence(snapshot, {
        title: "Hard-coded contract-like addresses detected",
        classification: "OBSERVED",
        sourceType: "repository_file",
        repositoryFileOrUrl: candidateAddresses[0]?.path ?? "repository",
        exactLocation: `${candidateAddresses[0]?.path ?? "repository"}:excerpt`,
        summary:
          "Retrieved files contain one or more hard-coded address-like values that require source-to-deployment verification.",
        confidence: "medium",
        observedValue: candidateAddresses
          .map((item) => `${item.path}:${item.address}`)
          .join(", "),
      }),
    );
  }

  const dependencyPinsObserved =
    manifestFiles.length > 0 && lockfiles.length > 0;

  if (likelyContractPaths.length === 0) {
    missingInformation.push({
      id: "missing-likely-contract",
      summary: "No likely GenLayer Intelligent Contract source was identified.",
      reason:
        "The current scan did not find a strong contract path or source marker set.",
    });
  }

  if (deploymentCandidates.length === 0) {
    missingInformation.push({
      id: "missing-deployment-config",
      summary: "No deployment configuration was retrieved.",
      reason:
        "The current scan did not retrieve a deployment-oriented file that could match source to deployment.",
    });
  }

  manualVerificationQueue.push({
    id: "manual-studio-check",
    summary: "Studio verification is not automated in this slice.",
    rationale:
      "Live contract execution, validator agreement, and state mutation timing still require manual Studio review.",
  });
  manualVerificationQueue.push({
    id: "manual-explorer-check",
    summary: "Explorer verification is not automated in this slice.",
    rationale:
      "On-chain address, transaction receipt, finality, and value-transfer verification still require manual Explorer review.",
  });

  subjectiveQuestions.push({
    id: "genlayer-fit",
    prompt:
      "Does this submission materially benefit from decentralized adjudication rather than a single trusted server?",
    rationale:
      "GenLayer should only be used for a consensus-critical judgment, not decorative branding.",
  });
  subjectiveQuestions.push({
    id: "validator-substance",
    prompt:
      "Does the contract appear to perform meaningful non-deterministic judging with validator-side verification rather than shape-only checks?",
    rationale:
      "The leader and validator must independently enforce substantive adjudication criteria.",
  });
  subjectiveQuestions.push({
    id: "evidence-grounding",
    prompt:
      "Is the repository evidence strong enough to support the claimed architecture, integration, and builder-facing feedback?",
    rationale:
      "Accepted submissions must be grounded in retrieved source and deployment clues.",
  });

  return {
    evidence,
    signals: {
      hasReadme: readmeFiles.length > 0,
      mentionsGenLayer,
      likelyContractPaths,
      likelyContractMarkers: Array.from(likelyContractMarkers),
      frontendPaths: frontendCandidates.map((file) => file.path),
      hasRealContractCallSignals,
      hasSimulatedWalletSignals,
      hasShapeOnlyValidatorSignals,
      hasDeploymentConfig: deploymentCandidates.length > 0,
      lockfiles: lockfiles.map((file) => file.path),
      manifests: manifestFiles.map((file) => file.path),
      candidateAddresses,
      dependencyPinsObserved,
    },
    missingInformation,
    manualVerificationQueue,
    subjectiveQuestions,
  };
}
