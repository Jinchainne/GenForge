"use client";

import type { ReviewAttempt } from "@/lib/review-workflow";

export function SubmissionHistoryPanel({
  currentAttempt,
  previousAttempts,
}: {
  currentAttempt: ReviewAttempt | null;
  previousAttempts: ReviewAttempt[];
}) {
  const entries = currentAttempt
    ? [currentAttempt, ...previousAttempts]
    : previousAttempts;

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Resubmit History</h3>
        <span>{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="subtle">
          No repository review attempts have been recorded in this browser
          session yet.
        </p>
      ) : (
        <div className="history-list">
          {entries.map((attempt, index) => (
            <article
              key={attempt.id}
              className={`history-item ${index === 0 ? "history-item-active" : ""}`}
            >
              <header>
                <strong>
                  {attempt.report.repository.owner}/{attempt.report.repository.repo}
                </strong>
                <span>{index === 0 ? "Latest" : "Previous"}</span>
              </header>
              <p>{attempt.report.summary}</p>
              <p className="subtle">
                Reviewed {new Date(attempt.reviewedAt).toLocaleString()} · Gate{" "}
                {attempt.report.decision} · On-chain {attempt.onchain.status}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
