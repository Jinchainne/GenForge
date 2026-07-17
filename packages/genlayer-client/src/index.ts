import type {
  Decision,
  GenLayerExecutionResult,
  GenLayerJudgment,
  GenLayerReviewRequest,
} from "@genforge/domain";
import { GenLayerExecutionResultSchema } from "@genforge/domain";

export interface GenLayerClientConfig {
  mode?: "mock" | "sdk";
  network?: string;
  contractAddress?: string;
  rpcUrl?: string;
}

function buildMockJudgment(request: GenLayerReviewRequest): GenLayerJudgment {
  const accepted = request.gate.decision === "ACCEPT_FOR_SCORING";
  const decision: Decision = accepted
    ? "ACCEPT_FOR_SCORING"
    : request.gate.decision;
  const evidenceCount = request.evidenceSummary.length;
  const base = accepted ? 3 : 1;
  const score = Math.min(5, base + Math.min(2, evidenceCount / 4));
  return {
    decision,
    scores: {
      genlayer_fit: score,
      contract_quality: score,
      engineering: Math.max(0, score - 0.5),
      frontend_ux: Math.max(0, score - 0.5),
    },
    confidence: accepted ? 0.76 : 0.42,
    summary: accepted
      ? "Mock GenLayer review accepted the submission for scoring based on the bounded evidence package."
      : "Mock GenLayer review preserved the deterministic gate decision.",
    strengths: accepted
      ? [
          "Deterministic gate allowed subjective review.",
          "Evidence package was bounded and normalized.",
        ]
      : [],
    findings: accepted
      ? []
      : ["Deterministic gate issues prevent meaningful competitive scoring."],
    required_actions: accepted
      ? [
          "Run a live GenLayer submission before treating this as production evidence.",
        ]
      : ["Address deterministic gate failures before resubmitting."],
    manual_review_required: !accepted,
  };
}

export async function submitGenLayerReview(
  request: GenLayerReviewRequest,
  config: GenLayerClientConfig = {},
): Promise<GenLayerExecutionResult> {
  if (request.gate.decision !== "ACCEPT_FOR_SCORING") {
    return GenLayerExecutionResultSchema.parse({
      status: "SKIPPED_BY_GATE",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      parserMessage:
        "Deterministic gate rejected or deferred the submission before contract submission.",
    });
  }

  if (config.mode === "mock") {
    return GenLayerExecutionResultSchema.parse({
      status: "CONSENSUS_ACCEPTED",
      network: config.network ?? "mocknet",
      contractAddress: config.contractAddress ?? "mock-contract",
      transactionHash: "0xmockedgenlayerreview",
      receiptStatus: "mock-finalized",
      judgment: buildMockJudgment(request),
      parserMessage: "Explicit mock mode is enabled.",
    });
  }

  if (!config.network || !config.contractAddress) {
    return GenLayerExecutionResultSchema.parse({
      status: "GENLAYER_NOT_CONFIGURED",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      errorClassification: "missing_configuration",
      parserMessage:
        "GENLAYER_NETWORK and GENLAYER_CONTRACT_ADDRESS must be configured for live submission.",
    });
  }

  try {
    const sdk = (await import("genlayer-js")) as Record<string, unknown>;
    const createClient = sdk.createClient as
      | ((options: Record<string, unknown>) => Record<string, unknown>)
      | undefined;

    if (!createClient) {
      return GenLayerExecutionResultSchema.parse({
        status: "GENLAYER_UNAVAILABLE",
        network: config.network,
        contractAddress: config.contractAddress,
        judgment: null,
        errorClassification: "sdk_unavailable",
        parserMessage:
          "genlayer-js did not expose createClient in the installed version.",
      });
    }

    const client = createClient({
      endpoint: config.rpcUrl,
      network: config.network,
    });
    const writeContract = client.writeContract as
      ((input: Record<string, unknown>) => Promise<unknown>) | undefined;
    const waitForTransactionReceipt = client.waitForTransactionReceipt as
      ((input: Record<string, unknown>) => Promise<unknown>) | undefined;

    if (!writeContract || !waitForTransactionReceipt) {
      return GenLayerExecutionResultSchema.parse({
        status: "GENLAYER_UNAVAILABLE",
        network: config.network,
        contractAddress: config.contractAddress,
        judgment: null,
        errorClassification: "sdk_method_missing",
        parserMessage:
          "Installed genlayer-js version does not expose the expected writeContract or waitForTransactionReceipt methods.",
      });
    }

    const txResult = (await writeContract({
      address: config.contractAddress,
      functionName: "review_submission",
      args: [request],
    })) as Record<string, unknown>;
    const transactionHash =
      typeof txResult.hash === "string" ? txResult.hash : undefined;

    if (!transactionHash) {
      return GenLayerExecutionResultSchema.parse({
        status: "UNEXPECTED_RESULT",
        network: config.network,
        contractAddress: config.contractAddress,
        judgment: null,
        errorClassification: "missing_transaction_hash",
        parserMessage: "writeContract returned without a transaction hash.",
      });
    }

    const receipt = (await waitForTransactionReceipt({
      hash: transactionHash,
    })) as Record<string, unknown>;
    const rawResult = receipt.result;
    const parserMessage =
      typeof rawResult === "string"
        ? rawResult
        : JSON.stringify(rawResult ?? {});

    try {
      const judgment = JSON.parse(parserMessage) as GenLayerJudgment;
      return GenLayerExecutionResultSchema.parse({
        status:
          judgment.decision === "ACCEPT_FOR_SCORING"
            ? "CONSENSUS_ACCEPTED"
            : "CONSENSUS_REJECTED",
        network: config.network,
        contractAddress: config.contractAddress,
        transactionHash,
        receiptStatus:
          typeof receipt.status === "string" ? receipt.status : "finalized",
        judgment,
        parserMessage: "Live GenLayer receipt parsed successfully.",
      });
    } catch (error) {
      return GenLayerExecutionResultSchema.parse({
        status: "UNEXPECTED_RESULT",
        network: config.network,
        contractAddress: config.contractAddress,
        transactionHash,
        receiptStatus:
          typeof receipt.status === "string" ? receipt.status : "finalized",
        judgment: null,
        errorClassification: "result_parse_failed",
        parserMessage:
          error instanceof Error
            ? error.message
            : "Failed to parse GenLayer result payload.",
      });
    }
  } catch (error) {
    return GenLayerExecutionResultSchema.parse({
      status: "GENLAYER_UNAVAILABLE",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      errorClassification: "sdk_call_failed",
      parserMessage:
        error instanceof Error
          ? error.message
          : "Unknown GenLayer client failure.",
    });
  }
}
