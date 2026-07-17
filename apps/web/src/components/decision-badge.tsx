import type { ReviewReport } from "@genforge/domain";

const labelMap: Record<ReviewReport["decision"], string> = {
  REJECT: "Reject",
  REQUEST_MORE_INFO: "Request More Info",
  ACCEPT_FOR_SCORING: "Accept for Scoring",
};

export function DecisionBadge({
  decision,
}: {
  decision: ReviewReport["decision"];
}) {
  return (
    <span className={`decision-badge decision-${decision.toLowerCase()}`}>
      {labelMap[decision]}
    </span>
  );
}
