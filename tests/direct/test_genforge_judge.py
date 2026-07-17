"""Direct-mode tests for the GenForge judge contract."""

import json

from tests.direct.conftest import build_request_payload


def test_review_submission_stores_judgment(direct_deploy, direct_vm):
    contract = direct_deploy("contracts/genforge_judge/review_submission.py")
    direct_vm.mock_llm(
        r".*bounded GenLayer project review request.*",
        json.dumps(
            {
                "decision": "ACCEPT_FOR_SCORING",
                "scores": {
                    "genlayer_fit": 4,
                    "contract_quality": 4,
                    "engineering": 3,
                    "frontend_ux": 3,
                },
                "confidence": 0.77,
                "summary": "The submission delegates consensus-critical qualitative review to GenLayer.",
                "strengths": ["Evidence package is bounded."],
                "findings": [],
                "required_actions": ["Run live Studio-backed verification."],
                "manual_review_required": False,
            }
        ),
    )

    payload = json.dumps(build_request_payload())
    result = contract.review_submission(payload)
    parsed = json.loads(result)
    assert parsed["decision"] == "ACCEPT_FOR_SCORING"

    stored = contract.get_review("submission-001")
    assert stored["repository_slug"] == "builder/judge-dapp"
    assert stored["decision"] == "ACCEPT_FOR_SCORING"

    raw = contract.get_review_judgment("submission-001")
    assert json.loads(raw)["summary"].startswith("The submission delegates")


def test_gate_rejection_overrides_acceptance(direct_deploy, direct_vm):
    contract = direct_deploy("contracts/genforge_judge/review_submission.py")
    direct_vm.mock_llm(
        r".*bounded GenLayer project review request.*",
        json.dumps(
            {
                "decision": "ACCEPT_FOR_SCORING",
                "scores": {
                    "genlayer_fit": 4,
                    "contract_quality": 4,
                    "engineering": 3,
                    "frontend_ux": 3,
                },
                "confidence": 0.5,
                "summary": "The model would otherwise accept the submission.",
                "strengths": [],
                "findings": [],
                "required_actions": [],
                "manual_review_required": False,
            }
        ),
    )

    payload = json.dumps(build_request_payload("REJECT"))
    result = json.loads(contract.review_submission(payload))

    assert result["decision"] == "REJECT"
    assert result["manual_review_required"] is True
    assert any(
        "Deterministic gate must pass" in action
        for action in result["required_actions"]
    )
