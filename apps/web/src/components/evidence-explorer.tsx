import type { ReviewReport } from "@genforge/domain";

export function EvidenceExplorer({ report }: { report: ReviewReport }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Evidence Explorer</h3>
        <span>{report.evidence.length} items</span>
      </div>
      <div className="evidence-list">
        {report.evidence.map((item) => (
          <article key={item.id} className="evidence-item">
            <header>
              <strong>{item.title}</strong>
              <span
                className={`classification ${item.classification.toLowerCase()}`}
              >
                {item.classification}
              </span>
            </header>
            <p>{item.summary}</p>
            <dl>
              {item.filePath ? (
                <>
                  <dt>Path</dt>
                  <dd>{item.filePath}</dd>
                </>
              ) : null}
              {item.observedValue ? (
                <>
                  <dt>Observed</dt>
                  <dd>{item.observedValue}</dd>
                </>
              ) : null}
              {item.limitation ? (
                <>
                  <dt>Limitation</dt>
                  <dd>{item.limitation}</dd>
                </>
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
