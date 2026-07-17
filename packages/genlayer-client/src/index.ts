import type {
  Decision,
  GenLayerExecutionResult,
  GenLayerJudgment,
  GenLayerReviewRequest,
} from "@genforge/domain";
import { GenLayerExecutionResultSchema } from "@genforge/domain";

export interface GenLayerClientConfig {
  mode?: "mock" | "sdk";
  network?: "localnet" | "studionet" | "testnetAsimov" | "testnetBradbury";
  contractAddress?: string;
  rpcUrl?: string;
  privateKey?: `0x${string}`;
  sdkOverride?: Record<string, unknown>;
  chainsOverride?: Record<string, unknown>;
  typesOverride?: Record<string, unknown>;
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

function resolveReceiptStatus(receipt: Record<string, unknown>): string {
  return typeof receipt.statusName === "string"
    ? receipt.statusName
    : typeof receipt.status === "string"
      ? receipt.status
      : "UNKNOWN";
}

function parseJudgmentPayload(payload: unknown): GenLayerJudgment | null {
  if (typeof payload === "string") {
    return JSON.parse(payload) as GenLayerJudgment;
  }

  if (payload && typeof payload === "object") {
    if ("data" in payload && typeof payload.data === "string") {
      return JSON.parse(payload.data) as GenLayerJudgment;
    }
    return payload as GenLayerJudgment;
  }

  return null;
}

async function fallbackReadJudgment(
  client: Record<string, unknown>,
  contractAddress: string,
  submissionId: string,
): Promise<GenLayerJudgment | null> {
  const readContract = client.readContract as
    | ((input: Record<string, unknown>) => Promise<unknown>)
    | undefined;

  if (!readContract) {
    return null;
  }

  const raw = await readContract({
    address: contractAddress,
    functionName: "get_review_judgment",
    args: [submissionId],
    stateStatus: "accepted",
  });

  return parseJudgmentPayload(raw);
}

function resolveChain(
  sdkChains: Record<string, unknown>,
  network: GenLayerClientConfig["network"],
): unknown {
  if (!network) {
    return undefined;
  }
  return sdkChains[network];
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
      network: config.network ?? "localnet",
      contractAddress: config.contractAddress ?? "mock-contract",
      transactionHash: "0xmockedgenlayerreview",
      receiptStatus: "mock-finalized",
      judgment: buildMockJudgment(request),
      parserMessage: "Explicit mock mode is enabled.",
    });
  }

  if (
    !config.network ||
    !config.contractAddress ||
    !config.rpcUrl ||
    !config.privateKey
  ) {
    return GenLayerExecutionResultSchema.parse({
      status: "GENLAYER_NOT_CONFIGURED",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      errorClassification: "missing_configuration",
      parserMessage:
        "GENLAYER_NETWORK, GENLAYER_CONTRACT_ADDRESS, GENLAYER_RPC_URL, and GENLAYER_PRIVATE_KEY must be configured for live submission.",
    });
  }

  try {
    const sdk =
      config.sdkOverride ??
      ((await import("genlayer-js")) as unknown as Record<string, unknown>);
    const sdkChains =
      config.chainsOverride ??
      ((await import("genlayer-js/chains")) as Record<string, unknown>);
    const sdkTypes =
      config.typesOverride ??
      ((await import("genlayer-js/types")) as Record<string, unknown>);

    const createClient = sdk.createClient as
      | ((options: Record<string, unknown>) => Record<string, unknown>)
      | undefined;
    const createAccount = sdk.createAccount as
      | ((privateKey?: `0x${string}`) => unknown)
      | undefined;
    const transactionStatus = sdkTypes.TransactionStatus as
      | Record<string, string>
      | undefined;

    if (!createClient || !createAccount || !transactionStatus) {
      return GenLayerExecutionResultSchema.parse({
        status: "GENLAYER_UNAVAILABLE",
        network: config.network,
        contractAddress: config.contractAddress,
        judgment: null,
        errorClassification: "sdk_unavailable",
        parserMessage:
          "genlayer-js did not expose the expected createClient, createAccount, or TransactionStatus exports.",
      });
    }

    const chain = resolveChain(sdkChains, config.network);
    if (!chain) {
      return GenLayerExecutionResultSchema.parse({
        status: "GENLAYER_NOT_CONFIGURED",
        network: config.network,
        contractAddress: config.contractAddress,
        judgment: null,
        errorClassification: "unknown_network",
        parserMessage: `Unsupported GenLayer network "${config.network}".`,
      });
    }

    const account = createAccount(config.privateKey);
    const client = createClient({
      chain,
      endpoint: config.rpcUrl,
      account,
    });
    const writeContract = client.writeContract as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    const waitForTransactionReceipt = client.waitForTransactionReceipt as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;

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

    const transactionHash = (await writeContract({
      address: config.contractAddress,
      functionName: "review_submission",
      args: [JSON.stringify(request)],
      value: BigInt(0),
    })) as string;

    if (!transactionHash || typeof transactionHash !== "string") {
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
      status: transactionStatus.FINALIZED,
      fullTransaction: false,
    })) as Record<string, unknown>;

    const receiptStatus = resolveReceiptStatus(receipt);
    const txExecutionResultName =
      typeof receipt.txExecutionResultName === "string"
        ? receipt.txExecutionResultName
        : undefined;

    if (txExecutionResultName === "NOT_VOTED") {
      return GenLayerExecutionResultSchema.parse({
        status: "CONSENSUS_PENDING",
        network: config.network,
        contractAddress: config.contractAddress,
        transactionHash,
        receiptStatus,
        judgment: null,
        parserMessage:
          "Consensus finalized enough to fetch a receipt, but execution result is still NOT_VOTED.",
      });
    }

    if (txExecutionResultName === "FINISHED_WITH_ERROR") {
      return GenLayerExecutionResultSchema.parse({
        status: "TRANSACTION_FAILED",
        network: config.network,
        contractAddress: config.contractAddress,
        transactionHash,
        receiptStatus,
        judgment: null,
        errorClassification: "execution_failed",
        parserMessage:
          typeof receipt.result === "string"
            ? receipt.result
            : "Contract execution finished with error.",
      });
    }

    let judgment: GenLayerJudgment | null = null;
    try {
      judgment = parseJudgmentPayload(receipt.result);
    } catch {
      judgment = await fallbackReadJudgment(
        client,
        config.contractAddress,
        request.submissionId,
      );
    }

    if (!judgment) {
      return GenLayerExecutionResultSchema.parse({
        status: "UNEXPECTED_RESULT",
        network: config.network,
        contractAddress: config.contractAddress,
        transactionHash,
        receiptStatus,
        judgment: null,
        errorClassification: "result_parse_failed",
        parserMessage:
          "Transaction finalized, but no parseable judgment payload was available from the receipt or contract view.",
      });
    }

    return GenLayerExecutionResultSchema.parse({
      status:
        judgment.decision === "ACCEPT_FOR_SCORING"
          ? "CONSENSUS_ACCEPTED"
          : "CONSENSUS_REJECTED",
      network: config.network,
      contractAddress: config.contractAddress,
      transactionHash,
      receiptStatus,
      judgment,
      parserMessage: "Live GenLayer receipt parsed successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const classification = /rejected|denied|insufficient|nonce/i.test(message)
      ? "transaction_rejected"
      : "sdk_call_failed";
    return GenLayerExecutionResultSchema.parse({
      status:
        classification === "transaction_rejected"
          ? "TRANSACTION_REJECTED"
          : "GENLAYER_UNAVAILABLE",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      errorClassification: classification,
      parserMessage: message,
    });
  }
}
