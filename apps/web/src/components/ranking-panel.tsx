"use client";

import type { ReviewReport } from "@genforge/domain";

export function RankingPanel({ report }: { report: ReviewReport }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Accepted Submission Ranking</h3>
        <span>{report.ranking.eligible ? "Eligible" : "Not ranked"}</span>
      </div>
      <p className="subtle">{report.ranking.rationale}</p>
      <dl className="source-grid">
        <div>
          <dt>Eligible</dt>
          <dd>{report.ranking.eligible ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{report.ranking.position ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Compared submissions</dt>
          <dd>{report.ranking.comparedSubmissionIds.length}</dd>
        </div>
      </dl>
    </section>
  );
}
