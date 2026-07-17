import type { ReviewReport } from "@genforge/domain";

export function FindingsPanel({ report }: { report: ReviewReport }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Findings</h3>
        <span>{report.findings.length} triggered rules</span>
      </div>
      <div className="finding-list">
        {report.findings.map((finding) => (
          <article key={finding.id} className="finding-item">
            <header>
              <div>
                <strong>{finding.ruleId}</strong>
                <h4>{finding.title}</h4>
              </div>
              <span className={`severity severity-${finding.severity}`}>
                {finding.severity}
              </span>
            </header>
            <p>{finding.summary}</p>
            <p className="subtle">
              {finding.classification} · confidence {finding.confidence}
            </p>
            <ul>
              {finding.remediation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {finding.manualVerification.length > 0 ? (
              <>
                <strong>Manual verification</strong>
                <ul>
                  {finding.manualVerification.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
