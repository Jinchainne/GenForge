# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class StoredProjectToken:
    deployment_id: str
    project_name: str
    token_name: str
    token_symbol: str
    initial_supply: str
    decimals: str
    owner: str
    purpose: str
    raw_deployment_json: str


class GenForgeProjectTokenFactory(gl.Contract):
    deployments: TreeMap[str, StoredProjectToken]

    def __init__(self):
        pass

    def _validate_request(self, request: dict) -> None:
        required_fields = [
            "deploymentId",
            "projectName",
            "tokenName",
            "tokenSymbol",
            "initialSupply",
            "decimals",
            "recipient",
            "purpose",
        ]
        for field in required_fields:
            if field not in request:
                raise gl.vm.UserError(f"Missing token deployment field: {field}")

        if not str(request["deploymentId"]).strip():
            raise gl.vm.UserError("deploymentId is required")
        if not str(request["tokenName"]).strip():
            raise gl.vm.UserError("tokenName is required")
        if not str(request["tokenSymbol"]).strip():
            raise gl.vm.UserError("tokenSymbol is required")
        decimals = int(request["decimals"])
        if decimals < 0 or decimals > 36:
            raise gl.vm.UserError("decimals must be between 0 and 36")
        if str(request["initialSupply"]).strip().startswith("-"):
            raise gl.vm.UserError("initialSupply cannot be negative")
        if not str(request["recipient"]).strip():
            raise gl.vm.UserError("recipient wallet is required")

    @gl.public.write
    def deploy_token(self, request_json: str) -> str:
        request = json.loads(request_json)
        self._validate_request(request)

        deployment_id = request["deploymentId"]
        if deployment_id in self.deployments:
            raise gl.vm.UserError("Token deployment already exists")

        response = {
            "status": "TOKEN_DEPLOYMENT_RECORDED",
            "deployment_id": deployment_id,
            "project_name": request["projectName"],
            "token_name": request["tokenName"],
            "token_symbol": str(request["tokenSymbol"]).upper(),
            "initial_supply": str(request["initialSupply"]),
            "decimals": str(request["decimals"]),
            "owner": request["recipient"],
            "purpose": request["purpose"],
            "contract_model": "GenLayer project token registry",
        }
        response_json = json.dumps(response, sort_keys=True)

        self.deployments[deployment_id] = StoredProjectToken(
            deployment_id=deployment_id,
            project_name=request["projectName"],
            token_name=request["tokenName"],
            token_symbol=str(request["tokenSymbol"]).upper(),
            initial_supply=str(request["initialSupply"]),
            decimals=str(request["decimals"]),
            owner=request["recipient"],
            purpose=request["purpose"],
            raw_deployment_json=response_json,
        )
        return response_json

    @gl.public.view
    def get_token_deployment(self, deployment_id: str) -> dict:
        deployment = self.deployments[deployment_id]
        return {
            "deployment_id": deployment.deployment_id,
            "project_name": deployment.project_name,
            "token_name": deployment.token_name,
            "token_symbol": deployment.token_symbol,
            "initial_supply": deployment.initial_supply,
            "decimals": deployment.decimals,
            "owner": deployment.owner,
            "purpose": deployment.purpose,
        }

    @gl.public.view
    def get_token_deployment_json(self, deployment_id: str) -> str:
        return self.deployments[deployment_id].raw_deployment_json
