"use client";

import type { ReviewReport } from "@genforge/domain";

export function ConfidencePanel({ report }: { report: ReviewReport }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Confidence Breakdown</h3>
        <strong>{(report.confidence.score * 100).toFixed(0)}%</strong>
      </div>
      <p className="subtle">
        {report.confidence.level.toUpperCase()} confidence based on evidence
        completeness, manual verification, and GenLayer status.
      </p>
      <ul className="stack-list">
        {report.confidence.factors.map((factor) => (
          <li key={factor.id}>
            <strong>{factor.label}</strong>
            <p>
              {factor.summary} ({factor.effect > 0 ? "+" : ""}
              {factor.effect.toFixed(2)})
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
