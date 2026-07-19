"""Direct-mode tests for the GenForge project token factory."""

import json

import pytest

from tests.direct.conftest import build_token_payload


def test_deploy_token_records_project_token(direct_deploy):
    contract = direct_deploy("contracts/genforge_judge/deploy_project_token.py")

    payload = build_token_payload()
    result = json.loads(contract.deploy_token(json.dumps(payload)))

    assert result["status"] == "TOKEN_DEPLOYMENT_RECORDED"
    assert result["token_symbol"] == "GFRC"
    assert result["owner"] == payload["recipient"]

    stored = contract.get_token_deployment(payload["deploymentId"])
    assert stored["token_name"] == "GenForge Review Credit"
    assert stored["initial_supply"] == "1000000"

    raw = json.loads(contract.get_token_deployment_json(payload["deploymentId"]))
    assert raw["deployment_id"] == payload["deploymentId"]


def test_deploy_token_rejects_duplicate_deployment_id(direct_deploy):
    contract = direct_deploy("contracts/genforge_judge/deploy_project_token.py")
    payload = build_token_payload()

    contract.deploy_token(json.dumps(payload))

    with pytest.raises(Exception, match="already exists"):
        contract.deploy_token(json.dumps(payload))
