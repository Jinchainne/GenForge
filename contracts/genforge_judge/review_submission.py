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


class GenForgeJudge(gl.Contract):
    reviews: TreeMap[str, StoredReview]

    def __init__(self):
        pass

    def _judge_submission(self, request_json: str) -> str:
        request = json.loads(request_json)
        gate_decision = request["gate"]["decision"]
        evidence_count = len(request["evidenceSummary"])
        question_count = len(request["subjectiveQuestions"])

        def perform_review() -> str:
            prompt = f"""
You are validating a bounded GenLayer project review request.

Repository: {request["repository"]["owner"]}/{request["repository"]["name"]}
Commit: {request["repository"]["commitSha"]}
Program: {request["program"]}
Deterministic gate decision: {gate_decision}
Evidence count: {evidence_count}
Subjective questions: {question_count}

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

Rules:
- Never return ACCEPT_FOR_SCORING if the deterministic gate was not ACCEPT_FOR_SCORING.
- Ground findings in the provided evidence package only.
- Do not invent repository behavior.
- Use a normalized structure suitable for validator comparison.
            """
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.dumps(result, sort_keys=True)

        return gl.eq_principle.strict_eq(perform_review)

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
