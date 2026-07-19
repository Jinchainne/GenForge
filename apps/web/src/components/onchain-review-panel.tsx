"use client";

import type { ReviewReport } from "@genforge/domain";
import type { PublicGenLayerConfig } from "@/lib/public-genlayer-config";
import type { OnchainWorkflowState, WalletConnectionState } from "@/lib/review-workflow";
import { canRequestOnchainAdjudication } from "@/lib/review-workflow";

export function OnchainReviewPanel({
  report,
  publicConfig,
  walletConfigIssues,
  submissionConfigIssues,
  wallet,
  onchain,
  busy,
  onConnectWallet,
  onDisconnectWallet,
  onSubmitOnchain,
  onRefreshStatus,
}: {
  report: ReviewReport;
  publicConfig: PublicGenLayerConfig;
  walletConfigIssues: string[];
  submissionConfigIssues: string[];
  wallet: WalletConnectionState;
  onchain: OnchainWorkflowState;
  busy: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onSubmitOnchain: () => void;
  onRefreshStatus: () => void;
}) {
  const canSubmit = canRequestOnchainAdjudication(report);
  const txHash = onchain.result?.transactionHash;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">GenLayer Adjudication</div>
          <h3>Wallet-Signed On-Chain Review</h3>
        </div>
        <span>{onchain.result?.status ?? "Not submitted"}</span>
      </div>

      <dl className="source-grid">
        <div>
          <dt>Wallet</dt>
          <dd>
            {wallet.address
              ? `${wallet.providerLabel ?? "Browser Wallet"}: ${wallet.address}`
              : wallet.providerLabel ?? "Not connected"}
          </dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{publicConfig.network ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd>{publicConfig.contractAddress ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Studio</dt>
          <dd>
            <a href={publicConfig.studioUrl} target="_blank" rel="noreferrer">
              {publicConfig.studioUrl}
            </a>
          </dd>
        </div>
      </dl>

      {walletConfigIssues.length > 0 ? (
        <div className="error-callout">
          <strong>Wallet connection config missing</strong>
          <ul className="stack-list compact-list">
            {walletConfigIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {submissionConfigIssues.length > walletConfigIssues.length ? (
        <div className="callout">
          <strong>Submission config still incomplete</strong>
          <p>
            A compatible browser wallet can connect once the runtime is available, but
            on-chain submission still needs a deployed contract address.
          </p>
        </div>
      ) : null}

      {!canSubmit ? (
        <div className="callout">
          <strong>Blocked by deterministic gate</strong>
          <p>
            Fix the triggered findings first, then resubmit the repository to
            generate a report that is eligible for GenLayer adjudication.
          </p>
        </div>
      ) : null}

      <div className="action-row">
        <button
          type="button"
          className="secondary-button"
          onClick={onConnectWallet}
          disabled={busy || wallet.status === "connected"}
        >
          {wallet.status === "connected" ? "Wallet Connected" : "Connect Wallet"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onDisconnectWallet}
          disabled={busy || wallet.status !== "connected"}
        >
          Disconnect
        </button>
        <button
          type="button"
          onClick={onSubmitOnchain}
          disabled={
            busy ||
            !canSubmit ||
            wallet.status !== "connected" ||
            submissionConfigIssues.length > 0
          }
        >
          {onchain.status === "submitting"
            ? "Submitting..."
            : "Submit Review On-Chain"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onRefreshStatus}
          disabled={busy || !txHash}
        >
          Refresh Receipt
        </button>
      </div>

      <div className="callout">
        <strong>Current workflow state</strong>
        <p>{wallet.message ?? onchain.message}</p>
        {txHash ? (
          <p className="mono-line">
            Transaction: <span>{txHash}</span>
          </p>
        ) : null}
        {onchain.result?.receiptStatus ? (
          <p className="mono-line">
            Receipt: <span>{onchain.result.receiptStatus}</span>
          </p>
        ) : null}
        {onchain.result?.judgment ? (
          <p>{onchain.result.judgment.summary}</p>
        ) : null}
      </div>
    </section>
  );
}
