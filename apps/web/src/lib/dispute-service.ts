import { randomUUID } from "node:crypto";
import {
  type EnterpriseDisputeReport,
  EnterpriseDisputeErrorSchema,
  EnterpriseDisputeSuccessSchema,
  type EnterpriseDisputeResponse,
  type DisputeIntakeInput,
  DisputeIntakeInputSchema,
  type DisputeIssue,
  type DisputeTimelineStep,
} from "./dispute-domain";

function buildIssues(input: DisputeIntakeInput): DisputeIssue[] {
  const issues: DisputeIssue[] = [];
  const evidenceCount = input.evidenceItems.length;

  if (evidenceCount < 3) {
    issues.push({
      id: "evidence-depth",
      severity: "high",
      title: "Evidence pack is too thin",
      summary:
        "Fewer than three concrete evidence items were provided, which weakens bilateral adjudication.",
      action:
        "Add at least three concrete evidence items such as signed contract clauses, invoices, delivery receipts, or dated correspondence.",
    });
  }

  if (!/clause|section|appendix|sla|invoice|purchase|order|bol|contract/i.test(
      `${input.contractReference} ${input.claimSummary}`,
    )) {
    issues.push({
      id: "contract-anchor",
      severity: "medium",
      title: "Contract anchor is underspecified",
      summary:
        "The claim does not yet point clearly enough to a clause, purchase order, invoice, or governing document.",
      action:
        "Name the exact clause, appendix, PO number, invoice, or governing term that the adjudicator should weigh.",
    });
  }

  if (input.respondentPosition.trim().length < 30) {
    issues.push({
      id: "respondent-position",
      severity: "medium",
      title: "Respondent position is too short",
      summary:
        "The second side of the dispute is present but not detailed enough for balanced adjudication.",
      action:
        "Expand the respondent position with dates, objections, or performance explanations.",
    });
  }

  if (input.claimantName.trim().toLowerCase() === input.respondentName.trim().toLowerCase()) {
    issues.push({
      id: "same-party-conflict",
      severity: "high",
      title: "Both parties resolve to the same identity",
      summary:
        "The claimant and respondent appear to be the same party, which blocks bilateral dispute review.",
      action:
        "Correct the party identities before resubmitting the case.",
    });
  }

  return issues;
}

function buildReadiness(input: DisputeIntakeInput, issues: DisputeIssue[]) {
  const satisfiedRequirements = [
    "Claimant and respondent identified",
    "Claim summary provided",
    "Requested remedy provided",
    "Contract reference included",
  ];
  const missingRequirements: string[] = [];

  if (input.evidenceItems.length < 3) {
    missingRequirements.push("At least three concrete evidence items");
  }
  if (input.respondentPosition.trim().length < 30) {
    missingRequirements.push("Detailed respondent position");
  }
  if (
    input.claimantName.trim().toLowerCase() ===
    input.respondentName.trim().toLowerCase()
  ) {
    missingRequirements.push("Distinct claimant and respondent identities");
  }

  const blocked = issues.some(
    (issue) => issue.id === "same-party-conflict",
  );

  return {
    status: blocked
      ? "blocked"
      : missingRequirements.length > 0
        ? "needs_more_information"
        : "ready_for_adjudication",
    satisfiedRequirements,
    missingRequirements,
  } as const;
}

function buildOperatingModel(input: DisputeIntakeInput) {
  const owner =
    input.disputeType === "logistics"
      ? "Port operations and legal ops joint review"
      : input.disputeType === "procurement"
        ? "Procurement operations with finance and legal escalation"
        : input.disputeType === "services"
          ? "Service delivery management with legal escalation"
          : "Enterprise legal ops escalation team";

  return {
    internalOwner: owner,
    counterpartyChannel:
      "Share the bounded evidence packet and requested remedy with the counterparty before validator escalation.",
    appealPath:
      "If the validator-backed resolution is disputed, open a manual appeal with the preserved chronology and signed settlement memo.",
    settlementArtifacts: [
      "Bounded evidence export",
      "Resolution memo",
      "Counterparty notice log",
      "Payment or service-credit instruction",
    ],
  };
}

function buildWorkflowTimeline(
  decision: "REJECT" | "REQUEST_MORE_INFO" | "ACCEPT_FOR_SCORING",
): DisputeTimelineStep[] {
  return [
    {
      id: "intake",
      label: "Intake captured",
      status: "completed",
      summary: "The claimant, respondent, requested remedy, and governing dispute context are structured.",
    },
    {
      id: "readiness",
      label: "Readiness triage",
      status: "completed",
      summary: "Deterministic checks evaluated evidence depth, bilateral positioning, and contract anchoring.",
    },
    {
      id: "wallet",
      label: "Wallet and contract path",
      status: decision === "ACCEPT_FOR_SCORING" ? "active" : "pending",
      summary:
        decision === "ACCEPT_FOR_SCORING"
          ? "The case is eligible for wallet-signed GenLayer submission once the dispute contract is configured."
          : "On-chain escalation should wait until the dispute packet is complete enough for bounded adjudication.",
    },
    {
      id: "settlement",
      label: "Settlement execution",
      status: "pending",
      summary: "After consensus, convert the resolution into a settlement memo, payment instruction, or service-credit order.",
    },
  ];
}

