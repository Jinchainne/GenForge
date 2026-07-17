import type { GenLayerClientConfig } from "@genforge/genlayer-client";

export interface PublicGenLayerConfig {
  network?: GenLayerClientConfig["network"];
  contractAddress?: string;
  disputeContractAddress?: string;
  rpcUrl?: string;
  studioUrl: string;
}

const publicConfig: PublicGenLayerConfig = {
  network: ((process.env.NEXT_PUBLIC_GENLAYER_NETWORK as
    | GenLayerClientConfig["network"]
    | undefined) ??
    "studionet") as GenLayerClientConfig["network"],
  contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
  disputeContractAddress:
    process.env.NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS,
  rpcUrl:
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ??
    "https://studio.genlayer.com/api",
  studioUrl:
    process.env.NEXT_PUBLIC_GENLAYER_STUDIO_URL ?? "https://studio.genlayer.com",
};

export function getPublicGenLayerConfig(): PublicGenLayerConfig {
  return publicConfig;
}

export function getWalletConfigIssues(
  config: PublicGenLayerConfig,
): string[] {
  const issues: string[] = [];

  if (!config.network) {
    issues.push("NEXT_PUBLIC_GENLAYER_NETWORK is missing.");
  }
  if (!config.rpcUrl) {
    issues.push("NEXT_PUBLIC_GENLAYER_RPC_URL is missing.");
  }

  return issues;
}

export function getSubmissionConfigIssues(
  config: PublicGenLayerConfig,
): string[] {
  const issues = getWalletConfigIssues(config);

  if (!config.contractAddress) {
    issues.push("NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS is missing.");
  }

  return issues;
}

export function getDisputeSubmissionConfigIssues(
  config: PublicGenLayerConfig,
): string[] {
  const issues = getWalletConfigIssues(config);

  if (!config.disputeContractAddress) {
    issues.push("NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS is missing.");
  }

  return issues;
}
