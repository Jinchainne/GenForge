"""Integration tests for the enterprise dispute judge contract.

Run with: gltest tests/integration/ -v -s
"""

import json

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

from tests.direct.conftest import build_dispute_payload


@pytest.mark.integration
def test_resolve_dispute_round_trip():
    factory = get_contract_factory("EnterpriseDisputeJudge")
    contract = factory.deploy(
        contract_file="contracts/genforge_judge/resolve_enterprise_dispute.py"
    )

    payload = json.dumps(build_dispute_payload())
    tx = contract.resolve_dispute(
        args=[payload],
        wait_interval=10000,
        wait_retries=15,
    )
    assert tx_execution_succeeded(tx)

    stored = contract.get_resolution(args=["case-001"])
    assert stored["claimant"] == "OceanBridge Logistics Ltd."
    assert stored["respondent"] == "Northport Container Services"

    raw = contract.get_resolution_judgment(args=["case-001"])
    parsed = json.loads(raw)
    assert parsed["disposition"] in {
        "claim_upheld",
        "claim_partially_upheld",
        "claim_denied",
        "request_more_information",
    }
