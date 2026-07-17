"use client";

import { useState } from "react";
import type {
  ReviewErrorCode,
  ReviewReport,
  ReviewResponse,
} from "@genforge/domain";
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
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [state, setState] = useState<DashboardState>("idle");
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [errorCode, setErrorCode] = useState<ReviewErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReport(null);
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

      setReport(payload.report);
      setState(payload.report.state);
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error.",
      );
    }
  }

  return (
    <main className="dashboard-shell">
      <section className="submission-layout">
        <ProgressPanel state={state} report={report} errorCode={errorCode} />

        <section className="panel submission-panel">
          <div className="panel-header">
            <h1>GenForge</h1>
            <span>AI-native engineering review for GenLayer</span>
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
              <ScoreOverview report={report} />
              <ConsensusPanel report={report} />
              <FindingsPanel report={report} />
              <EvidenceExplorer report={report} />
            </div>

            <div className="secondary-column">
              <SourceVerificationPanel report={report} />
              <ConfidencePanel report={report} />
              <RankingPanel report={report} />
              <ListPanel
                title="Missing Information"
                items={report.missingInformation}
                emptyMessage="No missing-information items were recorded for this preliminary pass."
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
