"use client";

import { useState } from "react";
import type { ReviewReport } from "@genforge/domain";

export function RankingPanel({ report }: { report: ReviewReport }) {
  const [selected, setSelected] = useState(false);
  const canSelect = report.ranking.eligible && report.decision === "ACCEPT_FOR_SCORING";

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Scoring Desk</div>
          <h3>Accepted Submission Ranking</h3>
        </div>
        <span>{selected ? "shortlisted" : report.ranking.eligible ? "eligible" : "not ranked"}</span>
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
      <div className="action-row">
        <button
          type="button"
          onClick={() => setSelected((current) => !current)}
          disabled={!canSelect}
        >
          {selected ? "Remove Selection" : "Select Submission"}
        </button>
      </div>
      <div className={selected ? "callout" : "subtle-callout"}>
        <strong>
          {selected ? "Operator shortlist recorded" : "Selection boundary"}
        </strong>
        <p>
          {selected
            ? "This browser session has marked the reviewed repository as a winner candidate for operator follow-up."
            : "Selection is an operator-side shortlist. It is not on-chain state until a wallet-signed transaction or deployment receipt exists."}
        </p>
      </div>
    </section>
  );
}
