"use client";

import { startTransition, useMemo, useState } from "react";
import type {
  ReviewErrorCode,
  ReviewReport,
  ReviewResponse,
} from "@genforge/domain";
import {
  connectBrowserWallet,
  isBrowserWalletAvailable,
  submitGenLayerReviewFromBrowser,
  trackGenLayerReviewTransaction,
} from "@genforge/genlayer-client";
import { DecisionBadge } from "./decision-badge";
import { EvidenceExplorer } from "./evidence-explorer";
import { FindingsPanel } from "./findings-panel";
import { ListPanel } from "./list-panel";
import { ProgressPanel } from "./progress-panel";
import { ScoreOverview } from "./score-overview";
import { SourceVerificationPanel } from "./source-verification-panel";
import { ConsensusPanel } from "./consensus-panel";
import { ConfidencePanel } from "./confidence-panel";
import { RankingPanel } from "./ranking-panel";
import { WorkflowPanel } from "./workflow-panel";
import { OnchainReviewPanel } from "./onchain-review-panel";
import { SubmissionHistoryPanel } from "./submission-history-panel";
import {
  applyLiveGenLayerResult,
  deriveOnchainWorkflowState,
  type OnchainWorkflowState,
  type ReviewAttempt,
  type WalletConnectionState,
} from "@/lib/review-workflow";
import {
  getPublicConfigIssues,
  getPublicGenLayerConfig,
} from "@/lib/public-genlayer-config";

type DashboardState =
  | "idle"
  | "validating_url"
  | "collecting_evidence"
  | "applying_deterministic_rules"
  | "waiting_for_genlayer_transaction"
  | "consensus_pending"
  | "partial_result"
  | "rejected"
  | "request_more_information"
  | "accepted_for_scoring"
  | "integration_unavailable"
  | "rate_limited"
  | "repository_unavailable"
  | "error";

function mapErrorCode(code: ReviewErrorCode): DashboardState {
  if (code === "RATE_LIMITED") {
    return "rate_limited";
  }
  if (
    code === "REPOSITORY_NOT_FOUND" ||
    code === "PRIVATE_REPOSITORY" ||
    code === "GITHUB_UNAVAILABLE" ||
    code === "RESPONSE_TOO_LARGE"
  ) {
    return "repository_unavailable";
  }
  return "error";
}

