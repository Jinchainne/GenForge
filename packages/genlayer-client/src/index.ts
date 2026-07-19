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

export interface BrowserWalletProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
}

export interface BrowserGenLayerClientConfig
  extends Omit<GenLayerClientConfig, "mode" | "privateKey"> {
  provider?: BrowserWalletProvider;
  walletAddress?: `0x${string}`;
  waitIntervalMs?: number;
  waitRetries?: number;
}

export interface BrowserContractReadback {
  functionName: string;
  args: unknown[];
}

export interface BrowserContractJsonCall {
  functionName: string;
  args: unknown[];
  readback?: BrowserContractReadback;
}

export interface BrowserContractExecutionResult {
  status:
    | "CONSENSUS_PENDING"
    | "FINALIZED"
    | "GENLAYER_NOT_CONFIGURED"
    | "GENLAYER_UNAVAILABLE"
    | "TRANSACTION_REJECTED"
    | "TRANSACTION_FAILED"
    | "UNEXPECTED_RESULT";
  network?: string;
  contractAddress?: string;
  transactionHash?: string;
  receiptStatus?: string;
  errorClassification?: string;
  parserMessage?: string;
  result?: unknown;
}

type SdkRuntime = {
  createClient: (options: Record<string, unknown>) => Record<string, unknown>;
  createAccount?: (privateKey?: `0x${string}`) => unknown;
  transactionStatus: Record<string, string>;
  chain: unknown;
};

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

function parseJsonPayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return JSON.parse(payload);
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    const data = payload.data;
    if (typeof data === "string") {
      return JSON.parse(data);
    }
  }

  return payload;
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

