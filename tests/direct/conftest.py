"""Shared helpers for GenForge direct mode tests."""


def build_request_payload(decision="ACCEPT_FOR_SCORING"):
    return {
        "submissionId": "submission-001",
        "repository": {
            "owner": "builder",
            "name": "judge-dapp",
            "commitSha": "abc1234def5678",
        },
        "program": "genlayer-project-review-v1",
        "gate": {
            "decision": decision,
            "passedRuleIds": ["GL-GATE-003", "GL-GATE-004"],
            "failedRuleIds": [] if decision == "ACCEPT_FOR_SCORING" else ["GL-GATE-001"],
            "missingRuleIds": [],
        },
        "evidenceSummary": [
            {
                "evidenceId": "ev-1",
                "classification": "OBSERVED",
                "summary": "Repository includes a GenLayer contract and a real write path.",
                "repositoryFileOrUrl": "contracts/genforge_judge/review_submission.py",
            }
        ],
        "subjectiveQuestions": [
            {
                "id": "genlayer-fit",
                "prompt": "Does this project materially benefit from decentralized adjudication?",
                "rationale": "Decorative GenLayer use should not pass.",
            }
        ],
        "equivalencePrinciple": "Use non-comparative validation grounded in the bounded evidence package.",
        "requestLimits": {
            "maxEvidenceItems": 10,
            "maxEvidenceChars": 220,
            "maxSubjectiveQuestions": 3,
            "maxOutputChars": 1800,
        },
    }


def build_dispute_payload():
    return {
        "caseId": "case-001",
        "program": "enterprise-dispute-adjudication-v1",
        "disputeType": "logistics",
        "parties": {
            "claimant": "OceanBridge Logistics Ltd.",
            "respondent": "Northport Container Services",
        },
        "contractReference": "MSA-2026-044 / Appendix B / SLA section 3.2",
        "claimSummary": (
            "The claimant alleges that the respondent caused avoidable berth and "
            "container handoff delays, triggering detention costs and missing the "
            "contractual turnaround SLA for two consecutive sailings."
        ),
        "respondentPosition": (
            "The respondent states that weather alerts, customs inspection holds, "
            "and a late trucking release from the claimant materially contributed "
            "to the delay and should qualify as exceptions under the service agreement."
        ),
        "requestedRemedy": (
            "Determine liability for detention charges, allocate service credits, "
            "and recommend the payable adjustment."
        ),
        "evidenceSummary": [
            {
                "evidenceId": "evidence-1",
                "classification": "OBSERVED",
                "summary": "Signed SLA appendix describing turnaround obligations.",
            },
            {
                "evidenceId": "evidence-2",
                "classification": "OBSERVED",
                "summary": "Port event log showing missed berth release windows.",
            },
            {
                "evidenceId": "evidence-3",
                "classification": "OBSERVED",
                "summary": "Email thread disputing whether force majeure applies.",
            },
        ],
        "adjudicationQuestions": [
            "Did the claimant prove a contractual breach tied to the cited SLA?",
            "Does the respondent evidence support a documented exception or shared fault defense?",
            "What resolution best fits the bounded record and requested remedy?",
        ],
        "requestLimits": {
            "maxEvidenceItems": 8,
            "maxQuestionCount": 3,
            "maxOutputChars": 2000,
        },
    }
