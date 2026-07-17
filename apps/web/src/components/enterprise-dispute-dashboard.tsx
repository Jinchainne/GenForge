"use client";

import { useMemo, useState } from "react";
import {
  connectBrowserWallet,
  isBrowserWalletAvailable,
  submitBrowserContractJson,
  trackBrowserContractJsonTransaction,
} from "@genforge/genlayer-client";
import type { BrowserContractExecutionResult } from "@genforge/genlayer-client";
import {
  DisputeResolutionSchema,
  type EnterpriseDisputeReport,
  type EnterpriseDisputeResponse,
  type DisputeResolution,
} from "@/lib/dispute-domain";
import {
  getDisputeSubmissionConfigIssues,
  getPublicGenLayerConfig,
  getWalletConfigIssues,
} from "@/lib/public-genlayer-config";
import type { WalletConnectionState } from "@/lib/review-workflow";

const defaultEvidence = `Signed contract section covering delivery or service scope
Invoice or purchase order associated with the disputed milestone
Email or notice showing the counterparty's disputed position`;

export function EnterpriseDisputeDashboard() {
  const publicConfig = getPublicGenLayerConfig();
  const walletConfigIssues = getWalletConfigIssues(publicConfig);
  const submissionConfigIssues = getDisputeSubmissionConfigIssues(publicConfig);
  const disputeContractAddress =
    publicConfig.disputeContractAddress ?? publicConfig.contractAddress;
  const [form, setForm] = useState({
    caseTitle: "Terminal turnaround delay dispute",
    disputeType: "logistics",
    claimantName: "OceanBridge Logistics Ltd.",
    respondentName: "Northport Container Services",
    contractReference: "MSA-2026-044 / Appendix B / SLA section 3.2",
    claimSummary:
      "The claimant alleges that the respondent caused avoidable berth and container handoff delays, triggering detention costs and missing the contractual turnaround SLA for two consecutive sailings.",
    respondentPosition:
      "The respondent states that weather alerts, customs inspection holds, and a late trucking release from the claimant materially contributed to the delay and should qualify as exceptions under the service agreement.",
    requestedRemedy:
      "Allocate liability for detention and service credits, determine whether SLA exceptions apply, and recommend the payable adjustment.",
    governingTerms: "Service agreement, SLA appendix, force majeure and notice provisions",
    amountClaimed: "USD 185,000",
    filingDate: new Date().toISOString().slice(0, 10),
    evidenceText: defaultEvidence,
  });
  const [report, setReport] = useState<EnterpriseDisputeReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [onchainState, setOnchainState] = useState<{
    status: "idle" | "submitting" | "tracking" | "finalized" | "failed";
    message: string;
    transactionHash?: string;
    resolution?: DisputeResolution;
  }>({
    status: "idle",
    message:
      "Generate a dossier, connect MetaMask, then submit the dispute packet for validator adjudication.",
  });
  const [wallet, setWallet] = useState<WalletConnectionState>({
    status: isBrowserWalletAvailable() ? "disconnected" : "missing_provider",
    message: isBrowserWalletAvailable()
      ? "Connect MetaMask to prepare enterprise dispute adjudication."
      : "No browser wallet provider was detected in this browser.",
  });

  const evidenceItems = useMemo(
    () =>
      form.evidenceText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [form.evidenceText],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          evidenceItems,
        }),
      });

      const payload = (await response.json()) as EnterpriseDisputeResponse;
      if (!payload.ok) {
        setErrorMessage(payload.error.message);
        return;
      }

      setReport(payload.report);
      setOnchainState({
        status: "idle",
        message:
          payload.report.decision === "ACCEPT_FOR_SCORING"
            ? "The dossier is ready for wallet-signed adjudication once the dispute contract path is configured."
            : "Fix the dossier gaps before escalating the dispute on-chain.",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectWallet() {
    if (!isBrowserWalletAvailable()) {
      setWallet({
        status: "missing_provider",
        message:
          "MetaMask or another compatible wallet is required for enterprise adjudication.",
      });
      return;
    }

    setBusy(true);
    try {
      const connection = await connectBrowserWallet({
        network: publicConfig.network,
        rpcUrl: publicConfig.rpcUrl,
      });

      setWallet({
        status: "connected",
        address: connection.address,
        network: connection.network,
        message: `Wallet connected on ${connection.network}. The enterprise dispute workflow can now prepare signed submissions.`,
      });
    } catch (error) {
      setWallet({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to connect wallet.",
      });
    } finally {
      setBusy(false);
    }
  }

  function updateResolutionState(
    execution: BrowserContractExecutionResult,
    fallbackMessage: string,
  ) {
    const parsedResolution = DisputeResolutionSchema.safeParse(execution.result);
    const resolution = parsedResolution.success
      ? parsedResolution.data
      : undefined;

    if (resolution && report) {
      setReport({
        ...report,
        latestResolution: resolution,
      });
    }

    setOnchainState({
      status:
        execution.status === "CONSENSUS_PENDING"
          ? "tracking"
          : execution.status === "FINALIZED"
            ? "finalized"
            : "failed",
      transactionHash: execution.transactionHash,
      resolution,
      message: execution.parserMessage ?? fallbackMessage,
    });
  }

  async function handleSubmitOnchain() {
    if (!report) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setOnchainState({
      status: "submitting",
      message: "Submitting the bounded dispute packet to GenLayer...",
    });

    try {
      const execution = await submitBrowserContractJson(
        {
          functionName: "resolve_dispute",
          args: [JSON.stringify(report.boundedRequest)],
          readback: {
            functionName: "get_resolution_judgment",
            args: [report.caseId],
          },
        },
        {
          network: publicConfig.network,
          contractAddress: disputeContractAddress,
          rpcUrl: publicConfig.rpcUrl,
        },
      );

      updateResolutionState(
        execution,
        "Dispute submission completed without a structured parser message.",
      );
    } catch (error) {
      setOnchainState({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Dispute submission failed unexpectedly.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshReceipt() {
    if (!report || !onchainState.transactionHash) {
      return;
    }

    setBusy(true);
    setOnchainState((current) => ({
      ...current,
      status: "tracking",
      message: "Refreshing validator receipt...",
    }));

    try {
      const execution = await trackBrowserContractJsonTransaction(
        onchainState.transactionHash,
        {
          readback: {
            functionName: "get_resolution_judgment",
            args: [report.caseId],
          },
        },
        {
          network: publicConfig.network,
          contractAddress: disputeContractAddress,
          rpcUrl: publicConfig.rpcUrl,
        },
      );

      updateResolutionState(
        execution,
        "Receipt refresh completed without a structured parser message.",
      );
    } catch (error) {
      setOnchainState({
        status: "failed",
        transactionHash: onchainState.transactionHash,
        message:
          error instanceof Error
            ? error.message
            : "Receipt refresh failed unexpectedly.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dispute-shell">
      <div className="submission-layout">
        <section className="panel hero-panel">
          <div className="eyebrow">Enterprise Adjudication</div>
          <h2>Two-sided dispute intake, evidence readiness, and blockchain-bound adjudication prep</h2>
          <p>
            Build a bounded enterprise case packet before escalating the final
            decision to GenLayer validators.
          </p>
          <div className="status-rail" aria-label="Dispute workflow">
            <span className="done">Intake</span>
            <span className={report ? "done" : "active"}>Dossier</span>
            <span className={wallet.status === "connected" ? "done" : ""}>Wallet</span>
            <span>Consensus</span>
          </div>
          <p className="footnote">
            Best fit: supplier disputes, SLA breaches, logistics claims, and
            legal-ops escalation where one internal server should not make the
            final call alone.
          </p>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Case Intake</div>
              <h3>Enterprise Dispute Workspace</h3>
            </div>
            <span>2-party dossier</span>
          </div>
          <form className="submission-form" onSubmit={handleSubmit}>
            <label htmlFor="case-title">Case title</label>
            <input
              id="case-title"
              value={form.caseTitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, caseTitle: event.target.value }))
              }
            />
            <label htmlFor="dispute-type">Dispute type</label>
            <select
              id="dispute-type"
              className="dashboard-select"
              value={form.disputeType}
              onChange={(event) =>
                setForm((current) => ({ ...current, disputeType: event.target.value }))
              }
            >
              <option value="procurement">Procurement</option>
              <option value="services">Services</option>
              <option value="logistics">Port / Logistics</option>
              <option value="insurance">Insurance</option>
              <option value="employment">Employment</option>
              <option value="legal_ops">Legal Ops</option>
              <option value="other">Other</option>
            </select>
            <div className="field-grid">
              <div>
                <label htmlFor="claimant-name">Claimant</label>
                <input
                  id="claimant-name"
                  value={form.claimantName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, claimantName: event.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="respondent-name">Respondent</label>
                <input
                  id="respondent-name"
                  value={form.respondentName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, respondentName: event.target.value }))
                  }
                />
              </div>
            </div>
            <label htmlFor="contract-reference">Contract or policy reference</label>
            <input
              id="contract-reference"
              value={form.contractReference}
              onChange={(event) =>
                setForm((current) => ({ ...current, contractReference: event.target.value }))
              }
            />
            <label htmlFor="claim-summary">Claim summary</label>
            <textarea
              id="claim-summary"
              className="dashboard-textarea"
              value={form.claimSummary}
              onChange={(event) =>
                setForm((current) => ({ ...current, claimSummary: event.target.value }))
              }
            />
            <label htmlFor="respondent-position">Respondent position</label>
            <textarea
              id="respondent-position"
              className="dashboard-textarea"
              value={form.respondentPosition}
              onChange={(event) =>
                setForm((current) => ({ ...current, respondentPosition: event.target.value }))
              }
            />
            <label htmlFor="requested-remedy">Requested remedy</label>
            <textarea
              id="requested-remedy"
              className="dashboard-textarea"
              value={form.requestedRemedy}
              onChange={(event) =>
                setForm((current) => ({ ...current, requestedRemedy: event.target.value }))
              }
            />
            <div className="field-grid">
              <div>
                <label htmlFor="governing-terms">Governing terms</label>
                <input
                  id="governing-terms"
                  value={form.governingTerms}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, governingTerms: event.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="amount-claimed">Amount claimed</label>
                <input
                  id="amount-claimed"
                  value={form.amountClaimed}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, amountClaimed: event.target.value }))
                  }
                />
              </div>
            </div>
            <label htmlFor="evidence-text">Evidence items, one per line</label>
            <textarea
              id="evidence-text"
              className="dashboard-textarea"
              value={form.evidenceText}
              onChange={(event) =>
                setForm((current) => ({ ...current, evidenceText: event.target.value }))
              }
            />
            <button type="submit">
              {busy ? "Building dossier..." : "Generate Enterprise Dossier"}
            </button>
          </form>
          {errorMessage ? <p className="error-callout">{errorMessage}</p> : null}
        </section>
      </div>

      {report ? (
        <div className="content-grid">
          <div className="primary-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Case Dossier</div>
                  <h3>{report.caseTitle}</h3>
                </div>
                <span>{report.decision}</span>
              </div>
              <p>{report.summary}</p>
              <div className="score-grid">
                <article className="score-card">
                  <span>Readiness</span>
                  <strong>{report.readiness.status}</strong>
                </article>
                <article className="score-card">
                  <span>Evidence items</span>
                  <strong>{report.evidencePack.length}</strong>
                </article>
                <article className="score-card">
                  <span>Open issues</span>
                  <strong>{report.issues.length}</strong>
                </article>
                <article className="score-card">
                  <span>Program</span>
                  <strong>v1</strong>
                </article>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Adjudication Readiness</h3>
                <span>{report.readiness.status}</span>
              </div>
              <div className="workflow-grid">
                <article className="workflow-step">
                  <strong>Claimant</strong>
                  <p>{report.parties.claimant}</p>
                </article>
                <article className="workflow-step">
                  <strong>Respondent</strong>
                  <p>{report.parties.respondent}</p>
                </article>
                <article className="workflow-step">
                  <strong>Dispute type</strong>
                  <p>{report.disputeType}</p>
                </article>
              </div>
              <div className="field-grid">
                <div className="callout">
                  <strong>Satisfied requirements</strong>
                  <ul className="stack-list">
                    {report.readiness.satisfiedRequirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="callout">
                  <strong>Missing requirements</strong>
                  {report.readiness.missingRequirements.length === 0 ? (
                    <p>No missing requirements remain.</p>
                  ) : (
                    <ul className="stack-list">
                      {report.readiness.missingRequirements.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Enterprise Workflow</h3>
                <span>{report.workflowTimeline.length} steps</span>
              </div>
              <div className="workflow-grid">
                {report.workflowTimeline.map((step) => (
                  <article key={step.id} className="workflow-step">
                    <strong>{step.label}</strong>
                    <p>{step.summary}</p>
                    <span className={`workflow-pill workflow-${step.status}`}>
                      {step.status}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Enterprise Issues</h3>
                <span>{report.issues.length}</span>
              </div>
              <div className="finding-list">
                {report.issues.map((issue) => (
                  <article key={issue.id} className="finding-item">
                    <header>
                      <div>
                        <strong>{issue.id}</strong>
                        <h4>{issue.title}</h4>
                      </div>
                      <span className={`severity severity-${issue.severity}`}>
                        {issue.severity}
                      </span>
                    </header>
                    <p>{issue.summary}</p>
                    <p className="subtle">{issue.action}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Bounded Adjudication Packet</h3>
                <span>{report.boundedRequest.program}</span>
              </div>
              <div className="field-grid">
                <div className="callout">
                  <strong>Contract anchor</strong>
                  <p>{report.boundedRequest.contractReference}</p>
                </div>
                <div className="callout">
                  <strong>Amount claimed</strong>
                  <p>{report.boundedRequest.amountClaimed || "Not specified"}</p>
                </div>
              </div>
              <div className="callout">
                <strong>Claim summary</strong>
                <p>{report.boundedRequest.claimSummary}</p>
              </div>
              <div className="callout">
                <strong>Respondent position</strong>
                <p>{report.boundedRequest.respondentPosition}</p>
              </div>
              <div className="callout">
                <strong>Questions for validators</strong>
                <ul className="stack-list">
                  {report.adjudicationQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="secondary-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Wallet Layer</div>
                  <h3>Blockchain Escalation</h3>
                </div>
                <span>{wallet.status}</span>
              </div>
              <dl className="source-grid">
                <div>
                  <dt>Wallet</dt>
                  <dd>{wallet.address ?? "Not connected"}</dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>{publicConfig.network ?? "Not configured"}</dd>
                </div>
                <div>
                  <dt>Dispute contract</dt>
                  <dd>{disputeContractAddress ?? "Not configured"}</dd>
                </div>
                <div>
                  <dt>Studio</dt>
                  <dd>{publicConfig.studioUrl}</dd>
                </div>
              </dl>
              {walletConfigIssues.length > 0 ? (
                <div className="error-callout">
                  <strong>Wallet runtime config missing</strong>
                  <ul className="stack-list compact-list">
                    {walletConfigIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {submissionConfigIssues.length > walletConfigIssues.length ? (
                <div className="callout">
                  <strong>Dispute contract not configured yet</strong>
                  <p>
                    Wallet connection can work now, but enterprise adjudication
                    still needs a deployed GenLayer contract address before the
                    case can be written on-chain.
                  </p>
                </div>
              ) : null}
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleConnectWallet}
                  disabled={busy || wallet.status === "connected"}
                >
                  {wallet.status === "connected"
                    ? "Wallet Connected"
                    : "Connect MetaMask"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOnchain}
                  disabled={
                    busy ||
                    !report ||
                    report.decision !== "ACCEPT_FOR_SCORING" ||
                    wallet.status !== "connected" ||
                    submissionConfigIssues.length > 0
                  }
                >
                  Submit Dispute On-Chain
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleRefreshReceipt}
                  disabled={busy || !onchainState.transactionHash}
                >
                  Refresh Receipt
                </button>
              </div>
              <p className="subtle">{wallet.message}</p>
              <p className="subtle">{onchainState.message}</p>
              {onchainState.transactionHash ? (
                <p className="subtle">
                  Transaction: {onchainState.transactionHash}
                </p>
              ) : null}
              {report.decision === "ACCEPT_FOR_SCORING" ? (
                <p className="subtle">
                  The dispute packet is ready for blockchain adjudication as
                  soon as the enterprise contract address is configured.
                </p>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Operating Model</h3>
                <span>Enterprise ready</span>
              </div>
              <ul className="stack-list">
                <li>
                  <strong>Internal owner:</strong> {report.operatingModel.internalOwner}
                </li>
                <li>
                  <strong>Counterparty channel:</strong> {report.operatingModel.counterpartyChannel}
                </li>
                <li>
                  <strong>Appeal path:</strong> {report.operatingModel.appealPath}
                </li>
              </ul>
              <div className="callout">
                <strong>Settlement artifacts</strong>
                <ul className="stack-list compact-list">
                  {report.operatingModel.settlementArtifacts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Resolution Playbook</h3>
                <span>{report.resolutionPlaybook.length}</span>
              </div>
              <ul className="stack-list">
                {report.resolutionPlaybook.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            {report.latestResolution ? (
              <section className="panel">
                <div className="panel-header">
                  <h3>Latest On-Chain Resolution</h3>
                  <span>{report.latestResolution.disposition}</span>
                </div>
                <div className="callout">
                  <strong>Liability split</strong>
                  <p>{report.latestResolution.liability_split}</p>
                </div>
                <div className="callout">
                  <strong>Payable adjustment</strong>
                  <p>{report.latestResolution.payable_adjustment}</p>
                </div>
                <div className="callout">
                  <strong>Resolution summary</strong>
                  <p>{report.latestResolution.resolution_summary}</p>
                </div>
              </section>
            ) : null}

            <section className="panel">
              <div className="panel-header">
                <h3>Evidence Pack</h3>
                <span>{report.evidencePack.length}</span>
              </div>
              <ul className="stack-list">
                {report.evidencePack.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Recommended Actions</h3>
                <span>{report.recommendedActions.length}</span>
              </div>
              <ul className="stack-list">
                {report.recommendedActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
