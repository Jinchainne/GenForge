# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class StoredDisputeResolution:
    case_id: str
    claimant: str
    respondent: str
    disposition: str
    liability_split: str
    payable_adjustment: str
    raw_resolution_json: str


class EnterpriseDisputeJudge(gl.Contract):
    resolutions: TreeMap[str, StoredDisputeResolution]

    def __init__(self):
        pass

    def _build_task(self, request: dict) -> str:
        return f"""
You are validating a bounded enterprise dispute adjudication request.

Program: {request["program"]}
Dispute type: {request["disputeType"]}
Claimant: {request["parties"]["claimant"]}
Respondent: {request["parties"]["respondent"]}
Contract reference: {request["contractReference"]}
Claim summary:
{request["claimSummary"]}

Respondent position:
{request["respondentPosition"]}

Requested remedy:
{request["requestedRemedy"]}

Evidence summary:
{json.dumps(request["evidenceSummary"], sort_keys=True)}

Adjudication questions:
{json.dumps(request["adjudicationQuestions"], sort_keys=True)}

Return only JSON with:
{{
  "disposition": "claim_upheld" | "claim_partially_upheld" | "claim_denied" | "request_more_information",
  "liability_split": "claimant" | "respondent" | "shared" | "undetermined",
  "payable_adjustment": "short text describing monetary or credit adjustment",
  "resolution_summary": "short grounded explanation",
  "reasoning": ["..."],
  "required_actions": ["..."],
  "manual_review_required": true | false,
  "confidence": 0.0-1.0
}}
        """

    def _build_criteria(self, request: dict) -> str:
        return f"""
The output must be valid JSON matching the requested keys.
Do not invent evidence, witnesses, deliveries, logs, or contract clauses not present in the request.
Ground the result only in the bounded evidence summary and the stated positions of both parties.
The confidence field must be between 0.0 and 1.0.
If the evidence summary has fewer than 3 items, the disposition must be request_more_information.
If the claimant and respondent names are identical, the disposition must be request_more_information and manual_review_required must be true.
The payable_adjustment must stay qualitative and bounded to the requested remedy.
Current party pair: {request["parties"]["claimant"]} vs {request["parties"]["respondent"]}.
        """

    def _resolve_dispute(self, request_json: str) -> str:
        request = json.loads(request_json)
        task = self._build_task(request)
        criteria = self._build_criteria(request)

        def get_input() -> str:
            return request_json

        resolution_output = gl.eq_principle.prompt_non_comparative(
            get_input,
            task=task,
            criteria=criteria,
        )

        parsed = json.loads(resolution_output)
        evidence_count = len(request["evidenceSummary"])
        claimant = request["parties"]["claimant"].strip().lower()
        respondent = request["parties"]["respondent"].strip().lower()

        if evidence_count < 3 or claimant == respondent:
            parsed["disposition"] = "request_more_information"
            parsed["manual_review_required"] = True
            parsed["required_actions"] = list(
                set(
                    parsed.get("required_actions", [])
                    + [
                        "Expand the bounded evidence pack before requesting validator consensus.",
                    ]
                )
            )

        return json.dumps(parsed, sort_keys=True)

    @gl.public.write
    def resolve_dispute(self, request: str) -> str:
        result_json = self._resolve_dispute(request)
        result = json.loads(result_json)
        request_data = json.loads(request)
        stored = StoredDisputeResolution(
            case_id=request_data["caseId"],
            claimant=request_data["parties"]["claimant"],
            respondent=request_data["parties"]["respondent"],
            disposition=result["disposition"],
            liability_split=result["liability_split"],
            payable_adjustment=result["payable_adjustment"],
            raw_resolution_json=result_json,
        )
        self.resolutions[request_data["caseId"]] = stored
        return result_json

    @gl.public.view
    def get_resolution(self, case_id: str) -> dict:
        resolution = self.resolutions[case_id]
        return {
            "case_id": resolution.case_id,
            "claimant": resolution.claimant,
            "respondent": resolution.respondent,
            "disposition": resolution.disposition,
            "liability_split": resolution.liability_split,
            "payable_adjustment": resolution.payable_adjustment,
        }

    @gl.public.view
    def get_resolution_judgment(self, case_id: str) -> str:
        return self.resolutions[case_id].raw_resolution_json
