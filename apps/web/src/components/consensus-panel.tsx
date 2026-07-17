"use client";

import type { ReviewReport } from "@genforge/domain";

export function ConsensusPanel({ report }: { report: ReviewReport }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Consensus Status</h3>
        <span>{report.genlayerResult.status}</span>
      </div>
      <dl className="source-grid">
        <div>
          <dt>Network</dt>
          <dd>{report.genlayerResult.network ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd>{report.genlayerResult.contractAddress ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Transaction</dt>
          <dd>{report.genlayerResult.transactionHash ?? "Not submitted"}</dd>
        </div>
        <div>
          <dt>Receipt</dt>
          <dd>{report.genlayerResult.receiptStatus ?? "Unavailable"}</dd>
        </div>
      </dl>
      {report.genlayerResult.judgment ? (
        <div className="callout">
          <strong>{report.genlayerResult.judgment.decision}</strong>
          <p>{report.genlayerResult.judgment.summary}</p>
        </div>
      ) : (
        <p className="subtle">
          {report.genlayerResult.parserMessage ??
            "A live GenLayer result is not available for this submission yet."}
        </p>
      )}
    </section>
  );
}
