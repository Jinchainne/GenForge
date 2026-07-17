import type { ReviewErrorCode, ReviewReport } from "@genforge/domain";

const stateCopy: Record<string, { title: string; body: string }> = {
  idle: {
    title: "Ready for Repository Intake",
    body: "Submit a public GitHub repository URL to start a read-only GenLayer project review.",
  },
  validating_url: {
    title: "Validating Submission",
    body: "GenForge is normalizing the repository URL and enforcing GitHub-only intake constraints.",
  },
  collecting_evidence: {
    title: "Collecting Evidence",
    body: "GenForge is collecting metadata, repository tree context, manifests, contract candidates, and deployment clues through the GitHub API only.",
  },
  applying_deterministic_rules: {
    title: "Applying Deterministic Rules",
    body: "Observed and inferred evidence is being compared against the deterministic GenLayer gate rules.",
  },
  waiting_for_genlayer_transaction: {
    title: "Submitting to GenLayer",
    body: "The bounded review request is ready for a GenLayer transaction.",
  },
  consensus_pending: {
    title: "Consensus Pending",
    body: "A GenLayer transaction was submitted and final validator agreement is still pending.",
  },
  partial_result: {
    title: "Partial Evidence Available",
    body: "A report is available, but one or more checks still require manual verification.",
  },
  rejected: {
    title: "Gate Rejected",
    body: "Current evidence is not strong enough to pass deterministic GenLayer gating.",
  },
  request_more_information: {
    title: "Request More Information",
    body: "The repository has plausible signals, but source, deployment, or verification evidence is still incomplete.",
  },
  accepted_for_scoring: {
    title: "Accepted for Scoring",
    body: "The repository passed deterministic gating and has a complete scoring path.",
  },
  integration_unavailable: {
    title: "Integration Unavailable",
    body: "The deterministic review completed, but the live GenLayer integration is not configured or unavailable.",
  },
  rate_limited: {
    title: "GitHub Rate Limited",
    body: "GitHub API limits were reached before GenForge could complete the review.",
  },
  repository_unavailable: {
    title: "Repository Unavailable",
    body: "GenForge could not retrieve the repository from GitHub in this phase.",
  },
  error: {
    title: "Review Error",
    body: "GenForge could not complete the preliminary repository review.",
  },
};

function errorToState(code: ReviewErrorCode): keyof typeof stateCopy {
  if (code === "RATE_LIMITED") {
    return "rate_limited";
  }
  if (
    code === "REPOSITORY_NOT_FOUND" ||
    code === "PRIVATE_REPOSITORY" ||
    code === "GITHUB_UNAVAILABLE" ||
    code === "RESPONSE_TOO_LARGE"
  ) {
    return "repository_unavailable";
  }
  return "error";
}

export function ProgressPanel({
  state,
  report,
  errorCode,
}: {
  state: keyof typeof stateCopy;
  report: ReviewReport | null;
  errorCode: ReviewErrorCode | null;
}) {
  const effectiveState =
    report?.state ?? (errorCode ? errorToState(errorCode) : state);
  const copy = stateCopy[effectiveState];

  return (
    <section className="panel hero-panel">
      <div className="eyebrow">Preliminary Repository Review</div>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="status-rail" aria-label="Review phases">
        <span className={state === "validating_url" ? "active" : ""}>
          Validate
        </span>
        <span
          className={
            state === "collecting_evidence" ? "active" : report ? "done" : ""
          }
        >
          Evidence
        </span>
        <span
          className={
            state === "applying_deterministic_rules"
              ? "active"
              : report
                ? "done"
                : ""
          }
        >
          Gate
        </span>
        <span
          className={
            state === "waiting_for_genlayer_transaction" ||
            state === "consensus_pending" ||
            state === "accepted_for_scoring"
              ? "active"
              : ""
          }
        >
          Consensus
        </span>
        <span className={report ? "active" : ""}>Report</span>
      </div>
      <p className="footnote">
        Live Studio and Explorer verification still require manual follow-up
        unless a configured GenLayer environment is available.
      </p>
    </section>
  );
}
