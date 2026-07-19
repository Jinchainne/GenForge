"use client";

import { useMemo, useState } from "react";
import {
  connectBrowserWallet,
  disconnectBrowserWallet,
  getBrowserWalletLabel,
  isBrowserWalletAvailable,
  submitBrowserContractJson,
  trackBrowserContractJsonTransaction,
} from "@genforge/genlayer-client";
import type { BrowserContractExecutionResult } from "@genforge/genlayer-client";
import {
  getPublicGenLayerConfig,
  getTokenDeploymentConfigIssues,
  getWalletConfigIssues,
} from "@/lib/public-genlayer-config";
import type { WalletConnectionState } from "@/lib/review-workflow";

type TokenDeployState =
  | "idle"
  | "ready"
  | "blocked"
  | "submitting"
  | "tracking"
  | "finalized"
  | "failed";

export function TokenLaunchDashboard() {
  const publicConfig = getPublicGenLayerConfig();
  const walletIssues = getWalletConfigIssues(publicConfig);
  const tokenConfigIssues = getTokenDeploymentConfigIssues(publicConfig);
  const [wallet, setWallet] = useState<WalletConnectionState>({
    status: isBrowserWalletAvailable() ? "disconnected" : "missing_provider",
    message: isBrowserWalletAvailable()
      ? "Connect a browser wallet before creating a wallet-signed token deployment."
      : "No browser wallet provider was detected in this browser.",
    providerLabel: getBrowserWalletLabel(),
  });
  const [busy, setBusy] = useState(false);
  const [deployState, setDeployState] = useState<{
    status: TokenDeployState;
    message: string;
    result?: BrowserContractExecutionResult;
  }>({
    status: tokenConfigIssues.length === 0 ? "ready" : "blocked",
    message:
      tokenConfigIssues.length === 0
        ? "Token factory runtime is configured. Connect a wallet to submit."
        : "Configure the GenLayer token factory before deploying a project token.",
  });
  const [form, setForm] = useState({
    projectName: "GenForge Builder Track",
    tokenName: "GenForge Review Credit",
    tokenSymbol: "GFRC",
    initialSupply: "1000000",
    decimals: "18",
    recipient: "",
    purpose:
      "Reward accepted GenLayer builder submissions after deterministic evidence and validator review.",
  });

  const deploymentRequest = useMemo(
    () => ({
      deploymentId: `token-${form.tokenSymbol.toLowerCase()}-${form.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`,
      projectName: form.projectName,
      tokenName: form.tokenName,
      tokenSymbol: form.tokenSymbol.toUpperCase(),
      initialSupply: form.initialSupply,
      decimals: Number.parseInt(form.decimals, 10),
      recipient: form.recipient || wallet.address || null,
      purpose: form.purpose,
      evidenceBoundary:
        "Token deployment is wallet-signed and only valid when a configured GenLayer factory returns a real transaction receipt.",
    }),
    [form, wallet.address],
  );

  async function handleConnectWallet() {
    if (!isBrowserWalletAvailable()) {
      setWallet({
        status: "missing_provider",
        message:
          "An injected browser wallet is required for GenLayer token deployment.",
        providerLabel: getBrowserWalletLabel(),
      });
      return;
    }

    setBusy(true);
    setWallet({
      status: "connecting",
      message: "Requesting wallet access and switching to the configured network.",
    });

    try {
      const connection = await connectBrowserWallet({
        network: publicConfig.network,
        contractAddress: publicConfig.tokenFactoryAddress,
        rpcUrl: publicConfig.rpcUrl,
      });
      setWallet({
        status: "connected",
        address: connection.address,
        network: connection.network,
        providerLabel: getBrowserWalletLabel(),
        message: `${getBrowserWalletLabel()} connected on ${connection.network}.`,
      });
      setForm((current) => ({
        ...current,
        recipient: current.recipient || connection.address,
      }));
    } catch (error) {
      setWallet({
        status: "error",
        providerLabel: getBrowserWalletLabel(),
        message:
          error instanceof Error ? error.message : "Failed to connect wallet.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnectWallet() {
    setBusy(true);
    const result = await disconnectBrowserWallet();
    setWallet({
      status: isBrowserWalletAvailable() ? "disconnected" : "missing_provider",
      providerLabel: getBrowserWalletLabel(),
      message: result.message,
    });
    setBusy(false);
  }

  async function handleDeployToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setDeployState({
      status: "submitting",
      message: "Waiting for wallet signature and GenLayer token factory acceptance.",
    });

    try {
      const result = await submitBrowserContractJson(
        {
          functionName: publicConfig.tokenFactoryMethod,
          args: [JSON.stringify(deploymentRequest)],
          readback: publicConfig.tokenFactoryReadbackMethod
            ? {
                functionName: publicConfig.tokenFactoryReadbackMethod,
                args: [deploymentRequest.deploymentId],
              }
            : undefined,
        },
        {
          network: publicConfig.network,
          contractAddress: publicConfig.tokenFactoryAddress,
          rpcUrl: publicConfig.rpcUrl,
          walletAddress: wallet.address as `0x${string}` | undefined,
        },
      );

      setDeployState({
        status:
          result.status === "FINALIZED"
            ? "finalized"
            : result.status === "CONSENSUS_PENDING"
              ? "tracking"
              : "failed",
        message:
          result.parserMessage ??
          "Token deployment request completed without a parser message.",
        result,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshReceipt() {
    const txHash = deployState.result?.transactionHash;
    if (!txHash) {
      return;
    }

    setBusy(true);
    setDeployState((current) => ({
      ...current,
      status: "tracking",
      message: "Refreshing token deployment receipt from GenLayer.",
    }));

    try {
      const result = await trackBrowserContractJsonTransaction(
        txHash,
        {
          readback: publicConfig.tokenFactoryReadbackMethod
            ? {
                functionName: publicConfig.tokenFactoryReadbackMethod,
                args: [deploymentRequest.deploymentId],
              }
            : undefined,
        },
        {
          network: publicConfig.network,
          contractAddress: publicConfig.tokenFactoryAddress,
          rpcUrl: publicConfig.rpcUrl,
          walletAddress: wallet.address as `0x${string}` | undefined,
        },
      );

      setDeployState({
        status:
          result.status === "FINALIZED"
            ? "finalized"
            : result.status === "CONSENSUS_PENDING"
              ? "tracking"
              : "failed",
        message:
          result.parserMessage ??
          "Receipt refresh completed without a parser message.",
        result,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="token-shell">
      <div className="submission-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Deployment Request</div>
              <h3>Project token parameters</h3>
            </div>
            <span>{deployState.status}</span>
          </div>
          <form className="submission-form" onSubmit={handleDeployToken}>
            <label htmlFor="project-name">Project or track name</label>
            <input
              id="project-name"
              value={form.projectName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  projectName: event.target.value,
                }))
              }
              required
            />
            <div className="field-grid">
              <div>
                <label htmlFor="token-name">Token name</label>
                <input
                  id="token-name"
                  value={form.tokenName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tokenName: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label htmlFor="token-symbol">Symbol</label>
                <input
                  id="token-symbol"
                  value={form.tokenSymbol}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tokenSymbol: event.target.value,
                    }))
                  }
                  maxLength={12}
                  required
                />
              </div>
            </div>
            <div className="field-grid">
              <div>
                <label htmlFor="initial-supply">Initial supply</label>
                <input
                  id="initial-supply"
                  inputMode="numeric"
                  value={form.initialSupply}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      initialSupply: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label htmlFor="token-decimals">Decimals</label>
                <input
                  id="token-decimals"
                  inputMode="numeric"
                  value={form.decimals}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      decimals: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
            <label htmlFor="token-recipient">Recipient wallet</label>
            <input
              id="token-recipient"
              value={form.recipient}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  recipient: event.target.value,
                }))
              }
              placeholder="Connect wallet or paste recipient address"
            />
            <label htmlFor="token-purpose">Purpose and eligibility rule</label>
            <textarea
              id="token-purpose"
              className="dashboard-textarea"
              value={form.purpose}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  purpose: event.target.value,
                }))
              }
              required
            />
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={handleConnectWallet}
                disabled={busy || wallet.status === "connected"}
              >
                {wallet.status === "connected"
                  ? "Wallet Connected"
                  : "Connect Wallet"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleDisconnectWallet}
                disabled={busy || wallet.status !== "connected"}
              >
                Disconnect
              </button>
              <button
                type="submit"
                disabled={
                  busy ||
                  wallet.status !== "connected" ||
                  tokenConfigIssues.length > 0
                }
              >
                {busy ? "Submitting..." : "Record Reward Token"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleRefreshReceipt}
                disabled={busy || !deployState.result?.transactionHash}
              >
                Refresh Receipt
              </button>
            </div>
          </form>
        </section>

        <section className="panel hero-panel workbench-rail">
          <div className="eyebrow">Reward Token</div>
          <h2>Wallet-signed reward registry through a GenLayer factory</h2>
          <p>
            Prepare a bounded token request for accepted builder projects.
            Submission stays blocked until a real factory address and method are
            configured.
          </p>
          <div className="status-rail" aria-label="Token deployment workflow">
            <span className="done">Plan</span>
            <span className={wallet.status === "connected" ? "done" : "active"}>
              Wallet
            </span>
            <span className={tokenConfigIssues.length === 0 ? "done" : "active"}>
              Factory
            </span>
            <span className={deployState.status === "finalized" ? "done" : ""}>
              Receipt
            </span>
          </div>
          <dl className="rail-facts">
            <div>
              <dt>Factory</dt>
              <dd>{publicConfig.tokenFactoryAddress ?? "Not configured"}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{publicConfig.tokenFactoryMethod}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="content-grid">
        <div className="primary-column">
          <section className="panel">
            <div className="panel-header">
              <h3>Factory Readiness</h3>
              <span>{tokenConfigIssues.length === 0 ? "ready" : "blocked"}</span>
            </div>
            <dl className="source-grid">
              <div>
                <dt>Network</dt>
                <dd>{publicConfig.network ?? "Not configured"}</dd>
              </div>
              <div>
                <dt>RPC</dt>
                <dd>{publicConfig.rpcUrl ?? "Not configured"}</dd>
              </div>
              <div>
                <dt>Factory contract</dt>
                <dd>{publicConfig.tokenFactoryAddress ?? "Not configured"}</dd>
              </div>
              <div>
                <dt>Write method</dt>
                <dd>{publicConfig.tokenFactoryMethod}</dd>
              </div>
            </dl>
            {tokenConfigIssues.length > 0 ? (
              <div className="error-callout">
                <strong>Token deployment blocked</strong>
                <ul className="stack-list compact-list">
                  {tokenConfigIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {walletIssues.length > 0 ? (
              <div className="error-callout">
                <strong>Wallet runtime blocked</strong>
                <ul className="stack-list compact-list">
                  {walletIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Deployment Receipt</h3>
              <span>{deployState.result?.status ?? "not submitted"}</span>
            </div>
            <p className="subtle">{wallet.message}</p>
            <p className="subtle">{deployState.message}</p>
            {deployState.result?.transactionHash ? (
              <p className="mono-line">
                Transaction: {deployState.result.transactionHash}
              </p>
            ) : null}
            {deployState.result?.receiptStatus ? (
              <p className="mono-line">
                Receipt: {deployState.result.receiptStatus}
              </p>
            ) : null}
            {deployState.result?.result ? (
              <pre className="json-preview">
                {JSON.stringify(deployState.result.result, null, 2)}
              </pre>
            ) : null}
          </section>
        </div>

        <div className="secondary-column">
          <section className="panel">
            <div className="panel-header">
              <h3>Bounded Token Request</h3>
              <span>{deploymentRequest.tokenSymbol}</span>
            </div>
            <pre className="json-preview">
              {JSON.stringify(deploymentRequest, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </section>
  );
}
