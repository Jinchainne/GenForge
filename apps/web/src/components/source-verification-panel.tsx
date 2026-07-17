import type { ReviewReport } from "@genforge/domain";

export function SourceVerificationPanel({ report }: { report: ReviewReport }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Source Verification</h3>
        <span>
          {report.repository.owner}/{report.repository.repo}
        </span>
      </div>
      <dl className="source-grid">
        <div>
          <dt>Repository</dt>
          <dd>{report.sourceVerification.repositoryUrl}</dd>
        </div>
        <div>
          <dt>Default branch</dt>
          <dd>{report.sourceVerification.defaultBranch}</dd>
        </div>
        <div>
          <dt>Commit</dt>
          <dd>{report.sourceVerification.commitSha}</dd>
        </div>
        <div>
          <dt>Files considered</dt>
          <dd>{report.sourceVerification.filesConsidered}</dd>
        </div>
        <div>
          <dt>Files retrieved</dt>
          <dd>{report.sourceVerification.filesRetrieved}</dd>
        </div>
        <div>
          <dt>Rate limit remaining</dt>
          <dd>
            {report.sourceVerification.rateLimitRemaining === null
              ? "Unavailable"
              : report.sourceVerification.rateLimitRemaining}
          </dd>
        </div>
      </dl>
      <div className="callout">
        <strong>Verification boundary</strong>
        <p>
          GitHub intake is automated. Deployment matching, wallet flows, Studio
          execution, Explorer checks, state transitions, and transferred value
          still require live GenLayer evidence.
        </p>
      </div>
    </section>
  );
}