export async function generateEnterpriseDisputeReport(
  body: unknown,
): Promise<EnterpriseDisputeResponse> {
  try {
    const input = DisputeIntakeInputSchema.parse(body);
    const issues = buildIssues(input);
    const readiness = buildReadiness(input, issues);
    const decision =
      readiness.status === "blocked"
        ? "REJECT"
        : readiness.status === "needs_more_information"
          ? "REQUEST_MORE_INFO"
          : "ACCEPT_FOR_SCORING";

    const caseId = randomUUID();
    const evidencePack = input.evidenceItems.map((item, index) => ({
      id: `evidence-${index + 1}`,
      title: `Submitted evidence ${index + 1}`,
      classification: "OBSERVED" as const,
      summary: item,
    }));

    const adjudicationQuestions = [
      "Do the claimant's requested remedies align with the cited contractual terms and evidence chronology?",
      "Does the respondent position materially rebut the claimant with documented performance, notice, or exception evidence?",
      "Is the evidence package strong enough for a two-sided enterprise adjudication, or should the case be deferred for more information?",
    ];

    const report: EnterpriseDisputeReport = {
      caseId,
      caseTitle: input.caseTitle,
      disputeType: input.disputeType,
      decision,
      generatedAt: new Date().toISOString(),
      parties: {
        claimant: input.claimantName,
        respondent: input.respondentName,
      },
      summary:
        decision === "ACCEPT_FOR_SCORING"
          ? "The case package is structured enough for bilateral enterprise adjudication."
          : decision === "REQUEST_MORE_INFO"
            ? "The dispute is plausible, but one or more evidence or counter-position gaps still need to be filled."
            : "The case is currently blocked and should not proceed to on-chain adjudication yet.",
      readiness,
      evidencePack,
      issues,
      workflowTimeline: buildWorkflowTimeline(decision),
      operatingModel: buildOperatingModel(input),
      adjudicationQuestions,
      recommendedActions:
        decision === "ACCEPT_FOR_SCORING"
          ? [
              "Connect MetaMask and submit the bounded dispute packet to the enterprise adjudication contract once deployed.",
              "Preserve the evidence chronology for manual appeal and audit review.",
            ]
          : issues.map((issue) => issue.action),
      resolutionPlaybook:
        decision === "ACCEPT_FOR_SCORING"
          ? [
              "Generate a validator-facing resolution packet with both party positions and the exact remedy question.",
              "Submit the packet through a wallet-controlled enterprise dispute contract.",
              "Track finality, then issue a settlement memo and payable adjustment instruction.",
            ]
          : [
              "Close evidence gaps before blockchain escalation.",
              "Reconfirm both party identities and the contractual anchor.",
              "Resubmit the bounded packet after the dossier is complete.",
            ],
      boundedRequest: {
        caseId,
        program: "enterprise-dispute-adjudication-v1",
        disputeType: input.disputeType,
        parties: {
          claimant: input.claimantName,
          respondent: input.respondentName,
        },
        contractReference: input.contractReference,
        claimSummary: input.claimSummary,
        respondentPosition: input.respondentPosition,
        requestedRemedy: input.requestedRemedy,
        governingTerms: input.governingTerms,
        amountClaimed: input.amountClaimed,
        filingDate: input.filingDate,
        evidenceSummary: evidencePack.map((item) => ({
          evidenceId: item.id,
          classification: item.classification,
          summary: item.summary,
        })),
        adjudicationQuestions,
        requestLimits: {
          maxEvidenceItems: 8,
          maxQuestionCount: 3,
          maxOutputChars: 2000,
        },
      },
      genlayerResult: {
        status: "GENLAYER_NOT_CONFIGURED",
        judgment: null,
        parserMessage:
          "Deploy an enterprise dispute adjudication contract and configure the public contract address before requesting on-chain consensus.",
      },
    };

    return EnterpriseDisputeSuccessSchema.parse({
      ok: true,
      report,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return EnterpriseDisputeErrorSchema.parse({
        ok: false,
        error: {
          code: "INVALID_CASE_INPUT",
          message: "Dispute intake payload did not match the required schema.",
          details: [error.message],
        },
      });
    }

    return EnterpriseDisputeErrorSchema.parse({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "GenForge could not generate the enterprise dispute dossier.",
        details: error instanceof Error ? [error.message] : [],
      },
    });
  }
}
