import type { ReviewReport } from "@genforge/domain";

export function ScoreOverview({ report }: { report: ReviewReport }) {
  const items = [
    ["GenLayer Fit", report.scores.genLayerFit],
    ["Contract Quality", report.scores.contractQuality],
    ["Engineering", report.scores.engineering],
    ["Frontend UX", report.scores.frontendUx],
    ["Evidence Confidence", report.scores.evidenceConfidence],
  ] as const;

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Score Overview</h3>
        <strong>{report.scores.total.toFixed(1)} / 5.0</strong>
      </div>
      <p className="subtle">
        Scores reflect deterministic evidence plus GenLayer judgment when a
        parsed consensus result is available.
      </p>
      <div className="score-grid">
        {items.map(([label, value]) => (
          <article key={label} className="score-card">
            <span>{label}</span>
            <strong>{value.toFixed(1)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