async function fallbackReadJson(
  client: Record<string, unknown>,
  contractAddress: string,
  readback?: BrowserContractReadback,
): Promise<unknown> {
  if (!readback) {
    return null;
  }

  const readContract = client.readContract as
    | ((input: Record<string, unknown>) => Promise<unknown>)
    | undefined;

  if (!readContract) {
    return null;
  }

  const raw = await readContract({
    address: contractAddress,
    functionName: readback.functionName,
    args: readback.args,
    stateStatus: "accepted",
  });

  return parseJsonPayload(raw);
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

function resolveProvider(
  provider?: BrowserWalletProvider,
): BrowserWalletProvider | null {
  if (provider) {
    return provider;
  }

  if (
    typeof window !== "undefined" &&
    "ethereum" in window &&
    window.ethereum &&
    typeof window.ethereum === "object" &&
    "request" in window.ethereum
  ) {
    return window.ethereum as BrowserWalletProvider;
  }

  return null;
}

export function getBrowserWalletLabel(provider?: BrowserWalletProvider): string {
  const resolvedProvider = resolveProvider(provider);
  if (!resolvedProvider) {
    return "No wallet detected";
  }
  if (resolvedProvider.isRabby) {
    return "Rabby Wallet";
  }
  if (resolvedProvider.isCoinbaseWallet) {
    return "Coinbase Wallet";
  }
  if (resolvedProvider.isBraveWallet) {
    return "Brave Wallet";
  }
  if (resolvedProvider.isMetaMask) {
    return "MetaMask";
  }
  return "Browser Wallet";
}

async function loadSdkRuntime(
  config: Pick<
    GenLayerClientConfig,
    "network" | "sdkOverride" | "chainsOverride" | "typesOverride"
  >,
): Promise<SdkRuntime> {
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
  const chain = resolveChain(sdkChains, config.network);

  if (!createClient || !transactionStatus) {
    throw new Error(
      "genlayer-js did not expose the expected createClient or TransactionStatus exports.",
    );
  }

  if (!chain) {
    throw new Error(`Unsupported GenLayer network "${config.network}".`);
  }

  return {
    createClient,
    createAccount,
    transactionStatus,
    chain,
  };
}

async function createBrowserClients(config: BrowserGenLayerClientConfig): Promise<{
  address: `0x${string}`;
  provider: BrowserWalletProvider;
  readClient: Record<string, unknown>;
  writeClient: Record<string, unknown>;
  transactionStatus: Record<string, string>;
}> {
  if (!config.network || !config.rpcUrl) {
    throw new Error(
      "NEXT_PUBLIC_GENLAYER_NETWORK and NEXT_PUBLIC_GENLAYER_RPC_URL must be configured for browser wallet submission.",
    );
  }

  const provider = resolveProvider(config.provider);
  if (!provider) {
    throw new Error(
      "No browser wallet provider was found. Install or enable a compatible wallet.",
    );
  }

  const runtime = await loadSdkRuntime(config);
  const requestedAccounts = await provider.request({
    method: config.walletAddress ? "eth_accounts" : "eth_requestAccounts",
  });
  const accounts = Array.isArray(requestedAccounts) ? requestedAccounts : [];
  const address =
    config.walletAddress ??
    (typeof accounts[0] === "string"
      ? (accounts[0] as `0x${string}`)
      : undefined);

  if (!address) {
    throw new Error("No wallet account is currently connected.");
  }

  const readClient = runtime.createClient({
    chain: runtime.chain,
    endpoint: config.rpcUrl,
  });
  const writeClient = runtime.createClient({
    chain: runtime.chain,
    endpoint: config.rpcUrl,
    account: address,
    provider,
  });

  const connect = writeClient.connect as
    | ((network: string) => Promise<unknown>)
    | undefined;
  if (connect && config.network) {
    await connect(config.network);
  }

  return {
    address,
    provider,
    readClient,
    writeClient,
    transactionStatus: runtime.transactionStatus,
  };
}

function buildPendingResult(
  request: GenLayerReviewRequest,
  config: BrowserGenLayerClientConfig,
  transactionHash: string,
  receiptStatus: string,
): GenLayerExecutionResult {
  return GenLayerExecutionResultSchema.parse({
    status: "CONSENSUS_PENDING",
    network: config.network,
    contractAddress: config.contractAddress,
    transactionHash,
    receiptStatus,
    judgment: null,
    parserMessage: `Transaction ${transactionHash} is accepted on ${request.repository.owner}/${request.repository.name}, but final validator agreement is still pending.`,
  });
}

async function parseExecutionReceipt(input: {
  request: GenLayerReviewRequest;
  config: Pick<GenLayerClientConfig, "network" | "contractAddress">;
  client: Record<string, unknown>;
  receipt: Record<string, unknown>;
  transactionHash: string;
}): Promise<GenLayerExecutionResult> {
  const receiptStatus = resolveReceiptStatus(input.receipt);
  const txExecutionResultName =
    typeof input.receipt.txExecutionResultName === "string"
      ? input.receipt.txExecutionResultName
      : undefined;

  if (txExecutionResultName === "NOT_VOTED") {
    return GenLayerExecutionResultSchema.parse({
      status: "CONSENSUS_PENDING",
      network: input.config.network,
      contractAddress: input.config.contractAddress,
      transactionHash: input.transactionHash,
      receiptStatus,
      judgment: null,
      parserMessage:
        "Consensus receipt is available, but execution result is still NOT_VOTED.",
    });
  }

  if (txExecutionResultName === "FINISHED_WITH_ERROR") {
    return GenLayerExecutionResultSchema.parse({
      status: "TRANSACTION_FAILED",
      network: input.config.network,
      contractAddress: input.config.contractAddress,
      transactionHash: input.transactionHash,
      receiptStatus,
      judgment: null,
      errorClassification: "execution_failed",
      parserMessage:
        typeof input.receipt.result === "string"
          ? input.receipt.result
          : "Contract execution finished with error.",
    });
  }

  let judgment: GenLayerJudgment | null = null;
  try {
    judgment = parseJudgmentPayload(input.receipt.result);
  } catch {
    judgment = await fallbackReadJudgment(
      input.client,
      input.config.contractAddress ?? "",
      input.request.submissionId,
    );
  }

  if (!judgment) {
    return GenLayerExecutionResultSchema.parse({
      status: "UNEXPECTED_RESULT",
      network: input.config.network,
      contractAddress: input.config.contractAddress,
      transactionHash: input.transactionHash,
      receiptStatus,
      judgment: null,
      errorClassification: "result_parse_failed",
      parserMessage:
        "Transaction completed, but no parseable judgment payload was returned.",
    });
  }

  return GenLayerExecutionResultSchema.parse({
    status:
      judgment.decision === "ACCEPT_FOR_SCORING"
        ? "CONSENSUS_ACCEPTED"
        : "CONSENSUS_REJECTED",
    network: input.config.network,
    contractAddress: input.config.contractAddress,
    transactionHash: input.transactionHash,
    receiptStatus,
    judgment,
    parserMessage: "Live GenLayer receipt parsed successfully.",
  });
}

export function isBrowserWalletAvailable(provider?: BrowserWalletProvider): boolean {
  return resolveProvider(provider) !== null;
}

export async function connectBrowserWallet(
  config: BrowserGenLayerClientConfig,
): Promise<{ address: `0x${string}`; network: string }> {
  const browserClients = await createBrowserClients(config);
  return {
    address: browserClients.address,
    network: config.network ?? "unknown",
  };
}

export async function disconnectBrowserWallet(
  provider?: BrowserWalletProvider,
): Promise<{ revoked: boolean; message: string }> {
  const resolvedProvider = resolveProvider(provider);
  if (!resolvedProvider) {
    return {
      revoked: false,
      message: "No browser wallet provider is available.",
    };
  }

  try {
    await resolvedProvider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
    return {
      revoked: true,
      message: "Wallet account permission was revoked by the provider.",
    };
  } catch {
    return {
      revoked: false,
      message:
        "The wallet provider did not expose permission revocation, so GenForge cleared the local wallet session.",
    };
  }
}

async function parseBrowserContractReceipt(input: {
  config: Pick<GenLayerClientConfig, "network" | "contractAddress">;
  client: Record<string, unknown>;
  receipt: Record<string, unknown>;
  transactionHash: string;
  readback?: BrowserContractReadback;
}): Promise<BrowserContractExecutionResult> {
  const receiptStatus = resolveReceiptStatus(input.receipt);
  const txExecutionResultName =
    typeof input.receipt.txExecutionResultName === "string"
      ? input.receipt.txExecutionResultName
      : undefined;

  if (txExecutionResultName === "NOT_VOTED") {
    return {
      status: "CONSENSUS_PENDING",
      network: input.config.network,
      contractAddress: input.config.contractAddress,
      transactionHash: input.transactionHash,
      receiptStatus,
      parserMessage:
        "Consensus receipt is available, but execution result is still NOT_VOTED.",
    };
  }

  if (txExecutionResultName === "FINISHED_WITH_ERROR") {
    return {
      status: "TRANSACTION_FAILED",
      network: input.config.network,
      contractAddress: input.config.contractAddress,
      transactionHash: input.transactionHash,
      receiptStatus,
      errorClassification: "execution_failed",
      parserMessage:
        typeof input.receipt.result === "string"
          ? input.receipt.result
          : "Contract execution finished with error.",
    };
  }

  let result: unknown = null;
  try {
    result = parseJsonPayload(input.receipt.result);
  } catch {
    result = await fallbackReadJson(
      input.client,
      input.config.contractAddress ?? "",
      input.readback,
    );
  }

  if (result == null) {
    result = await fallbackReadJson(
      input.client,
      input.config.contractAddress ?? "",
      input.readback,
    );
  }

  if (result == null) {
    return {
      status: "UNEXPECTED_RESULT",
      network: input.config.network,
      contractAddress: input.config.contractAddress,
      transactionHash: input.transactionHash,
      receiptStatus,
      errorClassification: "result_parse_failed",
      parserMessage:
        "Transaction completed, but no parseable JSON payload was returned.",
    };
  }

  return {
    status: "FINALIZED",
    network: input.config.network,
    contractAddress: input.config.contractAddress,
    transactionHash: input.transactionHash,
    receiptStatus,
    parserMessage: "Live GenLayer receipt parsed successfully.",
    result,
  };
}

export async function submitGenLayerReviewFromBrowser(
  request: GenLayerReviewRequest,
  config: BrowserGenLayerClientConfig,
): Promise<GenLayerExecutionResult> {
  if (request.gate.decision !== "ACCEPT_FOR_SCORING") {
    return GenLayerExecutionResultSchema.parse({
      status: "SKIPPED_BY_GATE",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      parserMessage:
        "Fix deterministic gate findings before asking a wallet to submit the review on-chain.",
    });
  }

  if (!config.contractAddress) {
    return GenLayerExecutionResultSchema.parse({
      status: "GENLAYER_NOT_CONFIGURED",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      errorClassification: "missing_configuration",
      parserMessage:
        "NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS must be configured before browser wallet submission can call review_submission.",
    });
  }

  try {
    const browserClients = await createBrowserClients(config);
    const writeContract = browserClients.writeClient.writeContract as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    const waitForTransactionReceipt = browserClients.readClient
      .waitForTransactionReceipt as
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
          "Installed genlayer-js version does not expose the expected browser wallet methods.",
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

    const acceptedReceipt = (await waitForTransactionReceipt({
      hash: transactionHash,
      status: browserClients.transactionStatus.ACCEPTED ?? "ACCEPTED",
      fullTransaction: false,
      interval: config.waitIntervalMs ?? 5000,
      retries: config.waitRetries ?? 24,
    })) as Record<string, unknown>;

    const acceptedStatus = resolveReceiptStatus(acceptedReceipt);
    if (acceptedStatus !== (browserClients.transactionStatus.FINALIZED ?? "FINALIZED")) {
      return buildPendingResult(
        request,
        config,
        transactionHash,
        acceptedStatus,
      );
    }

    return parseExecutionReceipt({
      request,
      config,
      client: browserClients.readClient,
      receipt: acceptedReceipt,
      transactionHash,
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

export async function submitBrowserContractJson(
  call: BrowserContractJsonCall,
  config: BrowserGenLayerClientConfig,
): Promise<BrowserContractExecutionResult> {
  if (!config.contractAddress) {
    return {
      status: "GENLAYER_NOT_CONFIGURED",
      network: config.network,
      contractAddress: config.contractAddress,
      errorClassification: "missing_configuration",
      parserMessage:
        "A GenLayer contract address must be configured before browser wallet submission can call this method.",
    };
  }

  try {
    const browserClients = await createBrowserClients(config);
    const writeContract = browserClients.writeClient.writeContract as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    const waitForTransactionReceipt = browserClients.readClient
      .waitForTransactionReceipt as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;

    if (!writeContract || !waitForTransactionReceipt) {
      return {
        status: "GENLAYER_UNAVAILABLE",
        network: config.network,
        contractAddress: config.contractAddress,
        errorClassification: "sdk_method_missing",
        parserMessage:
          "Installed genlayer-js version does not expose the expected browser wallet methods.",
      };
    }

    const transactionHash = (await writeContract({
      address: config.contractAddress,
      functionName: call.functionName,
      args: call.args,
      value: BigInt(0),
    })) as string;

    if (!transactionHash || typeof transactionHash !== "string") {
      return {
        status: "UNEXPECTED_RESULT",
        network: config.network,
        contractAddress: config.contractAddress,
        errorClassification: "missing_transaction_hash",
        parserMessage: "writeContract returned without a transaction hash.",
      };
    }

    const acceptedReceipt = (await waitForTransactionReceipt({
      hash: transactionHash,
      status: browserClients.transactionStatus.ACCEPTED ?? "ACCEPTED",
      fullTransaction: false,
      interval: config.waitIntervalMs ?? 5000,
      retries: config.waitRetries ?? 24,
    })) as Record<string, unknown>;

    const acceptedStatus = resolveReceiptStatus(acceptedReceipt);
    if (acceptedStatus !== (browserClients.transactionStatus.FINALIZED ?? "FINALIZED")) {
      return {
        status: "CONSENSUS_PENDING",
        network: config.network,
        contractAddress: config.contractAddress,
        transactionHash,
        receiptStatus: acceptedStatus,
        parserMessage:
          "Transaction was accepted, but final validator agreement is still pending.",
      };
    }

    return parseBrowserContractReceipt({
      config,
      client: browserClients.readClient,
      receipt: acceptedReceipt,
      transactionHash,
      readback: call.readback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return {
      status: /rejected|denied|insufficient|nonce/i.test(message)
        ? "TRANSACTION_REJECTED"
        : "GENLAYER_UNAVAILABLE",
      network: config.network,
      contractAddress: config.contractAddress,
      errorClassification: /rejected|denied|insufficient|nonce/i.test(message)
        ? "transaction_rejected"
        : "sdk_call_failed",
      parserMessage: message,
    };
  }
}

export async function trackBrowserContractJsonTransaction(
  transactionHash: string,
  call: Pick<BrowserContractJsonCall, "readback">,
  config: BrowserGenLayerClientConfig,
): Promise<BrowserContractExecutionResult> {
  if (!config.contractAddress) {
    return {
      status: "GENLAYER_NOT_CONFIGURED",
      network: config.network,
      contractAddress: config.contractAddress,
      errorClassification: "missing_configuration",
      parserMessage:
        "A GenLayer contract address must be configured before transaction tracking can read this method result.",
    };
  }

  try {
    const browserClients = await createBrowserClients(config);
    const waitForTransactionReceipt = browserClients.readClient
      .waitForTransactionReceipt as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;

    if (!waitForTransactionReceipt) {
      return {
        status: "GENLAYER_UNAVAILABLE",
        network: config.network,
        contractAddress: config.contractAddress,
        errorClassification: "sdk_method_missing",
        parserMessage:
          "Installed genlayer-js version does not expose waitForTransactionReceipt for transaction tracking.",
      };
    }

    const finalizedReceipt = (await waitForTransactionReceipt({
      hash: transactionHash,
      status: browserClients.transactionStatus.FINALIZED ?? "FINALIZED",
      fullTransaction: false,
      interval: config.waitIntervalMs ?? 5000,
      retries: config.waitRetries ?? 40,
    })) as Record<string, unknown>;

    return parseBrowserContractReceipt({
      config,
      client: browserClients.readClient,
      receipt: finalizedReceipt,
      transactionHash,
      readback: call.readback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return {
      status: "GENLAYER_UNAVAILABLE",
      network: config.network,
      contractAddress: config.contractAddress,
      errorClassification: "sdk_call_failed",
      parserMessage: message,
    };
  }
}

export async function trackGenLayerReviewTransaction(
  request: GenLayerReviewRequest,
  transactionHash: string,
  config: BrowserGenLayerClientConfig,
): Promise<GenLayerExecutionResult> {
  if (!config.contractAddress) {
    return GenLayerExecutionResultSchema.parse({
      status: "GENLAYER_NOT_CONFIGURED",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      errorClassification: "missing_configuration",
      parserMessage:
        "NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS must be configured before transaction tracking can read review results.",
    });
  }

  try {
    const browserClients = await createBrowserClients(config);
    const waitForTransactionReceipt = browserClients.readClient
      .waitForTransactionReceipt as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;

    if (!waitForTransactionReceipt) {
      return GenLayerExecutionResultSchema.parse({
        status: "GENLAYER_UNAVAILABLE",
        network: config.network,
        contractAddress: config.contractAddress,
        judgment: null,
        errorClassification: "sdk_method_missing",
        parserMessage:
          "Installed genlayer-js version does not expose waitForTransactionReceipt for transaction tracking.",
      });
    }

    const finalizedReceipt = (await waitForTransactionReceipt({
      hash: transactionHash,
      status: browserClients.transactionStatus.FINALIZED ?? "FINALIZED",
      fullTransaction: false,
      interval: config.waitIntervalMs ?? 5000,
      retries: config.waitRetries ?? 40,
    })) as Record<string, unknown>;

    return parseExecutionReceipt({
      request,
      config,
      client: browserClients.readClient,
      receipt: finalizedReceipt,
      transactionHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return GenLayerExecutionResultSchema.parse({
      status: "GENLAYER_UNAVAILABLE",
      network: config.network,
      contractAddress: config.contractAddress,
      judgment: null,
      errorClassification: "sdk_call_failed",
      parserMessage: message,
    });
  }
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
    const runtime = await loadSdkRuntime(config);

    if (!runtime.createAccount) {
      return GenLayerExecutionResultSchema.parse({
        status: "GENLAYER_UNAVAILABLE",
        network: config.network,
        contractAddress: config.contractAddress,
        judgment: null,
        errorClassification: "sdk_unavailable",
        parserMessage:
          "genlayer-js did not expose the expected createAccount export.",
      });
    }

    const account = runtime.createAccount(config.privateKey);
    const client = runtime.createClient({
      chain: runtime.chain,
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
      status: runtime.transactionStatus.FINALIZED,
      fullTransaction: false,
    })) as Record<string, unknown>;
    return parseExecutionReceipt({
      request,
      config,
      client,
      receipt,
      transactionHash,
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
