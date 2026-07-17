# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class StoredReview:
    submission_id: str
    repository_slug: str
    decision: str
    summary: str
    confidence: float
    raw_judgment_json: str


class GenForgeJudge(gl.Contract):
    reviews: TreeMap[str, StoredReview]

    def __init__(self):
        pass

    def _build_task(self, request: dict) -> str:
        return f"""
You are validating a bounded GenLayer project review request.

Repository: {request["repository"]["owner"]}/{request["repository"]["name"]}
Commit: {request["repository"]["commitSha"]}
Program: {request["program"]}
Deterministic gate decision: {request["gate"]["decision"]}
Evidence summary:
{json.dumps(request["evidenceSummary"], sort_keys=True)}
Subjective questions:
{json.dumps(request["subjectiveQuestions"], sort_keys=True)}

Return only JSON with:
{{
  "decision": "REJECT" | "REQUEST_MORE_INFO" | "ACCEPT_FOR_SCORING",
  "scores": {{
    "genlayer_fit": 0-5,
    "contract_quality": 0-5,
    "engineering": 0-5,
    "frontend_ux": 0-5
  }},
  "confidence": 0.0-1.0,
  "summary": "short summary",
  "strengths": ["..."],
  "findings": ["..."],
  "required_actions": ["..."],
  "manual_review_required": true | false
}}
        """

    def _build_criteria(self, gate_decision: str) -> str:
        return f"""
The output must be valid JSON matching the requested keys.
The decision must be one of REJECT, REQUEST_MORE_INFO, ACCEPT_FOR_SCORING.
If deterministic gate decision is not ACCEPT_FOR_SCORING, the output must not be ACCEPT_FOR_SCORING.
The summary and findings must be grounded in the bounded evidence package.
The response must not invent repository behavior, deployment state, transactions, or scores unsupported by the input.
The score fields must each be between 0 and 5.
The confidence field must be between 0.0 and 1.0.
Current deterministic gate decision: {gate_decision}.
        """

    def _judge_submission(self, request_json: str) -> str:
        request = json.loads(request_json)
        gate_decision = request["gate"]["decision"]
        task = self._build_task(request)
        criteria = self._build_criteria(gate_decision)

        def get_input() -> str:
            return request_json

        review_output = gl.eq_principle.prompt_non_comparative(
            get_input,
            task=task,
            criteria=criteria,
        )

        parsed = json.loads(review_output)
        if gate_decision != "ACCEPT_FOR_SCORING":
            parsed["decision"] = gate_decision
            parsed["manual_review_required"] = True
            parsed["required_actions"] = list(
                set(
                    parsed.get("required_actions", [])
                    + [
                        "Deterministic gate must pass before this submission can be scored.",
                    ]
                )
            )

        return json.dumps(parsed, sort_keys=True)

    @gl.public.write
    def review_submission(self, request: str) -> str:
        result_json = self._judge_submission(request)
        result = json.loads(result_json)
        request_data = json.loads(request)
        review = StoredReview(
            submission_id=request_data["submissionId"],
            repository_slug=f'{request_data["repository"]["owner"]}/{request_data["repository"]["name"]}',
            decision=result["decision"],
            summary=result["summary"],
            confidence=float(result["confidence"]),
            raw_judgment_json=result_json,
        )
        self.reviews[request_data["submissionId"]] = review
        return result_json

    @gl.public.view
    def get_review(self, submission_id: str) -> dict:
        review = self.reviews[submission_id]
        return {
            "submission_id": review.submission_id,
            "repository_slug": review.repository_slug,
            "decision": review.decision,
            "summary": review.summary,
            "confidence": review.confidence,
        }

    @gl.public.view
    def get_review_judgment(self, submission_id: str) -> str:
        return self.reviews[submission_id].raw_judgment_json
