import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

type ParsedRecord = Record<string, string | boolean>;

export interface GenLayerCliStatus {
  cliAvailable: boolean;
  observedAt: string;
  network: {
    alias: string;
    name: string;
    chainId: string;
    rpc: string;
    mainContract: string;
    explorer: string;
  } | null;
  account: {
    name: string;
    address: string;
    balance: string;
    network: string;
    status: string;
    active: boolean;
  } | null;
  publicRuntime: {
    network?: string;
    rpcUrl?: string;
    reviewContractAddress?: string;
    disputeContractAddress?: string;
  };
  deployReadiness: {
    status:
      | "ready_to_deploy"
      | "blocked"
      | "cli_unavailable"
      | "operator_disabled";
    blockers: string[];
    commands: Array<{
      id: "review" | "dispute";
      label: string;
      command: string;
    }>;
  };
}

export interface DeployAttemptResult {
  ok: boolean;
  contract: "review" | "dispute";
  command: string;
  stdout: string;
  stderr: string;
  observedAt: string;
}

function extractResultBlock(output: string): ParsedRecord | null {
  const match = output.match(/Result:\s*\{([\s\S]*?)\}\s*/);
  if (!match) {
    return null;
  }

  const block = match[1];
  const parsed: ParsedRecord = {};

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line || !line.includes(":")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const key = line.slice(0, separatorIndex).trim();
    const valueToken = line.slice(separatorIndex + 1).trim();

    if (valueToken === "true" || valueToken === "false") {
      parsed[key] = valueToken === "true";
      continue;
    }

    parsed[key] = valueToken.replace(/^'/, "").replace(/'$/, "");
  }

  return parsed;
}

async function runGenLayer(args: string[]): Promise<string> {
  const result = await execFileAsync("genlayer", args, {
    cwd: process.cwd(),
    windowsHide: true,
  });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function getRepoRoot(): string {
  return path.resolve(process.cwd(), "..", "..");
}

function getDeployCommand(contract: "review" | "dispute"): string {
  const contractFile =
    contract === "review"
      ? "contracts/genforge_judge/review_submission.py"
      : "contracts/genforge_judge/resolve_enterprise_dispute.py";

  return `genlayer deploy --contract ${contractFile}`;
}

export async function getGenLayerCliStatus(): Promise<GenLayerCliStatus> {
  const observedAt = new Date().toISOString();
  const publicRuntime = {
    network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
    rpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL,
    reviewContractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
    disputeContractAddress:
      process.env.NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS,
  };

  const commands = [
    {
      id: "review" as const,
      label: "Deploy repository review judge",
      command: getDeployCommand("review"),
    },
    {
      id: "dispute" as const,
      label: "Deploy enterprise dispute judge",
      command: getDeployCommand("dispute"),
    },
  ];

  try {
    const [networkOutput, accountOutput] = await Promise.all([
      runGenLayer(["network", "info"]),
      runGenLayer(["account", "show"]),
    ]);
    const network = extractResultBlock(networkOutput);
    const account = extractResultBlock(accountOutput);

    const blockers: string[] = [];
    const balance = typeof account?.balance === "string" ? account.balance : "";

    if (!balance || /^0(\.0+)?\s+GEN$/i.test(balance)) {
      blockers.push(
        "The active GenLayer account has 0 GEN, so live deployment cannot proceed.",
      );
    }
    if (!publicRuntime.reviewContractAddress) {
      blockers.push(
        "NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS is not configured for the repository review contract.",
      );
    }
    if (!publicRuntime.disputeContractAddress) {
      blockers.push(
        "NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS is not configured for the dispute contract.",
      );
    }

    return {
      cliAvailable: true,
      observedAt,
      network: network
        ? {
            alias: String(network.alias ?? ""),
            name: String(network.name ?? ""),
            chainId: String(network.chainId ?? ""),
            rpc: String(network.rpc ?? ""),
            mainContract: String(network.mainContract ?? ""),
            explorer: String(network.explorer ?? ""),
          }
        : null,
      account: account
        ? {
            name: String(account.name ?? ""),
            address: String(account.address ?? ""),
            balance: String(account.balance ?? ""),
            network: String(account.network ?? ""),
            status: String(account.status ?? ""),
            active: Boolean(account.active),
          }
        : null,
      publicRuntime,
      deployReadiness: {
        status: blockers.length === 0 ? "ready_to_deploy" : "blocked",
        blockers,
        commands,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GenLayer CLI unavailable.";

    return {
      cliAvailable: false,
      observedAt,
      network: null,
      account: null,
      publicRuntime,
      deployReadiness: {
        status: "cli_unavailable",
        blockers: [message],
        commands,
      },
    };
  }
}

export async function attemptOperatorDeploy(
  contract: "review" | "dispute",
): Promise<DeployAttemptResult> {
  const observedAt = new Date().toISOString();
  const enabled = process.env.GENFORGE_ENABLE_OPERATOR_DEPLOY === "true";
  const command = getDeployCommand(contract);

  if (!enabled) {
    return {
      ok: false,
      contract,
      command,
      stdout: "",
      stderr:
        "Operator deployment is disabled. Set GENFORGE_ENABLE_OPERATOR_DEPLOY=true in a secure environment before using this endpoint.",
      observedAt,
    };
  }

  const repoRoot = getRepoRoot();
  const contractFile =
    contract === "review"
      ? path.join(repoRoot, "contracts", "genforge_judge", "review_submission.py")
      : path.join(
          repoRoot,
          "contracts",
          "genforge_judge",
          "resolve_enterprise_dispute.py",
        );

  try {
    const result = await execFileAsync(
      "genlayer",
      ["deploy", "--contract", contractFile],
      {
        cwd: repoRoot,
        windowsHide: true,
      },
    );

    return {
      ok: true,
      contract,
      command,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      observedAt,
    };
  } catch (error) {
    const details =
      error && typeof error === "object" && "stdout" in error && "stderr" in error
        ? error
        : null;

    return {
      ok: false,
      contract,
      command,
      stdout: typeof details?.stdout === "string" ? details.stdout : "",
      stderr:
        typeof details?.stderr === "string"
          ? details.stderr
          : error instanceof Error
            ? error.message
            : "Deployment failed unexpectedly.",
      observedAt,
    };
  }
}
