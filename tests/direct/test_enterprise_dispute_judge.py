"""Direct-mode tests for the enterprise dispute judge contract."""

import json

from tests.direct.conftest import build_dispute_payload


def test_resolve_dispute_stores_resolution(direct_deploy, direct_vm):
    contract = direct_deploy(
        "contracts/genforge_judge/resolve_enterprise_dispute.py"
    )
    direct_vm.mock_llm(
        r".*bounded enterprise dispute adjudication request.*",
        json.dumps(
            {
                "disposition": "claim_partially_upheld",
                "liability_split": "shared",
                "payable_adjustment": "Recommend a shared allocation of detention costs and partial service credits.",
                "resolution_summary": "The bounded record supports shared operational responsibility.",
                "reasoning": [
                    "The SLA anchor supports the claimant's delay theory.",
                    "The respondent also provided a plausible shared-fault defense.",
                ],
                "required_actions": [
                    "Issue a settlement memo and preserve the chronology for appeal review."
                ],
                "manual_review_required": False,
                "confidence": 0.79,
            }
        ),
    )

    payload = json.dumps(build_dispute_payload())
    result = json.loads(contract.resolve_dispute(payload))

    assert result["disposition"] == "claim_partially_upheld"
    assert result["liability_split"] == "shared"

    stored = contract.get_resolution("case-001")
    assert stored["claimant"] == "OceanBridge Logistics Ltd."
    assert stored["respondent"] == "Northport Container Services"
    assert stored["payable_adjustment"].startswith("Recommend a shared allocation")

    raw = contract.get_resolution_judgment("case-001")
    assert json.loads(raw)["resolution_summary"].startswith("The bounded record")


def test_resolve_dispute_requires_more_information_for_thin_evidence(
    direct_deploy, direct_vm
):
    contract = direct_deploy(
        "contracts/genforge_judge/resolve_enterprise_dispute.py"
    )
    direct_vm.mock_llm(
        r".*bounded enterprise dispute adjudication request.*",
        json.dumps(
            {
                "disposition": "claim_upheld",
                "liability_split": "respondent",
                "payable_adjustment": "Full detention reimbursement.",
                "resolution_summary": "The claimant appears stronger.",
                "reasoning": [],
                "required_actions": [],
                "manual_review_required": False,
                "confidence": 0.51,
            }
        ),
    )

    thin_payload = build_dispute_payload()
    thin_payload["evidenceSummary"] = thin_payload["evidenceSummary"][:2]
    result = json.loads(contract.resolve_dispute(json.dumps(thin_payload)))

    assert result["disposition"] == "request_more_information"
    assert result["manual_review_required"] is True
    assert any(
        "Expand the bounded evidence pack" in action
        for action in result["required_actions"]
    )
