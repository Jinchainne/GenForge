"""Integration tests — require GenLayer Studio or configured network.

Run with: gltest tests/integration/ -v -s
"""

import json

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

from tests.direct.conftest import build_request_payload
from tests.integration.fixtures import EXPECTED_ACCEPTED_REPOSITORY_SLUG


@pytest.mark.integration
def test_review_submission_round_trip():
    factory = get_contract_factory("GenForgeJudge")
    contract = factory.deploy()

    payload = json.dumps(build_request_payload())
    tx = contract.review_submission(
        args=[payload],
        wait_interval=10000,
        wait_retries=15,
    )
    assert tx_execution_succeeded(tx)

    stored = contract.get_review(args=["submission-001"])
    assert stored["repository_slug"] == EXPECTED_ACCEPTED_REPOSITORY_SLUG

    raw = contract.get_review_judgment(args=["submission-001"])
    parsed = json.loads(raw)
    assert parsed["decision"] == "ACCEPT_FOR_SCORING"
