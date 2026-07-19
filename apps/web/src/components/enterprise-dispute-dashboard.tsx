"use client";

import { useMemo, useRef, useState } from "react";
import {
  submitBrowserContractJson,
  trackBrowserContractJsonTransaction,
} from "@genforge/genlayer-client";
import type { BrowserContractExecutionResult } from "@genforge/genlayer-client";
import {
  DisputeResolutionSchema,
  type DisputeResolution,
  type EnterpriseDisputeReport,
  type EnterpriseDisputeResponse,
} from "@/lib/dispute-domain";
import {
  getDisputeSubmissionConfigIssues,
  getPublicGenLayerConfig,
  getWalletConfigIssues,
} from "@/lib/public-genlayer-config";
import type { WalletConnectionState } from "@/lib/review-workflow";

const defaultEvidence = `Purchase order PO-2026-044 for 1,200 cartons of textile goods
Commercial invoice INV-7781 showing unit price, Incoterms, and payment term
Bill of lading BOL-SGN-2407 and packing list showing shipped quantity
Email thread where buyer reports short shipment and seller disputes liability`;
const defaultFilingDate = new Date().toISOString().slice(0, 10);
const defaultTargetResolutionDate = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 7,
)
  .toISOString()
  .slice(0, 10);

type ReportPage = "overview" | "packet" | "operations" | "chain";

type TradeCaseDashboardProps = {
  wallet: WalletConnectionState;
  walletBusy: boolean;
};

