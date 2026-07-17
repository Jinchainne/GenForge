"use client";

import type { ReviewReport } from "@genforge/domain";
import { buildFixChecklist, canRequestOnchainAdjudication } from "@/lib/review-workflow";

export function WorkflowPanel({ report }: { report: ReviewReport }) {
  const checklist = buildFixChecklist(report);
  const canSubmit = canRequestOnchainAdjudication(report);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Workflow</div>
          <h3>Detect, Fix, Resubmit</h3>
        </div>
        <span>{checklist.length} fix targets</span>
      </div>

      <div className="workflow-grid">
        <article className="workflow-step">
          <strong>1. Detect</strong>
          <p>
            Deterministic review already mapped the strongest blockers, missing
            evidence, and manual checks for this repository.
          </p>
        </article>
        <article className="workflow-step">
          <strong>2. Fix</strong>
          <p>
            Apply the checklist below, then resubmit the same repository URL to
            compare a new report against the current one.
          </p>
        </article>
        <article className="workflow-step">
          <strong>3. Adjudicate</strong>
          <p>
            {canSubmit
              ? "This report is eligible for wallet-signed GenLayer adjudication."
              : "On-chain adjudication is blocked until deterministic gate issues are resolved."}
          </p>
        </article>
      </div>

      {checklist.length === 0 ? (
        <p className="subtle">
          No triggered findings are left in this report. If the repository is
          accepted, you can move to wallet-signed adjudication.
        </p>
      ) : (
        <div className="fix-checklist">
          {checklist.map((item) => (
            <article key={item.id} className="fix-item">
              <header>
                <div>
                  <strong>{item.ruleId}</strong>
                  <h4>{item.title}</h4>
                </div>
                <span className={`severity severity-${item.severity}`}>
                  {item.severity}
                </span>
              </header>
              <p>{item.summary}</p>
              <ul className="stack-list">
                {item.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
              {item.manualChecks.length > 0 ? (
                <div className="callout">
                  <strong>Manual follow-up</strong>
                  <ul className="stack-list">
                    {item.manualChecks.map((manualCheck) => (
                      <li key={manualCheck}>{manualCheck}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
