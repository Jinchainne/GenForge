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