export function EnterpriseDisputeDashboard({
  wallet,
  walletBusy,
}: TradeCaseDashboardProps) {
  const publicConfig = getPublicGenLayerConfig();
  const walletConfigIssues = getWalletConfigIssues(publicConfig);
  const submissionConfigIssues = getDisputeSubmissionConfigIssues(publicConfig);
  const disputeContractAddress =
    publicConfig.disputeContractAddress ?? publicConfig.contractAddress;
  const [reportPage, setReportPage] = useState<ReportPage>("overview");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    caseTitle: "Short shipment claim under purchase order PO-2026-044",
    disputeType: "procurement",
    priority: "critical",
    claimantName: "An Phu Trading Co., Ltd.",
    respondentName: "Northstar Export Pte. Ltd.",
    contractReference: "PO-2026-044 / Commercial Invoice INV-7781 / BOL-SGN-2407",
    jurisdiction:
      "Singapore law, ICC arbitration clause, Incoterms 2020 CIF Ho Chi Minh City",
    claimSummary:
      "The buyer alleges that the seller shipped fewer cartons than the purchase order and invoice required, causing resale shortfall and emergency replacement purchases.",
    respondentPosition:
      "The seller states that the shipped quantity matched the warehouse release record and that any shortage occurred after carrier handover or during destination handling.",
    requestedRemedy:
      "Determine whether the buyer may deduct the short-shipped quantity, freight allocation, and inspection cost from the payable balance.",
    businessImpact:
      "The missing cartons affect downstream delivery commitments, customs reconciliation, and payment release for a repeat supplier.",
    governingTerms:
      "Purchase order, commercial invoice, packing list, bill of lading, Incoterms 2020",
    amountClaimed: "USD 48,600",
    filingDate: defaultFilingDate,
    targetResolutionDate: defaultTargetResolutionDate,
    counterpartyNoticeStatus: "ready_to_send",
    evidenceText: defaultEvidence,
  });
  const [report, setReport] = useState<EnterpriseDisputeReport | null>(null);
  const [importedDocuments, setImportedDocuments] = useState<
    Array<{ name: string; type: string; size: number; status: string }>
  >([]);
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
      "Import trade documents, build a case file, connect a wallet, then submit the bounded packet for validator adjudication.",
  });

  const evidenceItems = useMemo(
    () =>
      form.evidenceText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [form.evidenceText],
  );

  async function handleImportDocuments(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const importedLines = await Promise.all(
      files.map(async (file) => {
        const isReadableText =
          file.type.startsWith("text/") ||
          /\.(csv|json|md|txt|log)$/i.test(file.name);
        if (isReadableText) {
          const text = await file.text();
          const excerpt = text.replace(/\s+/g, " ").trim().slice(0, 480);
          return `Imported document ${file.name}: ${excerpt || "empty text file"}`;
        }
        return `Imported document ${file.name} (${file.type || "unknown type"}, ${Math.ceil(
          file.size / 1024,
        )} KB) requires manual content review before validator submission.`;
      }),
    );

    setImportedDocuments((current) => [
      ...files.map((file) => ({
        name: file.name,
        type: file.type || "unknown",
        size: file.size,
        status:
          file.type.startsWith("text/") || /\.(csv|json|md|txt|log)$/i.test(file.name)
            ? "text imported"
            : "manual review",
      })),
      ...current,
    ]);
    setForm((current) => ({
      ...current,
      evidenceText: [current.evidenceText, ...importedLines].filter(Boolean).join("\n"),
    }));
    event.target.value = "";
  }

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
      setReportPage("overview");
      setOnchainState({
        status: "idle",
        message:
          payload.report.decision === "ACCEPT_FOR_SCORING"
            ? "The trade case is ready for wallet-signed adjudication once the dispute contract path is configured."
            : "Fix the document or seller-response gaps before escalating the case on-chain.",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error.",
      );
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
        "Trade case submission completed without a structured parser message.",
      );
    } catch (error) {
      setOnchainState({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Trade case submission failed unexpectedly.",
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
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Trade Document Intake</div>
              <h3>Goods purchase dispute file</h3>
            </div>
            <span>buyer-seller packet</span>
          </div>
          <form className="submission-form" onSubmit={handleSubmit}>
            <label htmlFor="case-title">Trade case title</label>
            <input
              id="case-title"
              value={form.caseTitle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  caseTitle: event.target.value,
                }))
              }
            />
            <label htmlFor="dispute-type">Goods dispute type</label>
            <select
              id="dispute-type"
              className="dashboard-select"
              value={form.disputeType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  disputeType: event.target.value,
                }))
              }
            >
              <option value="procurement">Purchase order / supply</option>
              <option value="logistics">Shipping / delivery</option>
              <option value="insurance">Cargo insurance</option>
              <option value="services">Inspection / service</option>
              <option value="legal_ops">Trade legal ops</option>
              <option value="employment">Labor-linked shipment issue</option>
              <option value="other">Other</option>
            </select>
            <div className="field-grid">
              <div>
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  className="dashboard-select"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label htmlFor="counterparty-notice-status">
                  Counterparty notice
                </label>
                <select
                  id="counterparty-notice-status"
                  className="dashboard-select"
                  value={form.counterpartyNoticeStatus}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      counterpartyNoticeStatus: event.target.value,
                    }))
                  }
                >
                  <option value="draft_required">Draft required</option>
                  <option value="ready_to_send">Ready to send</option>
                  <option value="sent">Sent</option>
                  <option value="response_received">Response received</option>
                </select>
              </div>
            </div>
            <div className="field-grid">
              <div>
                <label htmlFor="claimant-name">Buyer / claimant</label>
                <input
                  id="claimant-name"
                  value={form.claimantName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      claimantName: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="respondent-name">Seller / respondent</label>
                <input
                  id="respondent-name"
                  value={form.respondentName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      respondentName: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <label htmlFor="contract-reference">
              PO, invoice, B/L, or contract reference
            </label>
            <input
              id="contract-reference"
              value={form.contractReference}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contractReference: event.target.value,
                }))
              }
            />
            <label htmlFor="jurisdiction">Governing law, forum, Incoterms</label>
            <input
              id="jurisdiction"
              value={form.jurisdiction}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  jurisdiction: event.target.value,
                }))
              }
            />
            <label htmlFor="claim-summary">Buyer claim summary</label>
            <textarea
              id="claim-summary"
              className="dashboard-textarea"
              value={form.claimSummary}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  claimSummary: event.target.value,
                }))
              }
            />
            <label htmlFor="respondent-position">Seller response</label>
            <textarea
              id="respondent-position"
              className="dashboard-textarea"
              value={form.respondentPosition}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  respondentPosition: event.target.value,
                }))
              }
            />
            <label htmlFor="requested-remedy">Requested settlement</label>
            <textarea
              id="requested-remedy"
              className="dashboard-textarea"
              value={form.requestedRemedy}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  requestedRemedy: event.target.value,
                }))
              }
            />
            <label htmlFor="business-impact">Commercial impact</label>
            <textarea
              id="business-impact"
              className="dashboard-textarea"
              value={form.businessImpact}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  businessImpact: event.target.value,
                }))
              }
            />
            <div className="field-grid">
              <div>
                <label htmlFor="governing-terms">Goods and document terms</label>
                <input
                  id="governing-terms"
                  value={form.governingTerms}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      governingTerms: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="amount-claimed">Claimed amount</label>
                <input
                  id="amount-claimed"
                  value={form.amountClaimed}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amountClaimed: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="field-grid">
              <div>
                <label htmlFor="filing-date">Filing date</label>
                <input
                  id="filing-date"
                  type="date"
                  value={form.filingDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      filingDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="target-resolution-date">
                  Target resolution date
                </label>
                <input
                  id="target-resolution-date"
                  type="date"
                  value={form.targetResolutionDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      targetResolutionDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="document-import-row">
              <label htmlFor="trade-document-import">Import trade documents</label>
              <input
                ref={fileInputRef}
                id="trade-document-import"
                className="visually-hidden"
                type="file"
                multiple
                accept=".txt,.csv,.json,.md,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleImportDocuments}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
              >
                Import Documents
              </button>
            </div>
            {importedDocuments.length > 0 ? (
              <div className="imported-document-list" aria-label="Imported documents">
                {importedDocuments.map((document) => (
                  <span key={`${document.name}-${document.size}`}>
                    {document.name} · {document.status}
                  </span>
                ))}
              </div>
            ) : null}
            <label htmlFor="evidence-text">
              Evidence and correspondence, one item per line
            </label>
            <textarea
              id="evidence-text"
              className="dashboard-textarea"
              value={form.evidenceText}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  evidenceText: event.target.value,
                }))
              }
            />
            <button type="submit">
              {busy ? "Building case file..." : "Build Trade Case"}
            </button>
          </form>
          {errorMessage ? <p className="error-callout">{errorMessage}</p> : null}
        </section>

        <section className="panel hero-panel workbench-rail">
          <div className="eyebrow">Trade Adjudication</div>
          <h2>Goods document case before validator escalation</h2>
          <p>
            Buyer/seller positions, PO terms, shipment documents, settlement,
            and GenLayer receipt.
          </p>
          <div className="status-rail" aria-label="Dispute workflow">
            <span className="done">Intake</span>
            <span className={report ? "done" : "active"}>Dossier</span>
            <span className={wallet.status === "connected" ? "done" : ""}>
              Wallet
            </span>
            <span>Consensus</span>
          </div>
          <dl className="rail-facts">
            <div>
              <dt>Best fit</dt>
              <dd>PO, invoice, B/L, packing list, delivery, and payment disputes</dd>
            </div>
            <div>
              <dt>On-chain boundary</dt>
              <dd>Only after document readiness and wallet confirmation</dd>
            </div>
          </dl>
        </section>
      </div>

      {report ? (
        <div className="dossier-shell">
          <section className="panel dossier-intro-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Bounded Dossier</div>
                <h3>{report.caseTitle}</h3>
              </div>
              <span>{report.priority}</span>
            </div>
            <div className="dossier-kpi-grid">
              <article className="dossier-kpi-card">
                <span>Decision</span>
                <strong>{report.decision}</strong>
              </article>
              <article className="dossier-kpi-card">
                <span>Queue</span>
                <strong>{report.commercialReadiness.queueStatus}</strong>
              </article>
              <article className="dossier-kpi-card">
                <span>Amount</span>
                <strong>{report.boundedRequest.amountClaimed || "Pending"}</strong>
              </article>
              <article className="dossier-kpi-card">
                <span>Target</span>
                <strong>{report.targetResolutionDate}</strong>
              </article>
            </div>
          </section>

          <div className="dossier-toolbar" role="tablist" aria-label="Dossier pages">
            <button
              type="button"
              className={
                reportPage === "overview"
                  ? "dossier-tab dossier-tab-active"
                  : "dossier-tab"
              }
              onClick={() => setReportPage("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={
                reportPage === "packet"
                  ? "dossier-tab dossier-tab-active"
                  : "dossier-tab"
              }
              onClick={() => setReportPage("packet")}
            >
              Packet
            </button>
            <button
              type="button"
              className={
                reportPage === "operations"
                  ? "dossier-tab dossier-tab-active"
                  : "dossier-tab"
              }
              onClick={() => setReportPage("operations")}
            >
              Operations
            </button>
            <button
              type="button"
              className={
                reportPage === "chain"
                  ? "dossier-tab dossier-tab-active"
                  : "dossier-tab"
              }
              onClick={() => setReportPage("chain")}
            >
              Chain
            </button>
          </div>

          {reportPage === "overview" ? (
            <div className="dossier-spread">
              <div className="dossier-page">
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
                      <span>Priority</span>
                      <strong>{report.priority}</strong>
                    </article>
                    <article className="score-card">
                      <span>Evidence items</span>
                      <strong>{report.evidencePack.length}</strong>
                    </article>
                    <article className="score-card">
                      <span>Open issues</span>
                      <strong>{report.issues.length}</strong>
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
                      <strong>Buyer / claimant</strong>
                      <p>{report.parties.claimant}</p>
                    </article>
                    <article className="workflow-step">
                      <strong>Seller / respondent</strong>
                      <p>{report.parties.respondent}</p>
                    </article>
                    <article className="workflow-step">
                      <strong>Trade issue</strong>
                      <p>{report.disputeType}</p>
                    </article>
                    <article className="workflow-step">
                      <strong>Jurisdiction</strong>
                      <p>{report.jurisdiction}</p>
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
              </div>

              <div className="dossier-page">
                <section className="panel">
                  <div className="panel-header">
                    <h3>Trade Workflow</h3>
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
                    <h3>Document Issues</h3>
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
              </div>
            </div>
          ) : null}

          {reportPage === "packet" ? (
            <div className="dossier-spread">
              <div className="dossier-page">
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
                  <div className="field-grid">
                    <div className="callout">
                      <strong>Business impact</strong>
                      <p>{report.boundedRequest.businessImpact}</p>
                    </div>
                    <div className="callout">
                      <strong>Resolution target</strong>
                      <p>{report.targetResolutionDate}</p>
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
                </section>
              </div>

              <div className="dossier-page">
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
                    <h3>Questions for Validators</h3>
                    <span>{report.adjudicationQuestions.length}</span>
                  </div>
                  <ul className="stack-list">
                    {report.adjudicationQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          ) : null}

          {reportPage === "operations" ? (
            <div className="dossier-spread">
              <div className="dossier-page">
                <section className="panel">
                  <div className="panel-header">
                    <h3>Operating Model</h3>
                    <span>Trade ready</span>
                  </div>
                  <ul className="stack-list">
                    <li>
                      <strong>Internal owner:</strong>{" "}
                      {report.operatingModel.internalOwner}
                    </li>
                    <li>
                      <strong>Escalation owner:</strong>{" "}
                      {report.operatingModel.escalationOwner}
                    </li>
                    <li>
                      <strong>Decision SLA:</strong>{" "}
                      {report.operatingModel.decisionSla}
                    </li>
                    <li>
                      <strong>Board visibility:</strong>{" "}
                      {report.operatingModel.boardVisibility}
                    </li>
                    <li>
                      <strong>Counterparty channel:</strong>{" "}
                      {report.operatingModel.counterpartyChannel}
                    </li>
                    <li>
                      <strong>Appeal path:</strong>{" "}
                      {report.operatingModel.appealPath}
                    </li>
                  </ul>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h3>Commercial Control Tower</h3>
                    <span>{report.commercialReadiness.exposureBand}</span>
                  </div>
                  <div className="score-grid">
                    <article className="score-card">
                      <span>Queue status</span>
                      <strong>{report.commercialReadiness.queueStatus}</strong>
                    </article>
                    <article className="score-card">
                      <span>Exposure band</span>
                      <strong>{report.commercialReadiness.exposureBand}</strong>
                    </article>
                    <article className="score-card">
                      <span>Payment ops</span>
                      <strong>
                        {report.commercialReadiness.paymentOpsReady
                          ? "ready"
                          : "pending"}
                      </strong>
                    </article>
                    <article className="score-card">
                      <span>Settlement</span>
                      <strong>
                        {report.commercialReadiness.settlementReady
                          ? "ready"
                          : "pending"}
                      </strong>
                    </article>
                  </div>
                </section>
              </div>

              <div className="dossier-page">
                <section className="panel">
                  <div className="panel-header">
                    <h3>Counterparty Packet</h3>
                    <span>{report.counterpartyPacket.responseDeadline}</span>
                  </div>
                  <div className="callout">
                    <strong>Notice channel</strong>
                    <p>{report.counterpartyPacket.noticeChannel}</p>
                  </div>
                  <div className="callout">
                    <strong>Packet summary</strong>
                    <p>{report.counterpartyPacket.packetSummary}</p>
                  </div>
                  <div className="callout">
                    <strong>Included artifacts</strong>
                    <ul className="stack-list compact-list">
                      {report.counterpartyPacket.includedArtifacts.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h3>Audit Trail</h3>
                    <span>{report.auditTrail.length} events</span>
                  </div>
                  <div className="history-list">
                    {report.auditTrail.map((entry) => (
                      <article key={entry.id} className="history-item">
                        <header>
                          <div>
                            <strong>{entry.actor}</strong>
                            <p>{entry.action}</p>
                          </div>
                          <span>{entry.timestamp.slice(0, 10)}</span>
                        </header>
                        <p className="subtle">{entry.evidenceStatus}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {reportPage === "chain" ? (
            <div className="dossier-spread">
              <div className="dossier-page">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Wallet Layer</div>
                      <h3>On-chain Trade Adjudication</h3>
                    </div>
                    <span>{wallet.status}</span>
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
                      <dt>Trade dispute contract</dt>
                      <dd>{disputeContractAddress ?? "Not configured"}</dd>
                    </div>
                    <div>
                      <dt>Queue status</dt>
                      <dd>{report.commercialReadiness.queueStatus}</dd>
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
                      <strong>Trade dispute contract not configured yet</strong>
                      <p>
                        Wallet connection can work now, but trade adjudication
                        still needs a deployed GenLayer contract
                        address before the case can be written on-chain.
                      </p>
                    </div>
                  ) : null}
                </section>
              </div>

              <div className="dossier-page">
                <section className="panel">
                  <div className="panel-header">
                    <h3>Submission Controls</h3>
                    <span>{onchainState.status}</span>
                  </div>
                  <div className="action-row">
                    <button
                      type="button"
                      onClick={handleSubmitOnchain}
                      disabled={
                        busy ||
                        walletBusy ||
                        !report ||
                        report.decision !== "ACCEPT_FOR_SCORING" ||
                        wallet.status !== "connected" ||
                        submissionConfigIssues.length > 0
                      }
                    >
                      Submit Trade Case On-Chain
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
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