export function ReviewDashboard() {
  const publicConfig = getPublicGenLayerConfig();
  const configIssues = getPublicConfigIssues(publicConfig);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [state, setState] = useState<DashboardState>("idle");
  const [currentAttempt, setCurrentAttempt] = useState<ReviewAttempt | null>(
    null,
  );
  const [history, setHistory] = useState<ReviewAttempt[]>([]);
  const [errorCode, setErrorCode] = useState<ReviewErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletConnectionState>({
    status: isBrowserWalletAvailable() ? "disconnected" : "missing_provider",
    message: isBrowserWalletAvailable()
      ? "Connect MetaMask to submit a bounded review request on-chain."
      : "No browser wallet provider was detected in this browser.",
  });
  const [busyOnchain, setBusyOnchain] = useState(false);

  const report: ReviewReport | null = useMemo(() => {
    if (!currentAttempt) {
      return null;
    }
    if (!currentAttempt.onchain.result) {
      return currentAttempt.report;
    }
    return applyLiveGenLayerResult(
      currentAttempt.report,
      currentAttempt.onchain.result,
    );
  }, [currentAttempt]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorCode(null);
    setErrorMessage(null);
    setState("validating_url");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repositoryUrl }),
      });

      setState("collecting_evidence");

      const payload = (await response.json()) as ReviewResponse;
      if (!payload.ok) {
        setErrorCode(payload.error.code);
        setErrorMessage(payload.error.message);
        setState(mapErrorCode(payload.error.code));
        return;
      }

      const nextAttempt: ReviewAttempt = {
        id: payload.report.reviewId,
        repositoryUrl,
        report: payload.report,
        reviewedAt: new Date().toISOString(),
        onchain: {
          status: "idle",
          message:
            payload.report.decision === "ACCEPT_FOR_SCORING"
              ? "The deterministic gate passed. Connect MetaMask to request on-chain adjudication."
              : "Fix the triggered findings, then resubmit this repository for another review attempt.",
        },
      };

      startTransition(() => {
        setHistory((previous) =>
          currentAttempt ? [currentAttempt, ...previous] : previous,
        );
        setCurrentAttempt(nextAttempt);
      });
      setState(payload.report.state);
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error.",
      );
    }
  }

  async function handleConnectWallet() {
    if (!isBrowserWalletAvailable()) {
      setWallet({
        status: "missing_provider",
        message:
          "MetaMask or another compatible wallet is required for wallet-signed GenLayer submissions.",
      });
      return;
    }

    setBusyOnchain(true);
    setWallet({
      status: "connecting",
      message: "Requesting wallet access and switching to the configured GenLayer network.",
    });

    try {
      const connection = await connectBrowserWallet({
        network: publicConfig.network,
        contractAddress: publicConfig.contractAddress,
        rpcUrl: publicConfig.rpcUrl,
      });

      setWallet({
        status: "connected",
        address: connection.address,
        network: connection.network,
        message: `Wallet connected on ${connection.network}.`,
      });
    } catch (error) {
      setWallet({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to connect wallet.",
      });
    } finally {
      setBusyOnchain(false);
    }
  }

  function updateCurrentAttemptOnchain(onchain: OnchainWorkflowState) {
    setCurrentAttempt((attempt) =>
      attempt
        ? {
            ...attempt,
            onchain,
          }
        : attempt,
    );
  }

  async function handleSubmitOnchain() {
    if (!currentAttempt) {
      return;
    }

    setBusyOnchain(true);
    updateCurrentAttemptOnchain({
      status: "submitting",
      message: "Waiting for MetaMask confirmation and GenLayer acceptance.",
      walletAddress: wallet.address,
      updatedAt: new Date().toISOString(),
    });

    try {
      const result = await submitGenLayerReviewFromBrowser(
        currentAttempt.report.genlayerRequest,
        {
          network: publicConfig.network,
          contractAddress: publicConfig.contractAddress,
          rpcUrl: publicConfig.rpcUrl,
          walletAddress: wallet.address as `0x${string}` | undefined,
        },
      );

      const nextOnchain = deriveOnchainWorkflowState(result, wallet.address);
      updateCurrentAttemptOnchain(nextOnchain);
      if (result.status === "CONSENSUS_PENDING") {
        setState("consensus_pending");
      } else if (
        result.status === "CONSENSUS_ACCEPTED" ||
        result.status === "CONSENSUS_REJECTED"
      ) {
        setState("accepted_for_scoring");
      } else if (result.status === "SKIPPED_BY_GATE") {
        setState(currentAttempt.report.state);
      } else {
        setState("integration_unavailable");
      }
    } finally {
      setBusyOnchain(false);
    }
  }

  async function handleRefreshOnchain() {
    if (!currentAttempt?.onchain.result?.transactionHash) {
      return;
    }

    setBusyOnchain(true);
    updateCurrentAttemptOnchain({
      ...currentAttempt.onchain,
      status: "tracking",
      message: "Refreshing the transaction receipt and final consensus state.",
      updatedAt: new Date().toISOString(),
    });

    try {
      const result = await trackGenLayerReviewTransaction(
        currentAttempt.report.genlayerRequest,
        currentAttempt.onchain.result.transactionHash,
        {
          network: publicConfig.network,
          contractAddress: publicConfig.contractAddress,
          rpcUrl: publicConfig.rpcUrl,
          walletAddress: wallet.address as `0x${string}` | undefined,
        },
      );

      updateCurrentAttemptOnchain(
        deriveOnchainWorkflowState(result, wallet.address),
      );
      if (
        result.status === "CONSENSUS_ACCEPTED" ||
        result.status === "CONSENSUS_REJECTED"
      ) {
        setState("accepted_for_scoring");
      } else if (result.status === "CONSENSUS_PENDING") {
        setState("consensus_pending");
      } else {
        setState("integration_unavailable");
      }
    } finally {
      setBusyOnchain(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <section className="submission-layout">
        <ProgressPanel state={state} report={report} errorCode={errorCode} />

        <section className="panel submission-panel">
          <div className="submission-intro">
            <h1>GenForge</h1>
            <p>AI-native engineering review for GenLayer</p>
          </div>
          <div className="scope-strip" aria-label="Review scope">
            <span>Deterministic gate</span>
            <span>Bounded evidence</span>
            <span>Live GenLayer path</span>
          </div>
          <form className="submission-form" onSubmit={handleSubmit}>
            <label htmlFor="repository-url">Public GitHub repository URL</label>
            <input
              id="repository-url"
              name="repository-url"
              type="url"
              placeholder="https://github.com/owner/repository"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              required
            />
            <button type="submit">
              {state === "validating_url" || state === "collecting_evidence"
                ? "Reviewing..."
                : "Run GenLayer Review"}
            </button>
          </form>
          <p className="subtle">
            Read-only GitHub API collection only. Submitted repository code is
            never executed on this host.
          </p>
          {errorMessage ? (
            <p className="error-callout">{errorMessage}</p>
          ) : null}
        </section>
      </section>

      {report ? (
        <>
          <section className="decision-strip panel">
            <div>
              <div className="eyebrow">Gate Decision</div>
              <h2>{report.summary}</h2>
            </div>
            <DecisionBadge decision={report.decision} />
          </section>

          <div className="content-grid">
            <div className="primary-column">
              <WorkflowPanel report={report} />
              <OnchainReviewPanel
                report={report}
                publicConfig={publicConfig}
                configIssues={configIssues}
                wallet={wallet}
                onchain={currentAttempt?.onchain ?? {
                  status: "idle",
                  message:
                    "Connect MetaMask after a successful deterministic review to submit the bounded request on-chain.",
                }}
                busy={busyOnchain}
                onConnectWallet={handleConnectWallet}
                onSubmitOnchain={handleSubmitOnchain}
                onRefreshStatus={handleRefreshOnchain}
              />
              <ScoreOverview report={report} />
              <ConsensusPanel report={report} />
              <FindingsPanel report={report} />
              <EvidenceExplorer report={report} />
            </div>

            <div className="secondary-column">
              <SubmissionHistoryPanel
                currentAttempt={currentAttempt}
                previousAttempts={history}
              />
              <SourceVerificationPanel report={report} />
              <ConfidencePanel report={report} />
              <RankingPanel report={report} />
              <ListPanel
                title="Missing Information"
                items={report.missingInformation}
                emptyMessage="No missing-information items were recorded for this review."
              />
              <ListPanel
                title="Manual Verification Queue"
                items={report.manualVerificationQueue}
                emptyMessage="No manual verification items were recorded."
              />
              <section className="panel">
                <div className="panel-header">
                  <h3>Remediation Guidance</h3>
                  <span>{report.remediation.length}</span>
                </div>
                <ul className="stack-list">
                  {report.remediation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
